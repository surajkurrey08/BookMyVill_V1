const mongoose = require('mongoose');

// One document per room per night. The unique {room, date} index is the
// double-booking guarantee: two operations can never both own the same night.
//   block   – owner blocked the night (maintenance, personal use…)
//   booking – night belongs to a confirmed booking
//   hold    – temporary price/inventory hold for a quotation; it stops counting
//             at expiresAt and is purged on the next conflicting reservation
//             (and by the TTL index below as a background clean-up).
const RoomNightSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  kind: { type: String, enum: ['block', 'booking', 'hold'], required: true },
  reference: { type: mongoose.Schema.Types.ObjectId, required: true },
  operationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, default: '', maxlength: 200 },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

RoomNightSchema.index({ room: 1, date: 1 }, { unique: true });
RoomNightSchema.index({ kind: 1, reference: 1 });
RoomNightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { kind: 'hold' } });
module.exports = mongoose.model('RoomNight', RoomNightSchema);
