const mongoose = require('mongoose');

const RoomNightSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  kind: { type: String, enum: ['block', 'booking'], required: true },
  reference: { type: mongoose.Schema.Types.ObjectId, required: true },
  operationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, default: '', maxlength: 200 },
  createdAt: { type: Date, default: Date.now }
});

RoomNightSchema.index({ room: 1, date: 1 }, { unique: true });
RoomNightSchema.index({ kind: 1, reference: 1 });
module.exports = mongoose.model('RoomNight', RoomNightSchema);
