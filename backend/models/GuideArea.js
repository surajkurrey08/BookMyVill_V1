const mongoose = require('mongoose');

// A location (town/area) where BookMyVilla offers a local guide, with the one
// per-day rate guests see at checkout. Villas match an area by their location name.
const GuideAreaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  key: { type: String, required: true, unique: true }, // normalised name, see services/guides
  dailyRate: { type: Number, required: true, min: 1, max: 1000000 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GuideArea', GuideAreaSchema);
