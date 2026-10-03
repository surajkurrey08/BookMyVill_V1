const mongoose = require('mongoose');

const CustomerHoldSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  checkIn: { type: String, required: true },
  checkOut: { type: String, required: true },
  guests: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['held', 'payment_pending', 'confirmed', 'released'], default: 'held' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  orderId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

CustomerHoldSchema.index({ user: 1, createdAt: -1 });
CustomerHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('CustomerHold', CustomerHoldSchema);
