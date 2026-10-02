const Promotion = require('../models/Promotion');
const { daysBetween } = require('../utils/validate');
const { guestHistory } = require('./crm');
const { promotionDiscount } = require('./quotePricing');

const money = amount => `₹${Number(amount).toLocaleString('en-IN')}`;

// Stay-level rules that need no database lookups. Returns the reason the
// promotion does not apply, or null when it does.
function promotionRuleFailure(promo, { propertyId, today, checkIn, nights, accommodationAmount, guests }) {
  const code = promo.code;
  if (!promo.active) return `${code} is paused.`;
  if (promo.properties?.length && !promo.properties.some(id => String(id) === String(propertyId))) return `${code} does not apply to this property.`;
  if (promo.bookFrom && today < promo.bookFrom) return `${code} can be used from ${promo.bookFrom}.`;
  if (promo.bookUntil && today > promo.bookUntil) return `${code} expired on ${promo.bookUntil}.`;
  if (promo.stayFrom && checkIn < promo.stayFrom) return `${code} is valid for check-ins from ${promo.stayFrom}.`;
  if (promo.stayUntil && checkIn > promo.stayUntil) return `${code} is valid for check-ins until ${promo.stayUntil}.`;
  if (promo.minNights && nights < promo.minNights) return `${code} needs a stay of at least ${promo.minNights} nights.`;
  if (promo.minAmount && accommodationAmount < promo.minAmount) return `${code} needs an accommodation amount of at least ${money(promo.minAmount)}.`;
  if (promo.minGuests && guests < promo.minGuests) return `${code} needs at least ${promo.minGuests} guests.`;
  const leadDays = daysBetween(today, checkIn);
  if (promo.advanceDaysMin !== null && promo.advanceDaysMin !== undefined && leadDays < promo.advanceDaysMin) return `${code} needs check-in at least ${promo.advanceDaysMin} days ahead.`;
  if (promo.advanceDaysMax !== null && promo.advanceDaysMax !== undefined && leadDays > promo.advanceDaysMax) return `${code} is only for check-ins within ${promo.advanceDaysMax} days.`;
  if (promo.maxUses && promo.usedCount >= promo.maxUses) return `${code} has reached its usage limit.`;
  return null;
}

// Guest-level rules (repeat guest, per-guest limit) that need lookups.
async function guestRuleFailure(promo, { owner, guestPhoneKey = '', guestEmail = '', excludeQuotation = null }) {
  if (promo.type === 'repeat_guest') {
    const history = await guestHistory(owner, { phoneKey: guestPhoneKey, email: guestEmail });
    if (!history.completedStays) return `${promo.code} is for returning guests; no completed stay was found for this guest.`;
  }
  if (promo.maxUsesPerGuest && (guestPhoneKey || guestEmail)) {
    const Quotation = require('../models/Quotation');
    const match = [];
    if (guestPhoneKey) match.push({ guestPhoneKey });
    if (guestEmail) match.push({ 'guest.email': guestEmail.toLowerCase() });
    const filter = { owner, 'promotion.promotion': promo._id, status: 'converted', $or: match };
    if (excludeQuotation) filter._id = { $ne: excludeQuotation };
    const used = await Quotation.countDocuments(filter);
    if (used >= promo.maxUsesPerGuest) return `${promo.code} has already been used ${used} time${used === 1 ? '' : 's'} by this guest.`;
  }
  return null;
}

async function findPromotionByCode(owner, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(normalized)) return null;
  return Promotion.findOne({ owner, code: normalized });
}

// Counts one use when a quotation converts. `force` honours a price the guest
// has already paid even if the limit was reached in the meantime.
async function redeemPromotion(owner, promotionId, discount, { force = false } = {}) {
  const filter = { _id: promotionId, owner };
  if (!force) filter.$or = [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }];
  const result = await Promotion.updateOne(filter, { $inc: { usedCount: 1, discountGiven: discount } });
  return result.modifiedCount === 1;
}

module.exports = { promotionDiscount, promotionRuleFailure, guestRuleFailure, findPromotionByCode, redeemPromotion };
