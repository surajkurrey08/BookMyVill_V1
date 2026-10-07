const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Property = require('../models/Property');
const CustomerHold = require('../models/CustomerHold');
const inventory = require('./inventory');
const holdLocks = require('./holdLocks');
const { publish, events } = require('../messaging');
const { stayNights } = require('../utils/validate');

// booking-service: confirms a booking when payment-service reports
// payment.success. Idempotent — the same event (or a retried verify) never
// confirms twice, double-books, or double-redeems a promotion.
//
// Every outcome is stored on booking.paymentOutcome so payment-service can tell
// the guest the result; failures publish booking.confirmation_failed for review.

const MESSAGES = {
  cancelled: 'Captured payment requires refund review. Cancelled booking remains cancelled.',
  room_conflict: 'Payment was captured but the room could not be secured. Contact support with your payment ID; your booking is not confirmed.',
  changed: 'Booking changed. Contact support for payment review.',
  duplicate: 'Payment is already recorded. Contact support for room conflict or refund review.',
  mismatch: 'Payment does not match this booking. Contact support for payment review.'
};

async function recordOutcome(bookingId, code, paymentId, eventId, extra = {}) {
  const outcome = { code, message: MESSAGES[code] || '', paymentId, eventId, at: new Date() };
  await Booking.updateOne({ _id: bookingId }, { $set: { paymentOutcome: outcome, ...extra.$set }, ...(extra.$push && { $push: extra.$push }) });
  if (code !== 'confirmed') await publish(events.BOOKING_CONFIRMATION_FAILED, { bookingId: String(bookingId), paymentId, reason: code });
  return outcome;
}

const paidFields = (paymentId, mode) => ({ paymentStatus: 'paid', razorpayPaymentId: paymentId, paymentSource: 'razorpay', paymentMode: mode === 'live' ? 'live' : 'test', paidAt: new Date() });
const history = (action, reason, targetUser) => ({ actionHistory: { action, performedBy: 'Payment Event (payment.success)', ...(targetUser && { targetUser }), reason } });

async function confirmFromPayment(message) {
  const { paymentId, orderId, bookingId, holdId, amount, mode } = message.data || {};
  const eventId = message.id;
  const booking = await Booking.findById(bookingId).select('+paymentVerification');
  if (!booking) throw new Error(`booking ${bookingId} not found for payment ${paymentId}`); // retried, then parked in the DLQ

  // Already handled this payment (duplicate event or retried verify).
  if (booking.razorpayPaymentId === paymentId && booking.paymentStatus === 'paid') return booking.paymentOutcome?.code || 'confirmed';
  if (booking.razorpayOrderId !== orderId || (booking.onlineAmount ?? booking.totalPrice) !== amount) return (await recordOutcome(booking._id, 'mismatch', paymentId, eventId)).code;
  if (booking.paymentStatus === 'paid') return (await recordOutcome(booking._id, 'duplicate', paymentId, eventId)).code;

  if (booking.status !== 'pending') {
    await recordOutcome(booking._id, 'cancelled', paymentId, eventId, { $set: paidFields(paymentId, mode), $push: history('Payment Captured After Cancellation', 'Refund review required; no room was reserved.') });
    if (holdId) { await inventory.releaseHolds(holdId); await holdLocks.releaseForHold(holdId); }
    return 'cancelled';
  }

  // Lease so two consumers never confirm the same booking concurrently.
  const lease = new Date(Date.now() + 120000);
  const claim = await Booking.updateOne({ _id: booking._id, status: 'pending', paymentStatus: 'pending', $or: [{ paymentVerification: null }, { paymentVerification: { $lte: new Date() } }] }, { $set: { paymentVerification: lease } });
  if (!claim.modifiedCount) throw new Error(`booking ${bookingId} is being confirmed by another worker`); // retry later
  try {
    const hold = holdId ? await CustomerHold.findById(holdId) : await CustomerHold.findOne({ booking: booking._id });
    const room = await Room.findById(booking.room);
    const dates = hold && stayNights(hold.checkIn, hold.checkOut, 365);
    if (!room || !dates) return (await recordOutcome(booking._id, 'room_conflict', paymentId, eventId, { $set: paidFields(paymentId, mode), $push: history('Payment Captured – Room Conflict', 'Room could not be verified.') })).code;

    try { await inventory.convertHoldToBooking(room, dates, hold._id, booking._id); }
    catch {
      return (await recordOutcome(booking._id, 'room_conflict', paymentId, eventId, { $set: paidFields(paymentId, mode), $push: history('Payment Captured – Room Conflict', 'Room conflict requires support and refund review.', `Booking ${booking._id}`) })).code;
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'pending', paymentStatus: 'pending' },
      { $set: { status: 'confirmed', ...paidFields(paymentId, mode), paymentOutcome: { code: 'confirmed', message: '', paymentId, eventId, at: new Date() } }, $push: history('Payment Captured & Stay Confirmed', 'Payment and room inventory verified.', `Booking ${booking._id}`) },
      { new: true }
    );
    if (!updated) {
      const latest = await Booking.findById(booking._id);
      if (latest?.status === 'cancelled') {
        await inventory.releaseBookingNights(booking._id);
        return (await recordOutcome(booking._id, 'changed', paymentId, eventId, { $set: paidFields(paymentId, mode), $push: history('Refund Review Required', 'Cancellation occurred during capture.') })).code;
      }
      return (await recordOutcome(booking._id, 'changed', paymentId, eventId)).code;
    }

    await CustomerHold.updateOne({ _id: hold._id }, { $set: { status: 'confirmed' } });
    await holdLocks.releaseForHold(hold._id);
    // coupon-service counts the promotion use from booking.confirmed (once per booking).
    const owner = updated.promotion && updated.discountAmount > 0 ? (await Property.findById(room.property).select('owner').lean())?.owner : null;
    const facts = { bookingId: String(updated._id), villaId: String(updated.property), userId: updated.user ? String(updated.user) : null, paymentId, amount: updated.onlineAmount ?? updated.totalPrice, paymentPlan: updated.paymentPlan || 'full',
      ...(owner && { promotion: { id: String(updated.promotion), owner: String(owner), discount: updated.discountAmount } }) };
    await publish(events.BOOKING_CONFIRMED, facts);
    await publish(events.AVAILABILITY_CHANGED, { villaId: facts.villaId });
    return 'confirmed';
  } finally {
    await Booking.updateOne({ _id: booking._id, paymentVerification: lease }, { $unset: { paymentVerification: 1 } });
  }
}

module.exports = { confirmFromPayment, MESSAGES };
