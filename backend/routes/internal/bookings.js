const express = require('express');
const Booking = require('../../models/Booking');
const { requireInternal } = require('../../shared/internal');
const { validId, sendError, HttpError } = require('../../utils/validate');

// booking-service internal API.
const router = express.Router();
router.use(requireInternal);
const fail = (res, err) => sendError(res, err, 'Internal bookings');

// A completed, paid stay of this guest at this property (review eligibility).
router.get('/completed-stay', async (req, res) => {
  try {
    if (!validId(req.query.userId) || !validId(req.query.propertyId)) throw new HttpError(400, 'Invalid request.');
    const b = await Booking.findOne({ user: req.query.userId, property: req.query.propertyId, status: 'confirmed', paymentStatus: 'paid', stayStatus: 'checked_out' }).select('_id guest').lean();
    if (!b) throw new HttpError(404, 'No completed stay.');
    res.json({ bookingId: String(b._id), guestName: b.guest?.name || '', guestPhone: b.guest?.phone || '' });
  } catch (err) { fail(res, err); }
});

// Result of confirming a booking after payment.success (polled by payment-service).
router.get('/:id/payment-outcome', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Booking not found.');
    const b = await Booking.findById(req.params.id).select('_id status paymentStatus razorpayPaymentId paymentOutcome').lean();
    if (!b) throw new HttpError(404, 'Booking not found.');
    res.json({ bookingId: String(b._id), status: b.status, paymentStatus: b.paymentStatus, paymentId: b.razorpayPaymentId || null, outcome: b.paymentOutcome || null });
  } catch (err) { fail(res, err); }
});

module.exports = router;
