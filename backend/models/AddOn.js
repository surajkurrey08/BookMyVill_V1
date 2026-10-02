const mongoose = require('mongoose');

const CATEGORIES = ['meal', 'experience', 'decoration', 'transport', 'room', 'service', 'other'];
// How the unit price scales in a quote:
//   per_stay            price × quantity
//   per_night           price × quantity × nights
//   per_guest           price × guests
//   per_guest_per_night price × guests × nights
//   per_unit            price × quantity
const PRICING_UNITS = ['per_stay', 'per_night', 'per_guest', 'per_guest_per_night', 'per_unit'];

const AddOnSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // null = offered at every property the owner manages.
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 300 },
  category: { type: String, enum: CATEGORIES, required: true },
  pricingUnit: { type: String, enum: PRICING_UNITS, required: true },
  price: { type: Number, required: true, min: 0, max: 10000000 },
  taxRate: { type: Number, min: 0, max: 28, default: 0 },
  maxQuantity: { type: Number, min: 1, max: 100, default: null },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

AddOnSchema.index({ owner: 1, active: 1, name: 1 });

module.exports = mongoose.model('AddOn', AddOnSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.PRICING_UNITS = PRICING_UNITS;
