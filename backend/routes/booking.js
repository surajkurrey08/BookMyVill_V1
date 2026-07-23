const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const auth = require('../middleware/auth');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay with fallback for fake/test mode
let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_fake',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'fake_secret'
  });
} catch (err) {
  console.log('Razorpay initialization skipped or failed. Using fake mode.');
}

// Create a booking & Payment Order (supports Fake mode)
router.post('/', auth, async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, totalPrice, isFake } = req.body;
    
    let orderId = `fake_order_${Date.now()}`;
    
    // Attempt real Razorpay order if not in fake mode
    if (!isFake && process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder_id') {
      try {
        const options = {
          amount: totalPrice * 100,
          currency: "INR",
          receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        orderId = order.id;
      } catch (rzpErr) {
        console.log('Razorpay order creation failed, falling back to fake order ID');
      }
    }

    // Handle property ID resolution to ensure exact hotel name, location and photo are linked
    let validPropertyId = propertyId;
    if (mongoose.Types.ObjectId.isValid(propertyId)) {
      const existingProp = await Property.findById(propertyId);
      if (!existingProp && req.body.propertyName) {
        const newProp = new Property({
          owner: req.user.id,
          name: req.body.propertyName,
          type: req.body.propertyType || 'Villa',
          location: req.body.propertyLocation || 'Mahabaleshwar, Maharashtra',
          price: totalPrice || 15000,
          photos: req.body.propertyImage ? [req.body.propertyImage] : [],
          status: 'approved'
        });
        await newProp.save();
        validPropertyId = newProp._id;
      }
    } else {
      const actualName = req.body.propertyName || `Mahabaleshwar Stay #${propertyId}`;
      const actualLocation = req.body.propertyLocation || 'Mahabaleshwar, Maharashtra';
      const actualType = req.body.propertyType || 'Villa';
      const actualImage = req.body.propertyImage || '';

      let mockProperty = await Property.findOne({ name: actualName });
      if (!mockProperty) {
        mockProperty = new Property({
          owner: req.user.id,
          name: actualName,
          type: actualType,
          location: actualLocation,
          price: totalPrice || 15000,
          photos: actualImage ? [actualImage] : [],
          status: 'approved'
        });
        await mockProperty.save();
      } else {
        if (actualLocation && mockProperty.location !== actualLocation) {
          mockProperty.location = actualLocation;
        }
        if (actualImage && (!mockProperty.photos || mockProperty.photos.length === 0)) {
          mockProperty.photos = [actualImage];
        }
        await mockProperty.save();
      }
      validPropertyId = mockProperty._id;
    }

    // Save Booking to DB
    const booking = new Booking({
      user: req.user.id,
      property: validPropertyId,
      checkIn,
      checkOut,
      totalPrice,
      razorpayOrderId: orderId,
      paymentStatus: 'pending'
    });
    
    await booking.save();

    res.status(201).json({
      booking: booking,
      order_id: String(orderId),
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_fake',
      isFake: true
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Booking initialization failed', error: err.message });
  }
});

// Verify Payment (supports Fake verification)
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isFake } = req.body;

    if (isFake || (razorpay_order_id && razorpay_order_id.startsWith('fake_'))) {
      // Automatic success for fake payments
      await Booking.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: 'paid', status: 'confirmed' }
      );
      return res.status(200).json({ msg: "Fake Payment verified successfully" });
    }

    // Real signature verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      await Booking.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: 'paid', status: 'confirmed' }
      );
      return res.status(200).json({ msg: "Payment verified successfully" });
    } else {
      return res.status(400).json({ msg: "Invalid signature sent!" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Get logged in user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('property')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all bookings for all properties belonging to logged in Property Owner
router.get('/owner', auth, async (req, res) => {
  try {
    // Find all properties owned by this user
    const ownerProperties = await Property.find({ owner: req.user.id });
    const propertyIds = ownerProperties.map(p => p._id);

    // Find bookings for these properties
    const bookings = await Booking.find({ property: { $in: propertyIds } })
      .populate('user', 'name email phone')
      .populate('property')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching owner bookings');
  }
});

// Update booking status (Owner or Admin)
router.put('/status/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id).populate('property');
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // Check if user is owner of the property or admin
    if (booking.property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to update this booking' });
    }

    booking.status = status;
    await booking.save();
    res.json(booking);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating booking status');
  }
});

// Get bookings for a specific property (Protected - Owners/Admin only)
router.get('/property/:propertyId', auth, async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }
    
    // Check if the current user is the owner of the property or an admin
    if (property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied: You are not the owner of this property' });
    }

    const bookings = await Booking.find({ property: propertyId })
      .populate('user', 'name email')
      .populate('property')
      .sort({ createdAt: -1 });
      
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Admin: Get all bookings
router.get('/all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const bookings = await Booking.find()
            .populate('user', 'name email')
            .populate('property', 'name')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Cancel a booking (Only within 24 hours)
router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    // Check ownership
    if (booking.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // 24 Hour Logic
    const now = new Date();
    const createdAt = new Date(booking.createdAt);
    const diffHours = Math.abs(now - createdAt) / 36e5;

    if (diffHours > 24) {
      return res.status(400).json({ msg: 'Cancellation period (24 hours) has expired.' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.json({ msg: 'Booking cancelled successfully', booking });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
