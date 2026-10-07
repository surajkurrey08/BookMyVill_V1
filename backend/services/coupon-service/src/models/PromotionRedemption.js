const mongoose = require('mongoose');
const { database } = require('../config');

// One row per booking whose promotion use was counted from booking.confirmed,
// so a redelivered event never counts twice.
const PromotionRedemptionSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  promotion: { type: mongoose.Schema.Types.ObjectId, required: true },
  discount: { type: Number, default: 0 },
  eventId: { type: String, default: '' }
}, { timestamps: true, collection: 'promotion_redemptions' });

module.exports = database.connection.model('PromotionRedemption', PromotionRedemptionSchema);
