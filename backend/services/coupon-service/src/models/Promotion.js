const mongoose = require('mongoose');
const { database } = require('../config');

const TYPES = ['promo_code', 'early_bird', 'last_minute', 'long_stay', 'repeat_guest', 'corporate', 'group', 'seasonal'];

// Discount rules applied to the accommodation part of a stay. Usage is counted
// when a quotation converts or a checkout booking is confirmed, never when drafted.
// Owned by coupon-service; owner/properties/createdBy are IDs only.
const PromotionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  code: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,20}$/ },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 300 },
  type: { type: String, enum: TYPES, required: true },
  discountType: { type: String, enum: ['percent', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  maxDiscount: { type: Number, min: 1, default: null },
  // Empty = every property of the owner.
  properties: { type: [{ type: mongoose.Schema.Types.ObjectId }], default: [] },
  minNights: { type: Number, min: 1, default: null },
  minAmount: { type: Number, min: 1, default: null },
  minGuests: { type: Number, min: 1, default: null },
  advanceDaysMin: { type: Number, min: 0, default: null },
  advanceDaysMax: { type: Number, min: 0, default: null },
  bookFrom: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  bookUntil: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  stayFrom: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  stayUntil: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  maxUses: { type: Number, min: 1, default: null },
  maxUsesPerGuest: { type: Number, min: 1, default: null },
  usedCount: { type: Number, default: 0 },
  discountGiven: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true, collection: 'promotions' });

PromotionSchema.index({ owner: 1, code: 1 }, { unique: true });
PromotionSchema.index({ owner: 1, active: 1 });

module.exports = database.connection.model('Promotion', PromotionSchema);
module.exports.TYPES = TYPES;
