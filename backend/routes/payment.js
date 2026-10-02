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

router.post('/', accountAuth, async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return res.status(400).json({ msg: 'Choose a published property before booking.' });
    const property = await Property.findOne({ _id: propertyId, status: 'approved' });
    if (!property) return res.status(404).json({ msg: 'This listing is not yet available for booking.' });
    const first = dateOnly(checkIn);
    const last = dateOnly(checkOut);
    if (!first || !last) return res.status(400).json({ msg: 'Choose valid check-in and check-out dates.' });
    const stayType = req.body.stayType === 'day' ? 'day' : 'night';
    const nights = Math.round((last - first) / 86400000);
    if ((stayType === 'night' && (nights < 1 || nights > 365)) || (stayType === 'day' && nights !== 0)) {
      return res.status(400).json({ msg: 'Choose a valid stay period. Day pass dates must match.' });
    }
    const guests = Number(req.body.guests || 1);
    if (!Number.isInteger(guests) || guests < 1 || guests > 50) return res.status(400).json({ msg: 'Choose 1–50 guests.' });
    const rate = Number(property.price);
    if (!Number.isFinite(rate) || rate <= 0) return res.status(409).json({ msg: 'This property needs a valid published rate.' });
    const amount = Math.round(stayType === 'day' ? rate * 0.55 : rate * nights);
    if (!Number.isSafeInteger(amount) || amount < 1) return res.status(400).json({ msg: 'Unable to calculate booking amount.' });

    let order = null;
    if (paymentAvailable) {
      try {
        order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: `bm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` });
      } catch (err) {
        console.error('Razorpay order creation error:', err);
        return res.status(502).json({ msg: 'Payment provider is unavailable. No booking or payment was created.' });
      }
    }

    const user = await User.findById(req.user.id).select('name email phone');
    const booking = await Booking.create({
      user: req.user.id, property: property._id, checkIn: first, checkOut: last,
      stayType, guests, totalPrice: amount, razorpayOrderId: order?.id,
      status: 'pending', paymentStatus: 'pending',
      actionHistory: [{ action: 'Booking Requested', performedBy: `Traveler (${user?.name || req.user.id})`, targetUser: 'Property Owner', reason: `${stayType === 'day' ? 'Day pass' : `${nights} night stay`} requested. Payment pending.`, timestamp: new Date() }]
    });
    res.status(201).json({ booking, paymentAvailable: Boolean(order), order_id: order?.id || null, amount: order?.amount || amount * 100, currency: 'INR', key_id: order ? keyId : null, msg: order ? 'Continue in Razorpay Checkout.' : 'Booking request saved with payment pending. Online payment is currently unavailable.' });
  } catch (err) {
    console.error('Booking request error:', err);
    res.status(500).json({ msg: 'Could not create booking request.' });
  }
});

router.post('/verify', accountAuth, async (req, res) => {
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
