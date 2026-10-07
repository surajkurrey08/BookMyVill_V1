const mongoose = require('mongoose');
const { database } = require('../config');

// One provider order and its outcome. Owned by payment-service; bookings and
// quotations are referenced by ID only.
const PaymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ['booking', 'quote'], required: true },
  bookingId: { type: String, default: null, index: true },
  holdId: { type: String, default: null, index: true },
  quoteId: { type: String, default: null },
  userId: { type: String, default: null },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'captured', 'failed'], default: 'created' },
  paymentId: { type: String, default: undefined },
  mode: { type: String, enum: ['test', 'live'], default: 'test' },
  failureReason: { type: String, default: '' },
  capturedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'payments' });
// A provider payment can settle exactly one order.
PaymentSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } });

module.exports = database.connection.model('Payment', PaymentSchema);
