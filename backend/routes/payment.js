const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const accountAuth = require('../middleware/accountAuth');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');

const router = express.Router();
const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
const paymentAvailable = /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) && keySecret.length >= 10 && !/fake|placeholder|your_/i.test(keySecret);
const razorpay = paymentAvailable ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

router.post('/', accountAuth, (req,res) => res.status(409).json({ msg: 'Choose an exact available room and use room hold checkout.', code: 'ROOM_HOLD_REQUIRED' }));

router.post('/verify', accountAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ msg: 'Customer account required.' });
  try {
    if (!paymentAvailable) return res.status(503).json({ msg: 'Online payment is not configured.' });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId) || typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({ msg: 'Complete the payment in Razorpay Checkout first.' });
    }
    const booking = await Booking.findOne({ user: req.user.id, razorpayOrderId: orderId });
    if (!booking) return res.status(404).json({ msg: 'Payment order not found for your booking.' });
    const expected = crypto.createHmac('sha256', keySecret).update(`${booking.razorpayOrderId}|${paymentId}`).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return res.status(400).json({ msg: 'Invalid payment signature.' });

    let payment;
    try { payment = await razorpay.payments.fetch(paymentId); }
    catch (err) { console.error('Razorpay payment fetch error:', err); return res.status(502).json({ msg: 'Payment could not be checked with Razorpay yet. Your booking remains pending.' }); }
    if (payment.order_id !== booking.razorpayOrderId || payment.amount !== Math.round(booking.totalPrice * 100) || payment.currency !== 'INR' || payment.status !== 'captured') {
      return res.status(409).json({ msg: 'Payment is not captured for this booking yet. Please retry after capture.' });
    }
    if (booking.paymentStatus === 'paid') {
      if (booking.razorpayPaymentId === paymentId) return res.json({ msg: 'Payment already verified.', booking });
      return res.status(409).json({ msg: 'This booking already has a different recorded payment.' });
    }
    if (!booking.room || booking.status === 'cancelled') return res.status(409).json({ msg: 'This legacy booking cannot be confirmed. Contact support for captured payment review.' });
    const dates = require('../utils/validate').stayNights(booking.checkIn.toISOString().slice(0,10), booking.checkOut.toISOString().slice(0,10), 365);
    if (!dates || await require('../models/RoomNight').countDocuments({ room: booking.room, reference: booking._id, kind: 'booking', date: { $in: dates } }) !== dates.length) return res.status(409).json({ msg: 'Room inventory is not reserved. Use exact-room checkout; captured payment requires support review.' });
    const mode = keyId.startsWith('rzp_live_') ? 'live' : 'test';
    const cancelled = booking.status === 'cancelled';
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, user: req.user.id, razorpayOrderId: orderId, paymentStatus: 'pending' }, {
      $set: { paymentStatus: 'paid', status: cancelled ? 'cancelled' : 'confirmed', razorpayPaymentId: paymentId, paymentSource: 'razorpay', paymentMode: mode, paidAt: new Date() },
      $push: { actionHistory: { action: cancelled ? 'Payment Captured After Cancellation' : 'Payment Captured & Stay Confirmed', performedBy: 'Razorpay Payment Verification', targetUser: `Booking ${booking._id}`, reason: cancelled ? 'Captured payment requires refund review.' : `${mode} payment captured and verified against booking amount.`, timestamp: new Date() } }
    }, { new: true });
    if (!updated) return res.status(409).json({ msg: 'Booking payment state changed. Refresh your bookings.' });
    if (cancelled) return res.status(409).json({ msg: 'Payment captured after cancellation. Contact support for refund review.', booking: updated });
    res.json({ msg: 'Payment captured and booking confirmed.', booking: updated });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ msg: 'Could not verify payment.' });
  }
});

module.exports = router;
