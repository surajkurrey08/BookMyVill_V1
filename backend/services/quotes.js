const crypto = require('crypto');
const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Property = require('../models/Property');
const Room = require('../models/Room');
const AddOn = require('../models/AddOn');
const Booking = require('../models/Booking');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Promotion = require('../models/Promotion');
const inventory = require('./inventory');
const { priceQuote, CANCELLATION_TEXT } = require('./quotePricing');
const { promotionRuleFailure, guestRuleFailure, findPromotionByCode, redeemPromotion } = require('./promotions');
const { logActivity, advanceInquiry } = require('./crm');
const {
  validId, validDate, stayNights, indiaDate, daysBetween, cleanText, cleanMultiline, validPhone, phoneKey, validEmail, intInRange, HttpError
} = require('../utils/validate');

const MAX_QUOTE_NIGHTS = 90;
const HOLD_MAX_MINUTES = 72 * 60;
const VALIDITY_MIN = 15;
const VALIDITY_MAX = 14 * 24 * 60;
const OPEN_FOR_GUEST = ['sent', 'viewed'];
const CONVERTIBLE = ['sent', 'viewed', 'accepted'];

const newPublicToken = () => crypto.randomBytes(32).toString('hex');
const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

function intField(value, min, max, message, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = intInRange(value, min, max);
  if (number === null) throw new HttpError(400, message);
  return number;
}

// Validates a quotation request and prices it. Returns the document fields
// (without owner/code/token/status), plus warnings and night conflicts that
// the owner should see before sending.
async function buildQuote(owner, body = {}, { quoteId = null, dropInvalidPromotion = false } = {}) {
  const warnings = [];
  if (!validId(String(body.propertyId || ''))) throw new HttpError(400, 'Choose a property.');
  const property = await Property.findOne({ _id: body.propertyId, owner }).select('_id name type location');
  if (!property) throw new HttpError(404, 'Property not found in your account.');
  if (!validId(String(body.roomId || ''))) throw new HttpError(400, 'Choose the room or unit to quote.');
  const room = await Room.findOne({ _id: body.roomId, property: property._id });
  if (!room) throw new HttpError(404, 'Room not found at this property.');
  if (!room.active) throw new HttpError(409, 'This room is inactive. Activate it in Rooms & Availability before quoting it.');

  const today = indiaDate();
  const dates = stayNights(body.checkIn, body.checkOut, MAX_QUOTE_NIGHTS);
  if (!dates) throw new HttpError(400, `Choose check-in and check-out dates (1–${MAX_QUOTE_NIGHTS} nights).`);
  if (body.checkIn < today) throw new HttpError(400, 'Check-in date has already passed.');
  const nights = dates.length;

  let inquiry = null;
  if (body.inquiryId) {
    if (!validId(String(body.inquiryId))) throw new HttpError(400, 'Invalid inquiry.');
    inquiry = await Inquiry.findOne({ _id: body.inquiryId, owner }).select('_id guestName guestPhone guestEmail status');
    if (!inquiry) throw new HttpError(404, 'Inquiry not found in your account.');
  }

  const guestName = cleanText(body.guestName ?? inquiry?.guestName, 100);
  if (!guestName) throw new HttpError(400, 'Enter the guest name.');
  const guestPhone = cleanText(body.guestPhone ?? inquiry?.guestPhone ?? '', 20);
  if (guestPhone === null || (guestPhone && !validPhone(guestPhone))) throw new HttpError(400, 'Enter a valid guest phone number.');
  const guestEmail = cleanText(body.guestEmail ?? inquiry?.guestEmail ?? '', 120);
  if (guestEmail === null || (guestEmail && !validEmail(guestEmail))) throw new HttpError(400, 'Enter a valid guest email.');
  if (!guestPhone && !guestEmail) throw new HttpError(400, 'Add the guest phone or email so the quotation can be shared.');

  const adults = intField(body.adults, 0, 50, 'Adults must be 0–50.', 2);
  const children = intField(body.children, 0, 50, 'Children must be 0–50.', 0);
  const infants = intField(body.infants, 0, 20, 'Infants must be 0–20.', 0);
  const pets = intField(body.pets, 0, 10, 'Pets must be 0–10.', 0);
  const guests = adults + children;
  if (guests < 1) throw new HttpError(400, 'Add at least one adult or child.');
  if (guests > room.capacity) warnings.push(`${guests} guests is above the listed capacity of ${room.name} (${room.capacity}). Add an extra bed or choose a larger unit if needed.`);

  const baseNightlyRate = room.baseRate;
  const nightlyRate = intField(body.nightlyRate, 0, 10000000, 'Nightly rate must be a whole-rupee amount.', baseNightlyRate);
  if (nightlyRate < baseNightlyRate) warnings.push(`Nightly rate ${rupees(nightlyRate)} is below the base rate of ${rupees(baseNightlyRate)}.`);

  const addOnInputs = Array.isArray(body.addOns) ? body.addOns : [];
  if (addOnInputs.length > 20) throw new HttpError(400, 'A quotation can include up to 20 add-ons.');
  const addOnIds = addOnInputs.map(item => String(item?.addOnId || ''));
  if (addOnIds.some(id => !validId(id)) || new Set(addOnIds).size !== addOnIds.length) throw new HttpError(400, 'Each add-on can be added once.');
  const catalog = addOnIds.length ? await AddOn.find({ _id: { $in: addOnIds }, owner }).lean() : [];
  const addOns = addOnInputs.map(item => {
    const addOn = catalog.find(entry => String(entry._id) === String(item.addOnId));
    if (!addOn) throw new HttpError(404, 'An add-on in this quotation no longer exists.');
    if (!addOn.active) throw new HttpError(409, `${addOn.name} is paused. Remove it or reactivate it in Offers & Add-ons.`);
    if (addOn.property && String(addOn.property) !== String(property._id)) throw new HttpError(409, `${addOn.name} is not offered at ${property.name}.`);
    const perGuest = addOn.pricingUnit === 'per_guest' || addOn.pricingUnit === 'per_guest_per_night';
    const maxQuantity = addOn.maxQuantity || (perGuest ? 50 : 100);
    const quantity = intField(item.quantity, 1, maxQuantity, `${addOn.name}: quantity must be 1–${maxQuantity}.`, perGuest ? guests : 1);
    return { addOn: addOn._id, name: addOn.name, category: addOn.category, pricingUnit: addOn.pricingUnit, unitPrice: addOn.price, quantity, taxRate: addOn.taxRate || 0 };
  });

  const feeInputs = Array.isArray(body.fees) ? body.fees : [];
  if (feeInputs.length > 10) throw new HttpError(400, 'A quotation can include up to 10 extra charges.');
  const fees = feeInputs.map(item => {
    const label = cleanText(item?.label, 80);
    if (!label) throw new HttpError(400, 'Each extra charge needs a label (up to 80 characters).');
    return { label, amount: intField(item.amount, 0, 10000000, `${label}: amount must be a whole-rupee value.`, 0), taxRate: intField(item.taxRate, 0, 28, `${label}: tax rate must be 0–28%.`, 0) };
  });

  const taxMode = body.taxMode || 'none';
  if (!Quotation.TAX_MODES.includes(taxMode)) throw new HttpError(400, 'Choose how tax is applied.');
  const customTaxRate = taxMode === 'custom' ? intField(body.customTaxRate, 0, 28, 'Custom tax rate must be 0–28%.', 0) : 0;

  const manualAmount = intField(body.manualDiscount?.amount, 0, 10000000, 'Extra discount must be a whole-rupee amount.', 0);
  const manualReason = cleanText(body.manualDiscount?.reason, 120);
  if (manualReason === null) throw new HttpError(400, 'Discount reason must be under 120 characters.');
  if (manualAmount > 0 && !manualReason) throw new HttpError(400, 'Add a reason for the extra discount (it is kept for your records).');

  let promotion = null;
  let promotionInfo = { promotion: null, code: '', name: '', discountAmount: 0 };
  const promoCode = cleanText(body.promotionCode, 20);
  if (promoCode) {
    const promo = await findPromotionByCode(owner, promoCode);
    let failure = promo ? promotionRuleFailure(promo, { propertyId: property._id, today, checkIn: body.checkIn, nights, accommodationAmount: nightlyRate * nights, guests }) : `Promotion code ${promoCode.toUpperCase()} was not found.`;
    if (!failure) failure = await guestRuleFailure(promo, { owner, guestPhoneKey: phoneKey(guestPhone), guestEmail, excludeQuotation: quoteId });
    if (failure && !dropInvalidPromotion) throw new HttpError(400, failure);
    if (failure) warnings.push(`${failure} The promotion was removed.`);
    else promotion = promo;
  }

  const securityDeposit = intField(body.securityDeposit, 0, 10000000, 'Security deposit must be a whole-rupee amount.', 0);
  const advancePercent = intField(body.advancePercent, 0, 100, 'Advance must be 0–100%.', 100);
  const balanceDueDaysBeforeCheckIn = intField(body.balanceDueDaysBeforeCheckIn, 0, 60, 'Balance due days must be 0–60.', 0);

  const cancellationPolicy = body.cancellationPolicy || 'moderate';
  if (!Quotation.CANCELLATION_POLICIES.includes(cancellationPolicy)) throw new HttpError(400, 'Choose a cancellation policy.');
  let cancellationText = CANCELLATION_TEXT[cancellationPolicy] || '';
  if (cancellationPolicy === 'custom') {
    cancellationText = cleanMultiline(body.cancellationText, 1200);
    if (!cancellationText || cancellationText.length < 10) throw new HttpError(400, 'Describe the custom cancellation policy (10–1200 characters).');
  }
  const notesToGuest = cleanMultiline(body.notesToGuest, 1000);
  if (notesToGuest === null) throw new HttpError(400, 'Notes to the guest must be under 1000 characters.');
  const internalNotes = cleanMultiline(body.internalNotes, 1000);
  if (internalNotes === null) throw new HttpError(400, 'Internal notes must be under 1000 characters.');

  const validityMinutes = intField(body.validityMinutes, VALIDITY_MIN, VALIDITY_MAX, 'Quote validity must be between 15 minutes and 14 days.', 1440);
  const holdInventory = body.holdInventory === true;
  if (holdInventory && validityMinutes > HOLD_MAX_MINUTES) throw new HttpError(400, 'Rooms can be held for at most 72 hours. Shorten the validity or turn off the hold.');

  const pricing = priceQuote({
    nights, nightlyRate, addOns, fees, promotion, manualDiscount: manualAmount, taxMode, customTaxRate,
    advancePercent, balanceDueDaysBeforeCheckIn, checkIn: body.checkIn, today
  });
  if (promotion) promotionInfo = { promotion: promotion._id, code: promotion.code, name: promotion.name, discountAmount: pricing.promoDiscount };
  if (promotion && pricing.promoDiscount === 0) warnings.push(`${promotion.code} gives no discount on this stay.`);

  const conflicts = await inventory.conflictingNights(room._id, dates, quoteId);
  if (conflicts.length) warnings.push(`${room.name} is not free on ${conflicts.map(night => night.date).join(', ')}.`);

  return {
    values: {
      property: property._id, room: room._id,
      roomSnapshot: { name: room.name, number: room.number, type: room.type, capacity: room.capacity },
      inquiry: inquiry?._id || null,
      guest: { name: guestName, phone: guestPhone, email: guestEmail.toLowerCase() }, guestPhoneKey: phoneKey(guestPhone),
      checkIn: body.checkIn, checkOut: body.checkOut, nights, adults, children, infants, pets,
      nightlyRate, baseNightlyRate, addOns: pricing.addOnLines, fees: pricing.feeLines,
      promotion: promotionInfo, manualDiscount: { amount: manualAmount, reason: manualReason },
      taxMode, customTaxRate, accommodationTaxRate: pricing.accommodationTaxRate, totals: pricing.totals,
      securityDeposit, advancePercent, balanceDueDaysBeforeCheckIn, schedule: pricing.schedule,
      cancellationPolicy, cancellationText, notesToGuest, internalNotes, validityMinutes, holdInventory
    },
    property, room, dates, warnings,
    conflicts: conflicts.map(night => ({ date: night.date, kind: night.kind })),
    pricing: { accommodationTax: pricing.accommodationTax, accommodationNet: pricing.accommodationNet, promoDiscount: pricing.promoDiscount }
  };
}

// Inputs that reproduce a quotation in the builder (used for revisions).
function quoteInputs(quote) {
  return {
    propertyId: String(quote.property?._id || quote.property), roomId: String(quote.room?._id || quote.room),
    inquiryId: quote.inquiry ? String(quote.inquiry._id || quote.inquiry) : undefined,
    guestName: quote.guest.name, guestPhone: quote.guest.phone, guestEmail: quote.guest.email,
    checkIn: quote.checkIn, checkOut: quote.checkOut, adults: quote.adults, children: quote.children, infants: quote.infants, pets: quote.pets,
    nightlyRate: quote.nightlyRate === quote.baseNightlyRate ? undefined : quote.nightlyRate,
    addOns: quote.addOns.map(line => ({ addOnId: String(line.addOn), quantity: line.quantity })),
    fees: quote.fees.map(line => ({ label: line.label, amount: line.amount, taxRate: line.taxRate })),
    promotionCode: quote.promotion?.code || '', manualDiscount: { amount: quote.manualDiscount?.amount || 0, reason: quote.manualDiscount?.reason || '' },
    taxMode: quote.taxMode, customTaxRate: quote.customTaxRate, securityDeposit: quote.securityDeposit,
    advancePercent: quote.advancePercent, balanceDueDaysBeforeCheckIn: quote.balanceDueDaysBeforeCheckIn,
    cancellationPolicy: quote.cancellationPolicy, cancellationText: quote.cancellationPolicy === 'custom' ? quote.cancellationText : undefined,
    notesToGuest: quote.notesToGuest, internalNotes: quote.internalNotes, validityMinutes: quote.validityMinutes, holdInventory: quote.holdInventory
  };
}

// Marks lapsed quotations as expired (lazily, whenever quotes are read) and
// frees their held nights immediately.
async function sweepExpiredQuotes(owner = null) {
  const now = new Date();
  const filter = { status: { $in: OPEN_FOR_GUEST }, validUntil: { $lte: now } };
  if (owner) filter.owner = owner;
  const lapsed = await Quotation.find(filter).select('_id owner inquiry code').limit(200).lean();
  for (const quote of lapsed) {
    const updated = await Quotation.findOneAndUpdate({ _id: quote._id, status: { $in: OPEN_FOR_GUEST }, validUntil: { $lte: now } }, { $set: { status: 'expired', expiredAt: now } });
    if (!updated) continue;
    await inventory.releaseHolds(quote._id);
    await logActivity({ owner: quote.owner, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_expired', actorType: 'system', body: `${quote.code} expired before the guest accepted it.` });
  }
  return lapsed.length;
}

function bookingLineItems(quote) {
  const lines = [{
    kind: 'accommodation', label: `${quote.roomSnapshot?.name || 'Accommodation'} · ${quote.nights} night${quote.nights === 1 ? '' : 's'}`,
    quantity: quote.nights, unitPrice: quote.nightlyRate, amount: quote.totals.accommodation, taxRate: quote.accommodationTaxRate,
    tax: Math.round((quote.totals.accommodation - quote.totals.discount) * quote.accommodationTaxRate / 100)
  }];
  if (quote.totals.discount > 0) {
    const label = [quote.promotion?.code && `Promotion ${quote.promotion.code}`, quote.manualDiscount?.amount > 0 && (quote.manualDiscount.reason || 'Discount')].filter(Boolean).join(' + ');
    lines.push({ kind: 'discount', label: label || 'Discount', quantity: 1, unitPrice: -quote.totals.discount, amount: -quote.totals.discount, taxRate: 0, tax: 0 });
  }
  for (const line of quote.addOns) lines.push({ kind: 'addon', label: line.name, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount, taxRate: line.taxRate, tax: line.tax });
  for (const line of quote.fees) lines.push({ kind: 'fee', label: line.label, quantity: 1, unitPrice: line.amount, amount: line.amount, taxRate: line.taxRate, tax: line.tax });
  return lines;
}

// Turns a quotation into a confirmed booking. Owner conversions need the room
// to be free; a conversion after a captured payment keeps the booking even if
// the room was lost (it is then left unassigned for the owner to resolve).
async function convertQuote(quoteId, { actorType = 'owner', actor = null, payment = null } = {}) {
  const now = new Date();
  // A captured payment must always end in a booking record, even if the quote
  // lapsed or was withdrawn while the guest was paying.
  const allowed = payment ? [...CONVERTIBLE, 'expired', 'withdrawn', 'rejected'] : CONVERTIBLE;
  const lock = await Quotation.findOneAndUpdate(
    { _id: quoteId, status: { $in: allowed }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(+now + 60000) } },
    { new: true }
  );
  if (!lock) {
    const current = await Quotation.findById(quoteId).select('status booking');
    if (current?.status === 'converted') return { booking: await Booking.findById(current.booking), alreadyConverted: true, roomAssigned: true };
    throw new HttpError(409, current && allowed.includes(current.status) ? 'This quotation is being converted right now. Refresh in a moment.' : 'Only a sent, viewed or accepted quotation can be converted.');
  }
  const quote = lock;
  const unlock = () => Quotation.updateOne({ _id: quote._id, status: { $in: allowed } }, { $set: { lockedUntil: null } });
  const owner = quote.owner;
  const bookingId = new mongoose.Types.ObjectId();
  let promotionRedeemed = false;
  let roomAssigned = false;
  let warning = null;
  try {
    if (!payment && quote.checkIn < indiaDate()) throw new HttpError(409, 'The check-in date has passed. Revise the quotation with new dates.');
    if (quote.promotion?.promotion) {
      promotionRedeemed = await redeemPromotion(owner, quote.promotion.promotion, quote.promotion.discountAmount, { force: Boolean(payment) });
      if (!promotionRedeemed) throw new HttpError(409, `Promotion ${quote.promotion.code} has reached its usage limit. Revise the quotation without it.`);
    }
    const room = await Room.findById(quote.room);
    const dates = stayNights(quote.checkIn, quote.checkOut, MAX_QUOTE_NIGHTS);
    try {
      if (!room || !room.active) throw new HttpError(409, 'The quoted room is no longer active.');
      await inventory.convertHoldToBooking(room, dates, quote._id, bookingId);
      roomAssigned = true;
    } catch (err) {
      if (!payment || !(err instanceof HttpError)) throw err;
      await inventory.releaseHolds(quote._id);
      warning = `Payment received, but ${quote.roomSnapshot?.name || 'the quoted room'} could not be secured: ${err.message} Assign another room or arrange a refund.`;
    }

    let user = null;
    if (quote.guest.email) user = await User.findOne({ email: quote.guest.email.toLowerCase(), role: 'user' }).select('_id');
    const actorLabel = actorType === 'guest' ? `Guest (${quote.guest.name})` : actorType === 'system' ? 'Payment verification' : `Property Owner (${actor || owner})`;
    let booking;
    try {
      booking = await Booking.create({
        _id: bookingId, user: user?._id || null,
        guest: { name: quote.guest.name, phone: quote.guest.phone, phoneKey: quote.guestPhoneKey, email: quote.guest.email },
        property: quote.property, room: roomAssigned ? quote.room : null, stayType: 'night',
        guests: Math.min(50, Math.max(1, quote.adults + quote.children)), adults: quote.adults, children: quote.children, infants: quote.infants, pets: quote.pets,
        checkIn: new Date(`${quote.checkIn}T00:00:00.000Z`), checkOut: new Date(`${quote.checkOut}T00:00:00.000Z`),
        totalPrice: quote.totals.total, status: 'confirmed', paymentStatus: payment ? 'paid' : 'pending',
        source: 'quotation', quotation: quote._id, inquiry: quote.inquiry,
        lineItems: bookingLineItems(quote), taxAmount: quote.totals.tax, discountAmount: quote.totals.discount,
        securityDepositAmount: quote.securityDeposit, cancellationPolicy: quote.cancellationText,
        ...(payment ? { razorpayOrderId: payment.orderId, razorpayPaymentId: payment.paymentId, paymentSource: 'razorpay', paymentMode: payment.mode, paidAt: now } : {}),
        actionHistory: [{
          action: 'Booking Created from Quotation', performedBy: actorLabel, targetUser: `Guest (${quote.guest.name})`,
          reason: `${quote.code}: ${quote.nights} night${quote.nights === 1 ? '' : 's'}, total ${rupees(quote.totals.total)}${payment ? ', paid online' : ', payment pending'}.${roomAssigned ? '' : ' Room needs assignment.'}`,
          timestamp: now
        }]
      });
    } catch (err) {
      if (roomAssigned) await inventory.releaseBookingNights(bookingId);
      roomAssigned = false;
      if (payment && err.code === 11000 && err.keyPattern?.razorpayPaymentId) {
        const existing = await Booking.findOne({ razorpayPaymentId: payment.paymentId });
        if (existing) {
          // Duplicate payment callback: the first one already booked the stay.
          if (promotionRedeemed) await Promotion.updateOne({ _id: quote.promotion.promotion }, { $inc: { usedCount: -1, discountGiven: -quote.promotion.discountAmount } });
          promotionRedeemed = false;
          await Quotation.updateOne({ _id: quote._id }, { $set: { status: 'converted', convertedAt: now, booking: existing._id, lockedUntil: null } });
          return { booking: existing, alreadyConverted: true, roomAssigned: Boolean(existing.room) };
        }
      }
      throw err;
    }

    const finalised = await Quotation.findOneAndUpdate({ _id: quote._id, status: { $in: allowed } }, { $set: { status: 'converted', convertedAt: now, booking: booking._id, lockedUntil: null } }, { new: true });
    if (!finalised) {
      // The quote was withdrawn mid-conversion: undo the booking unless money was taken.
      if (!payment) {
        await Booking.deleteOne({ _id: booking._id });
        if (roomAssigned) await inventory.releaseBookingNights(booking._id);
        throw new HttpError(409, 'The quotation changed while converting. Refresh and try again.');
      }
      await Quotation.updateOne({ _id: quote._id }, { $set: { status: 'converted', convertedAt: now, booking: booking._id, lockedUntil: null } });
      warning = [warning, 'The quotation was withdrawn while the guest was paying; the paid booking was kept.'].filter(Boolean).join(' ');
    }
    if (quote.inquiry) {
      await Inquiry.updateOne({ _id: quote.inquiry, owner }, { $set: { booking: booking._id } });
      await advanceInquiry({ owner, inquiryId: quote.inquiry, target: 'booked', actorType: actorType === 'owner' ? 'owner' : 'system', actor, reason: `Booked through ${quote.code}.` });
    }
    await logActivity({
      owner, inquiry: quote.inquiry, quotation: quote._id, booking: booking._id, type: 'quote_converted', actorType, actor,
      body: `${quote.code} converted into a confirmed booking (${rupees(quote.totals.total)}, ${payment ? 'paid online' : 'payment pending'}).${warning ? ` ${warning}` : ''}`
    });
    if (payment) await logActivity({ owner, inquiry: quote.inquiry, quotation: quote._id, booking: booking._id, type: 'payment', actorType: 'system', direction: 'inbound', body: `Online payment of ${rupees(payment.amount / 100)} captured (${payment.paymentId}).` });
    return { booking, roomAssigned, warning };
  } catch (err) {
    if (promotionRedeemed) await Promotion.updateOne({ _id: quote.promotion.promotion }, { $inc: { usedCount: -1, discountGiven: -quote.promotion.discountAmount } });
    await unlock();
    throw err;
  }
}

module.exports = {
  MAX_QUOTE_NIGHTS, HOLD_MAX_MINUTES, OPEN_FOR_GUEST, CONVERTIBLE,
  newPublicToken, buildQuote, quoteInputs, sweepExpiredQuotes, convertQuote, bookingLineItems
};
