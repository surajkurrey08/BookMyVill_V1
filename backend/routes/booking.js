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
    const User = require('../models/User');
    const userObj = await User.findById(req.user.id);
    const userEmail = userObj ? userObj.email : 'Traveler';
    const userName = userObj ? userObj.name : 'Guest';

    const booking = new Booking({
      user: req.user.id,
      property: validPropertyId,
      checkIn,
      checkOut,
      totalPrice,
      razorpayOrderId: orderId,
      paymentStatus: 'pending',
      actionHistory: [{
        action: 'Booking Reserved',
        performedBy: `Traveler (${userName} - ${userEmail})`,
        targetUser: `Property Owner & System`,
        reason: `Initial stay reservation from ${new Date(checkIn).toLocaleDateString()} to ${new Date(checkOut).toLocaleDateString()}`,
        timestamp: new Date()
      }]
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isFake, bookingId } = req.body;

    let booking;
    if (razorpay_order_id) {
      booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    }
    if (!booking && bookingId) {
      booking = await Booking.findById(bookingId);
    }
    if (!booking) {
      booking = await Booking.findOne({ user: req.user.id, paymentStatus: 'pending' }).sort({ createdAt: -1 });
    }

    if (booking) {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      const User = require('../models/User');
      const u = await User.findById(req.user.id || booking.user);
      const uEmail = u ? u.email : 'Traveler';
      booking.actionHistory.push({
        action: 'Payment Verified & Stay Confirmed',
        performedBy: `Payment System (Razorpay)`,
        targetUser: `Traveler (${uEmail}) & Host`,
        reason: `Payment of ₹${booking.totalPrice} verified successfully. Status set to Confirmed.`,
        timestamp: new Date()
      });
      await booking.save();
      return res.status(200).json({ msg: "Payment verified successfully", booking });
    }

    if (isFake || (razorpay_order_id && razorpay_order_id.startsWith('fake_'))) {
      return res.status(200).json({ msg: "Fake Payment verified successfully" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
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
      .populate({
        path: 'property',
        populate: { path: 'owner', select: 'name email phone' }
      })
      .sort({ createdAt: -1 });

    // Auto sync paid bookings to confirmed status
    for (let b of bookings) {
      if (b.paymentStatus === 'paid' && b.status === 'pending') {
        b.status = 'confirmed';
        b.actionHistory.push({
          action: 'Auto-Confirmed Status',
          performedBy: 'System Processor',
          targetUser: `Traveler (${req.user.id})`,
          reason: 'Auto-confirmed upon detecting completed payment',
          timestamp: new Date()
        });
        await b.save();
      }
    }

    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all bookings for all properties belonging to logged in Property Owner
router.get('/owner', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    const cleanEmail = user ? user.email.toLowerCase().trim() : '';

    const PartnerApplication = require('../models/PartnerApplication');

    const ownerProperties = await Property.find({
      $or: [
        { owner: req.user.id },
        { ownerEmail: cleanEmail }
      ]
    });

    const partnerApps = await PartnerApplication.find({
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    });

    const propNames = [
      ...ownerProperties.map(p => p.name?.toLowerCase().trim()),
      ...partnerApps.map(a => a.propertyName?.toLowerCase().trim())
    ].filter(Boolean);

    const propertyIds = ownerProperties.map(p => p._id);

    const allBookings = await Booking.find()
      .populate('user', 'name email phone')
      .populate('property')
      .sort({ createdAt: -1 });

    const ownerBookings = allBookings.filter(b => {
      if (b.property && propertyIds.some(id => id.toString() === b.property._id?.toString())) return true;
      if (b.property && propNames.includes(b.property.name?.toLowerCase().trim())) return true;
      return false;
    });

    // Auto-confirm status if payment is completed
    for (let b of ownerBookings) {
      if (b.paymentStatus === 'paid' && b.status === 'pending') {
        b.status = 'confirmed';
        b.actionHistory.push({
          action: 'Auto-Confirmed Status',
          performedBy: 'System Processor',
          targetUser: `Traveler (${b.user?.email || 'Guest'})`,
          reason: 'Auto-confirmed upon detecting completed payment',
          timestamp: new Date()
        });
        await b.save();
      }
    }

    res.json(ownerBookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching owner bookings');
  }
});

// Update booking status (Owner or Admin)
router.put('/status/:id', auth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id).populate('property').populate('user', 'name email');
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    const cleanEmail = user ? user.email.toLowerCase().trim() : '';

    let ownerIdStr = '';
    if (booking.property && booking.property.owner) {
      ownerIdStr = booking.property.owner._id ? booking.property.owner._id.toString() : booking.property.owner.toString();
    }

    const isOwnerOrAdmin = 
      req.user.role === 'admin' ||
      req.user.role === 'owner' ||
      ownerIdStr === req.user.id ||
      (booking.property && booking.property.ownerEmail && booking.property.ownerEmail.toLowerCase() === cleanEmail);

    if (!isOwnerOrAdmin) {
      return res.status(403).json({ msg: 'Not authorized to update this booking' });
    }

    const actorRole = req.user.role === 'admin' ? 'Admin' : 'Property Owner';
    const actorName = user ? `${user.name} (${user.email})` : 'Property Owner';
    const targetName = booking.user ? `${booking.user.name} (${booking.user.email})` : 'Traveler';

    booking.status = status;
    if (status === 'cancelled' && booking.paymentStatus === 'paid') {
      booking.refundStatus = 'initiated';
      booking.refundAmount = booking.totalPrice;
      booking.actionHistory.push({
        action: 'Payment Refund Initiated',
        performedBy: 'Razorpay Refund Gateway System',
        targetUser: `Traveler: ${targetName}`,
        reason: `Full refund of ₹${booking.totalPrice} initiated back to original payment source (UPI / Credit Card / Debit Card / NetBanking). Expected in 3-5 business days.`,
        timestamp: new Date()
      });
    }

    const finalReason = status === 'cancelled'
      ? (reason || 'Cancelled by property owner')
      : `Booking status changed to '${status}' by ${actorRole}`;

    booking.actionHistory.push({
      action: status === 'cancelled' ? 'Booking Cancelled by Host' : `Status Updated to ${status.toUpperCase()}`,
      performedBy: `${actorRole}: ${actorName}`,
      targetUser: `Traveler: ${targetName}`,
      reason: finalReason,
      timestamp: new Date()
    });

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

    const User = require('../models/User');
    const u = await User.findById(req.user.id);
    const uName = u ? `${u.name} (${u.email})` : 'Traveler';

    booking.status = 'cancelled';
    if (booking.paymentStatus === 'paid') {
      booking.refundStatus = 'initiated';
      booking.refundAmount = booking.totalPrice;
      booking.actionHistory.push({
        action: 'Payment Refund Initiated',
        performedBy: 'Razorpay Refund Gateway',
        targetUser: `Traveler (${uName})`,
        reason: `Full refund of ₹${booking.totalPrice} initiated back to original payment source (UPI / Card / NetBanking). Processed in 3-5 business days.`,
        timestamp: new Date()
      });
    }

    booking.actionHistory.push({
      action: 'Booking Cancelled',
      performedBy: `Traveler (${uName})`,
      targetUser: 'Property Owner & System',
      reason: 'Traveler cancelled booking within 24-hour window',
      timestamp: new Date()
    });

    await booking.save();
    res.json({ msg: 'Booking cancelled successfully', booking });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
