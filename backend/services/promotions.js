const { guestHistory } = require('./crm');

// Guest-level promotion rules. They need booking/quotation history, which
// booking-service and pricing-service own, so they run there; the promotion
// itself (code lookup, stay rules, usage counts) belongs to coupon-service
// (services/couponClient).
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

module.exports = { guestRuleFailure };
