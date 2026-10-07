const repo = require('../repositories/catalogRepository');
const clients = require('../clients');
const { parseAddOn, parsePromotion } = require('../validators/catalogValidators');
const { promotionRuleFailure, promotionState } = require('./promotionRules');
const { validId, indiaDate, HttpError } = require('../../../../utils/validate');

// coupon-service business rules: owners manage add-ons and promotions; other
// services read offers and count promotion uses through the internal API.

const selection = (owner, requestId) => ids => clients.ownerSelection(owner, Array.isArray(ids) ? ids : [], requestId);

// Replaces property ids with { _id, name } (the shape the owner panel shows).
async function withVillaNames(rows, requestId) {
  const ids = [...new Set(rows.flatMap(row => [row.property, ...(row.properties || [])]).filter(Boolean).map(String))];
  const names = new Map((await clients.villaNames(ids, requestId)).map(v => [String(v._id), v]));
  const named = id => (id ? names.get(String(id)) || { _id: String(id), name: '' } : null);
  return rows.map(row => ({ ...row, ...('property' in row && { property: named(row.property) }), ...(row.properties && { properties: row.properties.map(named) }) }));
}
const oneWithNames = async (row, requestId) => (await withVillaNames([row], requestId))[0];

// ---------------------------------------------------------------- add-ons

async function listAddOns(user, query, requestId) {
  const filter = { owner: user.id };
  if (query.includeInactive !== '1') filter.active = true;
  if (query.propertyId) {
    if (!validId(query.propertyId)) throw new HttpError(400, 'Invalid property filter.');
    filter.$or = [{ property: null }, { property: query.propertyId }];
  }
  return withVillaNames(await repo.addOns.list(filter), requestId);
}

async function createAddOn(user, body, requestId) {
  const values = parseAddOn(body);
  const [property = null] = await selection(user.id, requestId)(body.propertyId ? [body.propertyId] : []);
  const addOn = await repo.addOns.create({ ...values, property, owner: user.id, createdBy: user.id });
  return oneWithNames(await repo.addOns.byId(addOn._id), requestId);
}

async function ownedAddOn(user, id, requestId) {
  if (!validId(id)) throw new HttpError(400, 'Invalid add-on ID.');
  const addOn = await repo.addOns.one({ _id: id, owner: user.id });
  if (!addOn) throw new HttpError(404, 'Add-on not found in your account.');
  await selection(user.id, requestId)(addOn.property ? [addOn.property] : []);
  return addOn;
}

async function updateAddOn(user, id, body, requestId) {
  const addOn = await ownedAddOn(user, id, requestId);
  // Toggling availability alone is the common case; keep it cheap.
  if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
    addOn.active = body.active;
  } else {
    Object.assign(addOn, parseAddOn({ ...addOn.toObject(), ...body }));
    if (body.propertyId !== undefined) {
      const [property = null] = await selection(user.id, requestId)(body.propertyId ? [body.propertyId] : []);
      addOn.property = property;
    }
  }
  await addOn.save();
  return oneWithNames(await repo.addOns.byId(addOn._id), requestId);
}

async function deleteAddOn(user, id, requestId) {
  const addOn = await ownedAddOn(user, id, requestId);
  if (await clients.addOnInUse(user.id, addOn._id, requestId)) {
    throw new HttpError(409, 'This add-on appears on quotations. Pause it instead so past quotes keep their history.');
  }
  await repo.addOns.remove({ _id: addOn._id, owner: user.id });
}

// ------------------------------------------------------------- promotions

async function listPromotions(user, requestId) {
  const today = indiaDate();
  const [promotions, pending] = await Promise.all([repo.promotions.list({ owner: user.id }), clients.openPromotionQuotes(user.id, requestId)]);
  const pendingById = new Map(pending.map(row => [String(row.promotion), row.count]));
  return (await withVillaNames(promotions, requestId)).map(promo => ({ ...promo, state: promotionState(promo, today), openQuotes: pendingById.get(String(promo._id)) || 0 }));
}

const duplicateCode = err => { if (err.code === 11000) throw new HttpError(409, 'You already have a promotion with this code.'); throw err; };

async function createPromotion(user, body, requestId) {
  const values = await parsePromotion(body, selection(user.id, requestId));
  const promo = await repo.promotions.create({ ...values, owner: user.id, createdBy: user.id }).catch(duplicateCode);
  return oneWithNames(await repo.promotions.byId(promo._id), requestId);
}

async function updatePromotion(user, id, body, requestId) {
  if (!validId(id)) throw new HttpError(400, 'Invalid promotion ID.');
  const promo = await repo.promotions.one({ _id: id, owner: user.id });
  if (!promo) throw new HttpError(404, 'Promotion not found in your account.');
  await selection(user.id, requestId)(promo.properties);
  if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
    promo.active = body.active;
  } else {
    const current = promo.toObject();
    const values = await parsePromotion({ ...current, properties: current.properties.map(String), ...body }, selection(user.id, requestId));
    if (values.code !== promo.code && promo.usedCount > 0) throw new HttpError(409, 'This code has already been used. Create a new promotion instead of renaming it.');
    Object.assign(promo, values);
  }
  await promo.save().catch(duplicateCode);
  return oneWithNames(await repo.promotions.byId(promo._id), requestId);
}

// ------------------------------------------------------- internal (services)

const OFFER_FIELDS = '_id name description category pricingUnit price taxRate maxQuantity';

// Active add-ons a guest can pick for a villa (checkout).
function offeredAddOns({ owner, property }) {
  if (!validId(owner) || !validId(property)) throw new HttpError(400, 'Invalid add-on request.');
  return repo.addOns.find({ owner, active: true, $or: [{ property }, { property: null }] }, OFFER_FIELDS);
}

// Specific add-ons of an owner, active or not (quotations validate them).
function addOnsByIds({ owner, ids }) {
  const list = String(ids || '').split(',').filter(Boolean);
  if (!validId(owner) || list.some(id => !validId(id))) throw new HttpError(400, 'Invalid add-on request.');
  return list.length ? repo.addOns.find({ owner, _id: { $in: list } }) : [];
}

// Looks a code up and applies the stay rules. { promotion: null } = not found.
async function evaluatePromotion({ owner, code, propertyId, today, checkIn, nights, accommodationAmount, guests }) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!validId(owner) || !/^[A-Z0-9_-]{3,20}$/.test(normalized)) return { promotion: null, failure: null };
  const promotion = await repo.promotions.byCode(owner, normalized);
  if (!promotion) return { promotion: null, failure: null };
  return { promotion, failure: promotionRuleFailure(promotion, { propertyId, today: today || indiaDate(), checkIn, nights, accommodationAmount, guests }) };
}

// Counts one use (quotation conversion). `force` honours a price the guest has
// already paid even if the limit was reached in the meantime.
async function redeem(id, { owner, discount = 0, force = false }) {
  if (!validId(id) || !validId(owner)) throw new HttpError(400, 'Invalid promotion.');
  const result = await repo.promotions.redeem(owner, id, Number(discount) || 0, Boolean(force));
  return { redeemed: result.modifiedCount === 1 };
}

// Undo of redeem() when the conversion that used it is rolled back.
async function release(id, { discount = 0 }) {
  if (!validId(id)) throw new HttpError(400, 'Invalid promotion.');
  await repo.promotions.release(id, Number(discount) || 0);
  return { released: true };
}

// booking.confirmed (checkout) -> count the promotion once per booking.
async function redeemForBooking(message) {
  const { bookingId, promotion } = message.data || {};
  if (!bookingId || !promotion?.id || !promotion.owner) return 'skipped';
  try { await repo.redemptions.record({ bookingId: String(bookingId), promotion: promotion.id, discount: promotion.discount || 0, eventId: message.id || '' }); }
  catch (err) { if (err.code === 11000) return 'duplicate'; throw err; }
  await repo.promotions.redeem(promotion.owner, promotion.id, Number(promotion.discount) || 0, true);
  return 'redeemed';
}

module.exports = {
  listAddOns, createAddOn, updateAddOn, deleteAddOn,
  listPromotions, createPromotion, updatePromotion,
  offeredAddOns, addOnsByIds, evaluatePromotion, redeem, release, redeemForBooking
};
