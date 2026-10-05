const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const auth = require('../middleware/accountAuth');
const { requirePropertyAccess } = require('../services/propertyAccess');
const { customerBooking } = require('../services/publicViews');
const { hasPermission } = require('../services/adminRbac');
const { sendError } = require('../utils/validate');

// Get logged in user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate({
        path: 'property',
        populate: { path: 'owner', select: 'name email phone' }
      })
      .sort({ createdAt: -1 });

    res.json(bookings.map(customerBooking));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all bookings for all properties belonging to logged in Property Owner
router.get('/owner', require('../middleware/ownerAuth'), async (req, res) => {
  try {
    const propertyIds = await Property.find({ owner: req.user.id }).distinct('_id');
    const ownerBookings = await Booking.find({ property: { $in: propertyIds } })
      .populate('user', 'name email phone')
      .populate('property')
      .populate('room', 'name number')
      .sort({ createdAt: -1 });

    res.json(ownerBookings);
  } catch (err) {
    console.error('Error fetching owner bookings:', err.message);
    res.status(500).json({ msg: 'Could not load owner bookings.' });
  }
});

// Update booking status (Owner or Admin)
router.put('/status/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    if (!['owner','admin'].includes(req.user.role)) return res.status(403).json({ msg: 'Owner or authorized Admin booking action required.' });
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

    await requirePropertyAccess(req.user, booking.property?._id);
    if (['in_house', 'checked_out'].includes(booking.stayStatus) && status !== booking.status) {
      return res.status(409).json({ msg: 'Check-in/out has started. Resolve the stay in Guest Operations before changing booking status.' });
    }

    if (status !== booking.status && status !== 'cancelled') return res.status(409).json({ msg: 'Confirmation requires verified payment and reserved inventory; use the booking payment flow.' });
    if (status === booking.status) return res.json(booking);
    const previousStatus = booking.status;
    const historyLength = booking.actionHistory.length;
    const actorRole = req.user.role === 'admin' ? 'Admin' : req.user.role === 'villa_manager' ? 'Villa Manager' : 'Property Owner';
    const actorName = user ? `${user.name} (${user.email || user.phone || 'N/A'})` : 'Property Owner';
    const targetName = booking.user ? `${booking.user.name} (${booking.user.email || booking.user.phone || 'N/A'})` : 'Traveler';

    booking.status = status;
    if (status === 'cancelled' && booking.paymentStatus === 'paid') {
      booking.actionHistory.push({
        action: 'Refund Review Required',
        performedBy: `${actorRole}: ${actorName}`,
        targetUser: `Traveler: ${targetName}`,
        reason: 'Paid booking cancelled. Process and verify the refund through the payment provider.',
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

    if (status === 'cancelled' && booking.room) {
      const RoomNight = require('../models/RoomNight');
      await RoomNight.deleteMany({ kind: 'booking', reference: booking._id });
      booking.room = null;
      await booking.save();
    }

    res.json(booking);
  } catch (err) {
    sendError(res, err, 'Booking status');
  }
});

// Get bookings for a specific property (Protected - Owners/Admin only)
router.get('/property/:propertyId', auth, async (req, res) => {
  try {
    if (req.user.role === 'villa_manager') return res.status(403).json({ msg: 'Use the Villa Manager operational booking endpoint.' });
    const propertyId = req.params.propertyId;
    const property = await requirePropertyAccess(req.user, propertyId, 'report');
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }
    

    const bookings = await Booking.find({ property: propertyId })
      .populate('user', 'name email')
      .populate('property')
      .sort({ createdAt: -1 });
      
    res.json(bookings);
  } catch (err) {
    sendError(res, err, 'Property bookings');
  }
});

// Admin: Get all bookings
router.get('/all', auth, async (req, res) => {
    try {
        if (!hasPermission(req.user, 'bookings.view')) {
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
router.post('/cancel/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    // Check ownership
    if (String(booking.user || '') !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }
    if (['in_house', 'checked_out'].includes(booking.stayStatus)) {
      return res.status(409).json({ msg: 'A checked-in or completed stay cannot be cancelled here.' });
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
    const uName = u ? `${u.name} (${u.email || u.phone || 'N/A'})` : 'Traveler';

    booking.status = 'cancelled';
    if (booking.paymentStatus === 'paid') {
      booking.actionHistory.push({
        action: 'Refund Review Required',
        performedBy: `Traveler (${uName})`,
        targetUser: `Traveler (${uName})`,
        reason: 'Paid booking cancelled. Process and verify the refund through the payment provider.',
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
    if (booking.room) {
      const RoomNight = require('../models/RoomNight');
      await RoomNight.deleteMany({ kind: 'booking', reference: booking._id });
      booking.room = null;
      await booking.save();
    }
    res.json({ msg: 'Booking cancelled successfully', booking });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
