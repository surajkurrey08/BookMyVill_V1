const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const AddOn = require('../models/AddOn');
const Promotion = require('../models/Promotion');
const Property = require('../models/Property');
const Quotation = require('../models/Quotation');
const { validId, validDate, cleanText, intInRange, indiaDate, HttpError, sendError } = require('../utils/validate');

const router = express.Router();
router.use(ownerAuth);
const fail = (res, err) => sendError(res, err, 'Owner catalog');

async function ownedPropertyIds(owner, ids) {
  const list = Array.isArray(ids) ? ids : [];
  if (list.some(id => !validId(String(id)))) throw new HttpError(400, 'Invalid property selection.');
  const unique = [...new Set(list.map(String))];
  if (!unique.length) return [];
  const found = await Property.find({ _id: { $in: unique }, owner }).distinct('_id');
  if (found.length !== unique.length) throw new HttpError(404, 'One of the selected properties is not in your account.');
  return found;
}

// ---------------------------------------------------------------- add-ons

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

router.get('/add-ons', async (req, res) => {
  try {
    const filter = { owner: req.user.id };
    if (req.query.includeInactive !== '1') filter.active = true;
    if (req.query.propertyId) {
      if (!validId(req.query.propertyId)) throw new HttpError(400, 'Invalid property filter.');
      filter.$or = [{ property: null }, { property: req.query.propertyId }];
    }
    res.json(await AddOn.find(filter).sort({ active: -1, category: 1, name: 1 }).populate('property', 'name').lean());
  } catch (err) { fail(res, err); }
});

router.post('/add-ons', async (req, res) => {
  try {
    const body = req.body || {};
    const values = parseAddOn(body);
    const [property = null] = body.propertyId ? await ownedPropertyIds(req.user.id, [body.propertyId]) : [];
    const addOn = await AddOn.create({ ...values, property, owner: req.user.id, createdBy: req.user.id });
    res.status(201).json(await AddOn.findById(addOn._id).populate('property', 'name').lean());
  } catch (err) { fail(res, err); }
});

router.patch('/add-ons/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid add-on ID.');
    const addOn = await AddOn.findOne({ _id: req.params.id, owner: req.user.id });
    if (!addOn) throw new HttpError(404, 'Add-on not found in your account.');
    const body = req.body || {};
    // Toggling availability alone is the common case; keep it cheap.
    if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
      addOn.active = body.active;
    } else {
      const current = addOn.toObject();
      const values = parseAddOn({ ...current, ...body });
      Object.assign(addOn, values);
      if (body.propertyId !== undefined) {
        const [property = null] = body.propertyId ? await ownedPropertyIds(req.user.id, [body.propertyId]) : [];
        addOn.property = property;
      }
    }
    await addOn.save();
    res.json(await AddOn.findById(addOn._id).populate('property', 'name').lean());
  } catch (err) { fail(res, err); }
});

router.delete('/add-ons/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid add-on ID.');
    const addOn = await AddOn.findOne({ _id: req.params.id, owner: req.user.id }).select('_id');
    if (!addOn) throw new HttpError(404, 'Add-on not found in your account.');
    if (await Quotation.exists({ owner: req.user.id, 'addOns.addOn': addOn._id })) {
      throw new HttpError(409, 'This add-on appears on quotations. Pause it instead so past quotes keep their history.');
    }
    await AddOn.deleteOne({ _id: addOn._id, owner: req.user.id });
    res.json({ msg: 'Add-on deleted.' });
  } catch (err) { fail(res, err); }
});

// ------------------------------------------------------------- promotions

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

async function parsePromotion(owner, body) {
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
    properties: await ownedPropertyIds(owner, body.properties),
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

function promotionState(promo, today) {
  if (!promo.active) return 'paused';
  if (promo.bookUntil && promo.bookUntil < today) return 'ended';
  if (promo.maxUses && promo.usedCount >= promo.maxUses) return 'used_up';
  if (promo.bookFrom && promo.bookFrom > today) return 'scheduled';
  return 'live';
}

router.get('/promotions', async (req, res) => {
  try {
    const today = indiaDate();
    const promotions = await Promotion.find({ owner: req.user.id }).sort({ active: -1, createdAt: -1 }).populate('properties', 'name').lean();
    const pending = await Quotation.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.id), status: { $in: ['sent', 'viewed', 'accepted'] }, 'promotion.promotion': { $ne: null } } },
      { $group: { _id: '$promotion.promotion', count: { $sum: 1 } } }
    ]);
    const pendingById = new Map(pending.map(row => [String(row._id), row.count]));
    res.json(promotions.map(promo => ({ ...promo, state: promotionState(promo, today), openQuotes: pendingById.get(String(promo._id)) || 0 })));
  } catch (err) { fail(res, err); }
});

router.post('/promotions', async (req, res) => {
  try {
    const values = await parsePromotion(req.user.id, req.body || {});
    const promo = await Promotion.create({ ...values, owner: req.user.id, createdBy: req.user.id });
    res.status(201).json(await Promotion.findById(promo._id).populate('properties', 'name').lean());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'You already have a promotion with this code.' });
    fail(res, err);
  }
});

router.patch('/promotions/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid promotion ID.');
    const promo = await Promotion.findOne({ _id: req.params.id, owner: req.user.id });
    if (!promo) throw new HttpError(404, 'Promotion not found in your account.');
    const body = req.body || {};
    if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
      promo.active = body.active;
    } else {
      const current = promo.toObject();
      const values = await parsePromotion(req.user.id, { ...current, properties: current.properties.map(String), ...body });
      if (values.code !== promo.code && promo.usedCount > 0) throw new HttpError(409, 'This code has already been used. Create a new promotion instead of renaming it.');
      Object.assign(promo, values);
    }
    await promo.save();
    res.json(await Promotion.findById(promo._id).populate('properties', 'name').lean());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'You already have a promotion with this code.' });
    fail(res, err);
  }
});

module.exports = router;
