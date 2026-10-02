const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

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
router.get('/owner', require('../middleware/ownerAuth'), async (req, res) => {
  try {
    const propertyIds = await Property.find({ owner: req.user.id }).distinct('_id');
    const ownerBookings = await Booking.find({ property: { $in: propertyIds } })
      .populate('user', 'name email phone')
      .populate('property')
      .populate('room', 'name number')
      .sort({ createdAt: -1 });

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
    console.error('Error fetching owner bookings:', err.message);
    res.status(500).json({ msg: 'Could not load owner bookings.' });
  }
});

// Update booking status (Owner or Admin)
router.put('/status/:id', require('../middleware/accountAuth'), async (req, res) => {
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

    let ownerIdStr = '';
    if (booking.property && booking.property.owner) {
      ownerIdStr = booking.property.owner._id ? booking.property.owner._id.toString() : booking.property.owner.toString();
    }

    const isOwnerOrAdmin = req.user.role === 'admin' || (req.user.role === 'owner' && ownerIdStr === req.user.id);

    if (!isOwnerOrAdmin) {
      return res.status(403).json({ msg: 'Not authorized to update this booking' });
    }
    if (['in_house', 'checked_out'].includes(booking.stayStatus) && status !== booking.status) {
      return res.status(409).json({ msg: 'Check-in/out has started. Resolve the stay in Guest Operations before changing booking status.' });
    }

    const actorRole = req.user.role === 'admin' ? 'Admin' : 'Property Owner';
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
