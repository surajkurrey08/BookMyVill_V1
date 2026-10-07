const Payment = require('../models/Payment');

module.exports = {
  create: data => Payment.create(data),
  byOrderId: orderId => Payment.findOne({ orderId }).lean(),
  latestForHold: (holdId, userId) => Payment.findOne({ holdId: String(holdId), userId: String(userId), purpose: 'booking' }).sort({ createdAt: -1 }).lean(),
  attachBooking: (orderId, bookingId) => Payment.updateOne({ orderId }, { $set: { bookingId: String(bookingId) } }),
  // created -> captured exactly once (idempotent under retries/races).
  markCaptured: (orderId, paymentId, mode) => Payment.findOneAndUpdate({ orderId, status: 'created' }, { $set: { status: 'captured', paymentId, mode, capturedAt: new Date() } }, { new: true }).lean(),
  markFailed: (orderId, reason) => Payment.updateOne({ orderId, status: 'created' }, { $set: { status: 'failed', failureReason: String(reason).slice(0, 200) } })
};
