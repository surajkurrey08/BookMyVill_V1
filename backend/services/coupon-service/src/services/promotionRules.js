const { daysBetween } = require('../../../../utils/validate');

const money = amount => `₹${Number(amount).toLocaleString('en-IN')}`;

// Stay-level rules that need no lookups. Returns the reason the promotion does
// not apply, or null when it does. (Guest-history rules belong to the services
// that own that history: booking/pricing.)
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

function promotionState(promo, today) {
  if (!promo.active) return 'paused';
  if (promo.bookUntil && promo.bookUntil < today) return 'ended';
  if (promo.maxUses && promo.usedCount >= promo.maxUses) return 'used_up';
  if (promo.bookFrom && promo.bookFrom > today) return 'scheduled';
  return 'live';
}

module.exports = { promotionRuleFailure, promotionState };
