const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  number: { type: String, required: true, trim: true, maxlength: 30 },
  type: { type: String, required: true, trim: true, maxlength: 60 },
  capacity: { type: Number, required: true, min: 1, max: 50 },
  baseRate: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

RoomSchema.index({ property: 1, number: 1 }, { unique: true });
module.exports = mongoose.model('Room', RoomSchema);
