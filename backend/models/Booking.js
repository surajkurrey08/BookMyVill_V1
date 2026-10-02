const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  stayType: { type: String, enum: ['night', 'day'], default: 'night' },
  guests: { type: Number, min: 1, max: 50, default: 1 },
  stayStatus: { type: String, enum: ['expected', 'in_house', 'checked_out'], default: 'expected' },
  actualCheckIn: { type: Date, default: null },
  actualCheckOut: { type: Date, default: null },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paidAt: { type: Date, default: null },
  paymentSource: { type: String, enum: ['razorpay', 'manual'], default: null },
  paymentMode: { type: String, enum: ['test', 'live', 'manual'], default: null },
  manualPaymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'upi'], default: null },
  manualPaymentReference: { type: String, default: '' },
  manualPaymentRecordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  refundStatus: {
    type: String,
    enum: ['none', 'initiated', 'processed', 'failed'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  actionHistory: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    targetUser: { type: String, required: true },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
