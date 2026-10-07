const AddOn = require('../models/AddOn');
const Promotion = require('../models/Promotion');
const { validDate, cleanText, intInRange, HttpError } = require('../../../../utils/validate');

function parseAddOn(body) {
  const name = cleanText(body.name, 80);
  if (!name) throw new HttpError(400, 'Enter an add-on name (up to 80 characters).');
  const description = cleanText(body.description, 300);
  if (description === null) throw new HttpError(400, 'Description must be under 300 characters.');
  if (!AddOn.CATEGORIES.includes(body.category)) throw new HttpError(400, 'Choose an add-on category.');
  if (!AddOn.PRICING_UNITS.includes(body.pricingUnit)) throw new HttpError(400, 'Choose how the add-on is priced.');
  const price = intInRange(body.price, 0, 10000000);
  if (price === null) throw new HttpError(400, 'Enter a whole-rupee price.');
  const taxRate = intInRange(body.taxRate ?? 0, 0, 28);
  if (taxRate === null) throw new HttpError(400, 'Tax rate must be between 0 and 28%.');
  const maxQuantity = body.maxQuantity === '' || body.maxQuantity === null || body.maxQuantity === undefined ? null : intInRange(body.maxQuantity, 1, 100);
  if (maxQuantity === null && body.maxQuantity !== '' && body.maxQuantity !== null && body.maxQuantity !== undefined) throw new HttpError(400, 'Maximum quantity must be 1–100.');
  return { name, description, category: body.category, pricingUnit: body.pricingUnit, price, taxRate, maxQuantity, active: body.active !== false };
}

function optionalInt(body, key, min, max, label) {
  const raw = body[key];
  if (raw === '' || raw === null || raw === undefined) return null;
  const value = intInRange(raw, min, max);
  if (value === null) throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  return value;
}

function optionalDate(body, key, label) {
  const raw = body[key];
  if (raw === '' || raw === null || raw === undefined) return null;
  if (!validDate(raw)) throw new HttpError(400, `${label} is not a valid date.`);
  return raw;
}

// `selectProperties(ids)` validates the owner's property selection (villa-service).
async function parsePromotion(body, selectProperties) {
  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new HttpError(400, 'Code must be 3–20 letters, numbers, hyphens or underscores.');
  const name = cleanText(body.name, 80);
  if (!name) throw new HttpError(400, 'Enter a promotion name (up to 80 characters).');
  const description = cleanText(body.description, 300);
  if (description === null) throw new HttpError(400, 'Description must be under 300 characters.');
  if (!Promotion.TYPES.includes(body.type)) throw new HttpError(400, 'Choose a promotion type.');
  if (!['percent', 'fixed'].includes(body.discountType)) throw new HttpError(400, 'Choose a percentage or fixed discount.');
  const discountValue = body.discountType === 'percent' ? intInRange(body.discountValue, 1, 90) : intInRange(body.discountValue, 1, 1000000);
  if (discountValue === null) throw new HttpError(400, body.discountType === 'percent' ? 'Percentage discount must be 1–90%.' : 'Fixed discount must be ₹1–₹10,00,000.');
  const values = {
    code, name, description, type: body.type, discountType: body.discountType, discountValue,
    maxDiscount: body.discountType === 'percent' ? optionalInt(body, 'maxDiscount', 1, 1000000, 'Maximum discount') : null,
    properties: await selectProperties(body.properties),
    minNights: optionalInt(body, 'minNights', 1, 365, 'Minimum nights'),
    minAmount: optionalInt(body, 'minAmount', 1, 100000000, 'Minimum amount'),
    minGuests: optionalInt(body, 'minGuests', 1, 50, 'Minimum guests'),
    advanceDaysMin: optionalInt(body, 'advanceDaysMin', 0, 365, 'Book-ahead days'),
    advanceDaysMax: optionalInt(body, 'advanceDaysMax', 0, 365, 'Last-minute days'),
    bookFrom: optionalDate(body, 'bookFrom', 'Booking window start'),
    bookUntil: optionalDate(body, 'bookUntil', 'Booking window end'),
    stayFrom: optionalDate(body, 'stayFrom', 'Stay window start'),
    stayUntil: optionalDate(body, 'stayUntil', 'Stay window end'),
    maxUses: optionalInt(body, 'maxUses', 1, 100000, 'Total uses'),
    maxUsesPerGuest: optionalInt(body, 'maxUsesPerGuest', 1, 100, 'Uses per guest'),
    active: body.active !== false
  };
  if (values.bookFrom && values.bookUntil && values.bookFrom > values.bookUntil) throw new HttpError(400, 'Booking window ends before it starts.');
  if (values.stayFrom && values.stayUntil && values.stayFrom > values.stayUntil) throw new HttpError(400, 'Stay window ends before it starts.');
  if (values.advanceDaysMin !== null && values.advanceDaysMax !== null && values.advanceDaysMin > values.advanceDaysMax) throw new HttpError(400, 'Book-ahead days cannot exceed last-minute days.');
  const requirement = {
    early_bird: [values.advanceDaysMin >= 1, 'Early-bird offers need a minimum number of days booked ahead.'],
    last_minute: [values.advanceDaysMax !== null, 'Last-minute offers need a maximum number of days before check-in.'],
    long_stay: [values.minNights >= 2, 'Long-stay offers need a minimum stay of at least 2 nights.'],
    group: [values.minGuests >= 2, 'Group offers need a minimum guest count of at least 2.'],
    seasonal: [Boolean(values.stayFrom && values.stayUntil), 'Seasonal offers need a stay window (from and until dates).']
  }[values.type];
  if (requirement && !requirement[0]) throw new HttpError(400, requirement[1]);
  return values;
}

module.exports = { parseAddOn, parsePromotion };
