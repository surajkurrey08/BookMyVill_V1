const express = require('express');
const mongoose = require('mongoose');
const accountAuth = require('../middleware/accountAuth');
const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const CustomerHold = require('../models/CustomerHold');
const Booking = require('../models/Booking');
const User = require('../models/User');
const AddOn = require('../models/AddOn');
const inventory = require('../services/inventory');
const paymentGateway = require('../services/paymentGateway');
const { priceQuote } = require('../services/quotePricing');
const { PUBLIC_LISTING } = require('../services/publicViews');
const { guideOffer } = require('../services/guides');
const { findPromotionByCode, promotionRuleFailure, guestRuleFailure, redeemPromotion } = require('../services/promotions');
const { validId, stayNights, indiaDate, cleanText, cleanMultiline, validEmail, validPhone, phoneKey, HttpError, sendError } = require('../utils/validate');

const router = express.Router();
const fail = (res, error) => sendError(res, error, 'Customer booking');
const HOLD_MS = 10 * 60 * 1000;
const PAYMENT_MS = 20 * 60 * 1000;
// "Pay advance" checkout option: this share online, the rest at the villa.
const ADVANCE_PERCENT = 30;

function datesFor(checkIn, checkOut) {
  const dates = stayNights(checkIn, checkOut, 365);
  if (!dates || checkIn < indiaDate()) throw new HttpError(400, 'Choose future dates for a stay of 1–365 nights.');
  return dates;
}

async function publicProperty(id) {
  if (!validId(id)) throw new HttpError(404, 'Property not found.');
  const property = await Property.findOne({ _id: id, ...PUBLIC_LISTING });
  if (!property) throw new HttpError(404, 'This property is not available for booking.');
  return property;
}

// Assigned local guide for a confirmed booking: shown to the guest only once the team assigns one.
async function guideContact(booking) {
  if (!booking.guide?.requested) return null;
  const assigned = booking.guide.assigned && await require('../models/LocalGuide').findById(booking.guide.assigned).select('name phone languages').lean();
  return { days: booking.guide.days, assigned: assigned ? { name: assigned.name, phone: assigned.phone, languages: assigned.languages || [] } : null };
}

// Caretaker contact for a guest with a confirmed booking only (never on public pages).
function caretakerContact(property) {
  const handover = property?.handover;
  if (handover?.caretakerPhone) return { name: handover.caretakerName || 'Villa caretaker', phone: handover.caretakerPhone };
  const assigned = property?.assignedCaretaker;
  return assigned?.phone ? { name: assigned.name || 'Villa caretaker', phone: assigned.phone } : null;
}

async function activeHold(userId, id) {
  if (!validId(id)) throw new HttpError(404, 'Room hold not found.');
  const hold = await CustomerHold.findOne({ _id: id, user: userId });
  if (!hold) throw new HttpError(404, 'Room hold not found in your account.');
  if (!['held', 'payment_pending'].includes(hold.status) || hold.expiresAt <= new Date()) throw new HttpError(410, 'This room hold has expired. Select an available room again.');
  const dates = datesFor(hold.checkIn, hold.checkOut);
  if (await inventory.activeHoldCount(hold._id) !== dates.length) throw new HttpError(410, 'This room hold is no longer available. Select a room again.');
  const [property, room] = await Promise.all([publicProperty(String(hold.property)), Room.findOne({ _id: hold.room, property: hold.property, active: true })]);
  if (!room) throw new HttpError(409, 'This room is no longer offered.');
  return { hold, property, room, dates };
}

async function catalog(property) {
  return AddOn.find({ owner: property.owner, active: true, $or: [{ property: property._id }, { property: null }] })
    .select('_id name description category pricingUnit price taxRate maxQuantity').sort({ name: 1 }).lean();
}

async function calculate({ hold, property, room, dates }, body, user) {
  const selected = Array.isArray(body.addOns) ? body.addOns : [];
  if (selected.length > 20 || new Set(selected.map(item => String(item?.addOnId))).size !== selected.length) throw new HttpError(400, 'Choose each add-on only once.');
  const offered = await catalog(property);
  const addOns = selected.map(item => {
    const addon = offered.find(value => String(value._id) === String(item?.addOnId));
    if (!addon) throw new HttpError(409, 'An add-on is no longer available for this property.');
    const quantity = Number(item.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > (addon.maxQuantity || 100)) throw new HttpError(400, `Choose a valid quantity for ${addon.name}.`);
    const perGuest = addon.pricingUnit === 'per_guest' || addon.pricingUnit === 'per_guest_per_night';
    return { addOnId: addon._id, name: addon.name, unitPrice: addon.price, pricingUnit: addon.pricingUnit, quantity: perGuest ? hold.guests : quantity, taxRate: addon.taxRate || 0 };
  });
  let promotion = null;
  const code = cleanText(body.promoCode || '', 20);
  if (code === null) throw new HttpError(400, 'Promo code is too long.');
  if (code) {
    promotion = await findPromotionByCode(property.owner, code);
    if (!promotion) throw new HttpError(400, 'Promo code was not found.');
    const failure = promotionRuleFailure(promotion, { propertyId: property._id, today: indiaDate(), checkIn: hold.checkIn, nights: dates.length, accommodationAmount: room.baseRate * dates.length, guests: hold.guests })
      || await guestRuleFailure(promotion, { owner: property.owner, guestPhoneKey: phoneKey(user.phone || ''), guestEmail: user.email || '' });
    if (failure) throw new HttpError(400, failure);
    if (promotion.maxUsesPerGuest) {
      const identifiers = [{ 'guest.phoneKey': phoneKey(user.phone || '') }, { 'guest.email': String(user.email || '').toLowerCase() }].filter(item => Object.values(item)[0]);
      if (identifiers.length && await Booking.countDocuments({ promotion: promotion._id, paymentStatus: 'paid', $or: identifiers }) >= promotion.maxUsesPerGuest) throw new HttpError(400, `${promotion.code} has reached its per-guest usage limit.`);
    }
  }
  const paymentPlan = body.paymentPlan === 'advance' ? 'advance' : 'full';
  // Optional local guide, charged per day (1 day up to the number of nights).
  const offer = await guideOffer(property);
  const guideDays = body.guideDays === undefined || body.guideDays === null || body.guideDays === '' ? 0 : Number(body.guideDays);
  if (!Number.isInteger(guideDays) || guideDays < 0 || guideDays > dates.length) throw new HttpError(400, `Choose a local guide for 1–${dates.length} day${dates.length === 1 ? '' : 's'}, or none.`);
  if (guideDays && !offer) throw new HttpError(409, 'A local guide is not available for this villa right now.');
  const guide = guideDays ? { days: guideDays, dailyRate: offer.dailyRate, amount: offer.dailyRate * guideDays } : null;
  const fees = guide ? [{ label: `Local guide · ${guideDays} day${guideDays === 1 ? '' : 's'}`, amount: guide.amount, taxRate: 0 }] : [];
  const priced = priceQuote({ nights: dates.length, nightlyRate: room.baseRate, addOns, fees, promotion, taxMode: 'none', checkIn: hold.checkIn, today: indiaDate(), advancePercent: paymentPlan === 'advance' ? ADVANCE_PERCENT : 100 });
  return {
    nights: dates.length, nightlyRate: room.baseRate, addOns: priced.addOnLines,
    accommodation: priced.totals.accommodation, discount: priced.totals.discount,
    tax: priced.totals.tax, securityDeposit: 0, total: priced.totals.total,
    amountDueNow: priced.schedule.advanceAmount, balance: priced.schedule.balanceAmount,
    paymentPlan, advancePercent: ADVANCE_PERCENT,
    guide, guideOption: offer ? { dailyRate: offer.dailyRate, maxDays: dates.length } : null,
    promoCode: promotion?.code || '', promotionId: promotion?._id || null,
    cancellationPolicy: room.cancellationPolicy || 'Contact the property for its cancellation terms before paying.'
  };
}

// Search support: public properties that have bookable units but none free for
// these dates and guests (every unit is booked, held, blocked, not ready or too
// small). Listings with no units configured are left out rather than hidden.
router.get('/availability', async (req, res) => {
  try {
    const dates = datesFor(req.query.checkIn, req.query.checkOut);
    const guests = Number(req.query.guests || 2);
    if (!Number.isInteger(guests) || guests < 1 || guests > 50) throw new HttpError(400, 'Choose 1–50 guests.');
    const properties = await Property.find(PUBLIC_LISTING).select('_id bookingMode').lean();
    const ids = properties.map(p => p._id);
    const entire = new Set(properties.filter(p => p.bookingMode === 'ENTIRE').map(p => String(p._id)));
    const [units, nights] = await Promise.all([
      Room.find({ property: { $in: ids }, active: true }).select('_id property capacity operationalStatus').lean(),
      RoomNight.find({ property: { $in: ids }, date: { $in: dates }, ...inventory.activeNightFilter() }).select('room property').lean()
    ]);
    const taken = new Set(nights.map(n => String(n.room)));
    const takenVillas = new Set(nights.filter(n => entire.has(String(n.property))).map(n => String(n.property)));
    const withUnits = new Set(units.map(u => String(u.property)));
    const unitCounts = new Map();
    for (const unit of units) unitCounts.set(String(unit.property), (unitCounts.get(String(unit.property)) || 0) + 1);
    const free = new Set(units.filter(u => unitCounts.get(String(u.property)) === 1 && u.capacity >= guests && (u.operationalStatus || 'ready') === 'ready' && !taken.has(String(u._id)) && !takenVillas.has(String(u.property))).map(u => String(u.property)));
    res.set('Cache-Control', 'no-store');
    res.json({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests, unavailable: [...withUnits].filter(id => !free.has(id)) });
  } catch (error) { fail(res, error); }
});

router.get('/properties/:propertyId/rooms', async (req, res) => {
  try {
    const property = await publicProperty(req.params.propertyId);
    const dates = datesFor(req.query.checkIn, req.query.checkOut);
    const guests = Number(req.query.guests || 2);
    if (!Number.isInteger(guests) || guests < 1 || guests > 50) throw new HttpError(400, 'Choose 1–50 guests.');
    const availability = await require('../services/availability').calendar(property._id, dates);
    const active = availability.rooms.filter(room => room.active !== false);
    const rooms = active.length === 1 ? active : [];
    res.set('Cache-Control', 'no-store');
    res.json({ property: { _id: property._id, name: property.name, location: property.location, photos: property.photos, amenities: property.amenities, price: property.price }, checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests, nights: dates.length,
      rooms: rooms.map(room => ({ _id: room._id, name: room.name, type: room.type, capacity: room.capacity, baseRate: room.baseRate, number: room.number,
        bedType: room.bedType, view: room.view, sizeSqFt: room.sizeSqFt, photos: room.photos, amenities: room.amenities, cancellationPolicy: room.cancellationPolicy,
          status: guests > room.capacity ? 'capacity_exceeded' : room.days.find(day => day.status !== 'available')?.status || 'available' })) });
  } catch (error) { fail(res, error); }
});

router.get('/properties/:propertyId/add-ons', async (req, res) => {
  try { res.json(await catalog(await publicProperty(req.params.propertyId))); }
  catch (error) { fail(res, error); }
});

router.use(accountAuth, (req,res,next) => req.user.role === 'user' ? next() : res.status(403).json({ msg: 'Customer account required.' }));

router.post('/holds', async (req, res) => {
  let hold;
  try {
    const property = await publicProperty(req.body?.propertyId);
    const room = validId(req.body?.roomId) && await Room.findOne({ _id: req.body.roomId, property: property._id, active: true });
    if (!room) throw new HttpError(404, 'This room is not available.');
    if (await Room.countDocuments({ property: property._id, active: true }) !== 1) throw new HttpError(409, 'Online booking opens once this property is set up for whole-villa stays.');
    const dates = datesFor(req.body.checkIn, req.body.checkOut);
    const guests = Number(req.body.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > room.capacity) throw new HttpError(400, `This room allows up to ${room.capacity} guests.`);
    hold = await CustomerHold.create({ user: req.user.id, property: property._id, room: room._id, checkIn: req.body.checkIn, checkOut: req.body.checkOut, guests, expiresAt: new Date(Date.now() + HOLD_MS) });
    await inventory.reserveNights(room, dates, 'hold', hold._id, { expiresAt: hold.expiresAt, reason: 'Customer checkout', conflictMessage: 'This room was just selected by another guest. Choose another available room.' });
    res.status(201).json({ holdId: hold._id, expiresAt: hold.expiresAt, room, property: { _id: property._id, name: property.name, location: property.location, photos: property.photos }, checkIn: hold.checkIn, checkOut: hold.checkOut, guests });
  } catch (error) {
    if (hold) { await inventory.releaseHolds(hold._id); await CustomerHold.deleteOne({ _id: hold._id }); }
    fail(res, error);
  }
});

router.get('/holds/:id', async (req, res) => {
  try {
    const { hold, property, room, dates } = await activeHold(req.user.id, req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json({ holdId: hold._id, status: hold.status, expiresAt: hold.expiresAt, property: { _id: property._id, name: property.name, location: property.location, photos: property.photos, amenities: property.amenities, bookingMode: property.bookingMode }, room, checkIn: hold.checkIn, checkOut: hold.checkOut, guests: hold.guests, nights: dates.length });
  } catch (error) { fail(res, error); }
});

router.delete('/holds/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Room hold not found.');
    const hold = await CustomerHold.findOneAndUpdate({ _id: req.params.id, user: req.user.id, status: 'held' }, { $set: { status: 'released' } });
    if (!hold) throw new HttpError(409, 'This room hold cannot be released now.');
    await inventory.releaseHolds(hold._id);
    res.json({ msg: 'Room hold released.' });
  } catch (error) { fail(res, error); }
});

router.post('/holds/:id/price', async (req, res) => {
  try {
    const context = await activeHold(req.user.id, req.params.id);
    if (context.hold.status === 'payment_pending' && context.hold.booking) {
      const booking = await Booking.findById(context.hold.booking);
      if (!booking) throw new HttpError(409, 'Payment booking is unavailable. Contact support.');
      return res.json({ nights: context.dates.length, nightlyRate: context.room.baseRate,
        addOns: (booking.lineItems || []).filter(item => item.kind === 'addon').map(item => ({ name: item.label, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })),
        accommodation: (booking.lineItems || []).find(item => item.kind === 'accommodation')?.amount || 0,
        discount: booking.discountAmount || 0, tax: booking.taxAmount || 0, securityDeposit: booking.securityDepositAmount || 0,
        total: booking.totalPrice, amountDueNow: booking.onlineAmount ?? booking.totalPrice, balance: booking.balanceDue || 0,
        paymentPlan: booking.paymentPlan || 'full', advancePercent: ADVANCE_PERCENT, cancellationPolicy: booking.cancellationPolicy,
        guide: booking.guide?.requested ? { days: booking.guide.days, dailyRate: booking.guide.dailyRate, amount: booking.guide.amount } : null, guideOption: null });
    }
    const user = await User.findById(req.user.id).select('email phone');
    res.set('Cache-Control', 'no-store');
    res.json(await calculate(context, req.body || {}, user || {}));
  } catch (error) { fail(res, error); }
});

router.post('/holds/:id/pay', async (req, res) => {
  let locked = false;
  try {
    if (!paymentGateway.available()) throw new HttpError(503, 'Online payment is not configured. No booking has been confirmed.');
    const context = await activeHold(req.user.id, req.params.id);
    if (context.hold.status === 'payment_pending' && context.hold.booking && context.hold.orderId) {
      const existing = await Booking.findOne({ _id: context.hold.booking, user: req.user.id, status: 'pending', paymentStatus: 'pending' });
      if (!existing) throw new HttpError(409, 'This payment has changed. Open My Trips for its latest status.');
      return res.json({ order_id: context.hold.orderId, amount: (existing.onlineAmount ?? existing.totalPrice) * 100, currency: 'INR', key_id: paymentGateway.keyId(), bookingId: existing._id, holdExpiresAt: context.hold.expiresAt });
    }
    const guestName = cleanText(req.body?.guest?.name, 100);
    const guestPhone = cleanText(req.body?.guest?.phone, 20);
    const guestEmail = cleanText(req.body?.guest?.email, 120);
    const arrivalTime = cleanText(req.body?.guest?.arrivalTime || '', 40);
    const idType = cleanText(req.body?.guest?.idType || '', 40);
    const idNumber = cleanText(req.body?.guest?.idNumber || '', 40);
    const specialRequests = cleanMultiline(req.body?.guest?.specialRequests || '', 500);
    if (!guestName || guestName.length < 2 || !validPhone(guestPhone) || !validEmail(guestEmail) || !idType || !idNumber || [arrivalTime, idType, idNumber, specialRequests].some(value => value === null)) throw new HttpError(400, 'Enter valid guest name, mobile number, email and ID details.');
    const user = await User.findById(req.user.id).select('email phone');
    const pricing = await calculate(context, req.body || {}, { ...(user?.toObject() || {}), email: guestEmail, phone: guestPhone });
    if (pricing.total <= 0) throw new HttpError(409, 'This stay has no payable amount. Contact the property.');
    const until = new Date(Date.now() + PAYMENT_MS);
    const claim = await CustomerHold.updateOne({ _id: context.hold._id, status: 'held', expiresAt: { $gt: new Date() } }, { $set: { status: 'payment_pending', expiresAt: until } });
    if (!claim.modifiedCount) throw new HttpError(409, 'This room hold changed. Refresh checkout.');
    locked = true;
    await RoomNight.updateMany({ kind: 'hold', reference: context.hold._id }, { $max: { expiresAt: until } });
    if (await inventory.activeHoldCount(context.hold._id) !== context.dates.length) throw new HttpError(409, 'The room hold expired while payment was starting. Select the room again.');
    const order = await paymentGateway.createOrder({ amountPaise: pricing.amountDueNow * 100, receipt: `bmv_${String(context.hold._id).slice(-16)}`, notes: { hold: String(context.hold._id) } });
    const booking = await Booking.create({ user: req.user.id, property: context.property._id, room: context.room._id,
      guest: { name: guestName, phone: guestPhone, phoneKey: phoneKey(guestPhone), email: guestEmail.toLowerCase() },
      guestDetails: { arrivalTime, idType, idLastFour: idNumber.slice(-4), specialRequests },
      checkIn: new Date(`${context.hold.checkIn}T00:00:00.000Z`), checkOut: new Date(`${context.hold.checkOut}T00:00:00.000Z`),
      guests: context.hold.guests, totalPrice: pricing.total, paymentPlan: pricing.paymentPlan, onlineAmount: pricing.amountDueNow, balanceDue: pricing.balance, taxAmount: pricing.tax, discountAmount: pricing.discount,
      promotion: pricing.promotionId, securityDepositAmount: pricing.securityDeposit, cancellationPolicy: pricing.cancellationPolicy,
      lineItems: [{ kind: 'accommodation', label: `${context.room.name} · ${pricing.nights} night${pricing.nights === 1 ? '' : 's'}`, quantity: pricing.nights, unitPrice: pricing.nightlyRate, amount: pricing.accommodation },
        ...pricing.addOns.map(item => ({ kind: 'addon', label: item.name, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount, taxRate: item.taxRate, tax: item.tax })),
        ...(pricing.guide ? [{ kind: 'fee', label: 'Local guide', quantity: pricing.guide.days, unitPrice: pricing.guide.dailyRate, amount: pricing.guide.amount }] : [])],
      ...(pricing.guide && { guide: { requested: true, days: pricing.guide.days, dailyRate: pricing.guide.dailyRate, amount: pricing.guide.amount } }),
      razorpayOrderId: order.id, status: 'pending', paymentStatus: 'pending', source: 'website',
      actionHistory: [{ action: 'Payment Started', performedBy: `Traveler (${req.user.id})`, targetUser: 'Property Owner', reason: `Room ${context.room.number} held for checkout.` }] });
    await CustomerHold.updateOne({ _id: context.hold._id }, { $set: { booking: booking._id, orderId: order.id } });
    res.json({ order_id: order.id, amount: order.amount, currency: 'INR', key_id: paymentGateway.keyId(), bookingId: booking._id, holdExpiresAt: until });
  } catch (error) {
    if (locked) {
      const retryUntil = new Date(Date.now() + HOLD_MS);
      const reset = await CustomerHold.updateOne({ _id: req.params.id, booking: null }, { $set: { status: 'held', expiresAt: retryUntil } });
      if (reset.modifiedCount) await RoomNight.updateMany({ kind: 'hold', reference: req.params.id }, { $set: { expiresAt: retryUntil } });
    }
    fail(res, error);
  }
});

router.post('/holds/:id/verify', async (req, res) => {
  let claimed = false;
  let verificationLease;
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Room hold not found.');
    const hold = await CustomerHold.findOne({ _id: req.params.id, user: req.user.id });
    if (!hold?.booking || !hold.orderId) throw new HttpError(404, 'Payment order not found.');
    const booking = await Booking.findOne({ _id: hold.booking, user: req.user.id, razorpayOrderId: hold.orderId });
    if (!booking) throw new HttpError(404, 'Booking not found.');
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (orderId !== hold.orderId || typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !paymentGateway.validSignature(orderId, paymentId, signature)) throw new HttpError(400, 'Payment details could not be verified.');
    if (booking.status === 'confirmed' && booking.paymentStatus === 'paid' && booking.razorpayPaymentId === paymentId) return res.json({ bookingId: booking._id, status: booking.status });
    const payment = await paymentGateway.fetchPayment(paymentId);
    if (payment.order_id !== orderId || payment.status !== 'captured' || payment.currency !== 'INR' || payment.amount !== (booking.onlineAmount ?? booking.totalPrice) * 100) throw new HttpError(409, 'Payment is not captured for this booking.');
    if (booking.paymentStatus === 'paid') throw new HttpError(409, 'Payment is already recorded. Contact support for room conflict or refund review.');
    if (booking.status !== 'pending') {
      await Booking.updateOne({ _id: booking._id, paymentStatus: 'pending' }, { $set: { paymentStatus: 'paid', razorpayPaymentId: paymentId, paymentSource: 'razorpay', paymentMode: paymentGateway.mode(), paidAt: new Date() }, $push: { actionHistory: { action: 'Payment Captured After Cancellation', performedBy: 'Payment Verification', reason: 'Refund review required; no room was reserved.' } } });
      await inventory.releaseHolds(hold._id);
      throw new HttpError(409, 'Captured payment requires refund review. Cancelled booking remains cancelled.');
    }
    verificationLease = new Date(Date.now() + 120000);
    const claim = await Booking.updateOne({ _id: booking._id, status: 'pending', paymentStatus: 'pending', $or: [{ paymentVerification: null }, { paymentVerification: { $lte: new Date() } }] }, { $set: { paymentVerification: verificationLease } });
    if (!claim.modifiedCount) throw new HttpError(409, 'Payment verification is in progress. Refresh My Trips.');
    claimed = true;
    const room = await Room.findById(booking.room);
    const dates = stayNights(hold.checkIn, hold.checkOut, 365);
    if (!room || !dates) throw new HttpError(409, 'The selected room could not be verified. Contact support with your payment ID.');
    try { await inventory.convertHoldToBooking(room, dates, hold._id, booking._id); }
    catch (error) {
      await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'paid', razorpayPaymentId: paymentId, paymentSource: 'razorpay', paymentMode: paymentGateway.mode(), paidAt: new Date() }, $push: { actionHistory: { action: 'Payment Captured – Room Conflict', performedBy: 'Razorpay Payment Verification', targetUser: `Booking ${booking._id}`, reason: 'Room conflict requires support and refund review.' } } });
      throw new HttpError(409, 'Payment was captured but the room could not be secured. Contact support with your payment ID; your booking is not confirmed.');
    }
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: 'pending', paymentStatus: 'pending' }, { $set: { status: 'confirmed', paymentStatus: 'paid', razorpayPaymentId: paymentId, paymentSource: 'razorpay', paymentMode: paymentGateway.mode(), paidAt: new Date() }, $push: { actionHistory: { action: 'Payment Captured & Stay Confirmed', performedBy: 'Razorpay Payment Verification', targetUser: `Booking ${booking._id}`, reason: 'Payment and room inventory verified.' } } }, { new: true });
    if (!updated) {
      const latest = await Booking.findById(booking._id);
      if (latest?.status === 'cancelled') {
        await inventory.releaseBookingNights(booking._id);
        await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'paid', razorpayPaymentId: paymentId, paidAt: new Date() }, $push: { actionHistory: { action: 'Refund Review Required', performedBy: 'Payment Verification', reason: 'Cancellation occurred during capture.' } } });
      }
      throw new HttpError(409, 'Booking changed. Contact support for payment review.');
    }
    await CustomerHold.updateOne({ _id: hold._id }, { $set: { status: 'confirmed' } });
    if (booking.promotion && booking.discountAmount > 0) {
      try {
        const property = await Property.findById(room.property).select('owner');
        if (property) await redeemPromotion(property.owner, booking.promotion, booking.discountAmount, { force: true });
      } catch (error) { console.error('Confirmed booking promotion accounting notice:', error); }
    }
    res.json({ bookingId: updated._id, status: updated.status });
   } catch (error) { fail(res, error); } finally {
    if (claimed) { const hold = await CustomerHold.findOne({ _id: req.params.id, user: req.user.id }); if (hold?.booking) await Booking.updateOne({ _id: hold.booking, paymentVerification: verificationLease }, { $unset: { paymentVerification: 1 } }); }
  }
});

router.get('/bookings/:id/confirmation', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Booking not found.');
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id }).populate('property', 'name location photos amenities mapLink stayInfo assignedCaretaker owner +handover').populate('room', 'name type number capacity baseRate');
    if (!booking || booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') throw new HttpError(404, 'Confirmed booking not found in your account.');
    const view = require('../services/publicViews').customerBooking(booking);
    res.set('Cache-Control', 'no-store');
    res.json({ booking: view, amountPaid: booking.onlineAmount ?? booking.totalPrice, remainingBalance: booking.balanceCollectedAt ? 0 : booking.balanceDue || 0, paymentPlan: booking.paymentPlan || 'full', caretaker: caretakerContact(booking.property), guide: await guideContact(booking) });
  } catch (error) { fail(res, error); }
});

router.post('/bookings/:id/precheckin', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Booking not found.');
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id, status: 'confirmed', paymentStatus: 'paid' });
    if (!booking) throw new HttpError(404, 'Confirmed booking not found in your account.');
    if (booking.stayStatus === 'checked_out') throw new HttpError(409, 'This stay has completed.');
    const update = {};
    if (req.body?.arrivalTime !== undefined) {
      const value = cleanText(req.body.arrivalTime, 40);
      if (value === null) throw new HttpError(400, 'Arrival time is too long.');
      update['guestDetails.arrivalTime'] = value;
    }
    if (req.body?.additionalGuests !== undefined) {
      if (!Array.isArray(req.body.additionalGuests) || req.body.additionalGuests.length > Math.max(0, booking.guests - 1)) throw new HttpError(400, 'Too many additional guests.');
      const names = req.body.additionalGuests.map(value => cleanText(value, 100));
      if (names.some(value => !value || value.length < 2)) throw new HttpError(400, 'Enter each additional guest’s full name.');
      update['guestDetails.additionalGuests'] = names;
    }
    if (req.body?.idProof !== undefined) {
      const proof = req.body.idProof;
      if (typeof proof !== 'string' || proof.length > 2000000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(proof)) throw new HttpError(400, 'Upload a JPG, PNG or WebP image under 1.4 MB.');
      update['guestDetails.idProof'] = proof;
    }
    if (!Object.keys(update).length) throw new HttpError(400, 'Add pre check-in information first.');
    const updated = await Booking.findByIdAndUpdate(booking._id, { $set: update }, { new: true });
    res.json({ guestDetails: { arrivalTime: updated.guestDetails.arrivalTime, additionalGuests: updated.guestDetails.additionalGuests, idUploaded: Boolean(updated.guestDetails.idProof) } });
  } catch (error) { fail(res, error); }
});

module.exports = router;
