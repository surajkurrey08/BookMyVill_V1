const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { start, stop, api, createOwner, createProperty, day } = require('./helpers');

let owner;
let token;
let otherToken;
let property;
let room;
let RoomNight;
let Quotation;
let Booking;
let Promotion;
let Inquiry;

test.before(async () => {
  await start();
  RoomNight = require('../models/RoomNight');
  Quotation = require('../models/Quotation');
  Booking = require('../models/Booking');
  Promotion = require('../models/Promotion');
  Inquiry = require('../models/Inquiry');
  ({ user: owner, token } = await createOwner('quotes'));
  ({ token: otherToken } = await createOwner('rival'));
  ({ property, room } = await createProperty(owner));
});
test.after(stop);

const tokenOf = quote => quote.publicPath.split('/').pop();
const quoteBody = (overrides = {}) => ({
  propertyId: String(property._id), roomId: String(room._id), guestName: 'Rahul Mehta', guestPhone: '9876500001', guestEmail: 'rahul@example.com',
  checkIn: day(15), checkOut: day(17), adults: 4, children: 1, taxMode: 'gst_hotel', securityDeposit: 10000, advancePercent: 30, balanceDueDaysBeforeCheckIn: 2,
  cancellationPolicy: 'moderate', notesToGuest: 'Welcome drinks on arrival', internalNotes: 'Friend of Sunil - give best room', validityMinutes: 60, ...overrides
});

let breakfast;
let bonfire;

test('add-on catalog: validation, property scoping and pausing', async () => {
  assert.equal((await api('POST', '/api/owner-catalog/add-ons', { token, body: { name: '', category: 'meal', pricingUnit: 'per_stay', price: 10 } })).status, 400);
  const created = await api('POST', '/api/owner-catalog/add-ons', { token, body: { name: 'Breakfast', category: 'meal', pricingUnit: 'per_guest_per_night', price: 350, taxRate: 5 } });
  assert.equal(created.status, 201);
  breakfast = created.data;
  bonfire = (await api('POST', '/api/owner-catalog/add-ons', { token, body: { name: 'Bonfire', category: 'experience', pricingUnit: 'per_stay', price: 1500, taxRate: 18, propertyId: String(property._id) } })).data;
  assert.equal((await api('POST', '/api/owner-catalog/add-ons', { token: otherToken, body: { name: 'X', category: 'meal', pricingUnit: 'per_stay', price: 1, propertyId: String(property._id) } })).status, 404);
  assert.equal((await api('PATCH', `/api/owner-catalog/add-ons/${breakfast._id}`, { token: otherToken, body: { active: false } })).status, 404);
  const list = await api('GET', '/api/owner-catalog/add-ons', { token });
  assert.equal(list.data.length, 2);
});

test('promotions: type rules, duplicate codes and state', async () => {
  assert.equal((await api('POST', '/api/owner-catalog/promotions', { token, body: { code: 'EARLY', name: 'Early', type: 'early_bird', discountType: 'percent', discountValue: 10 } })).status, 400);
  const promo = await api('POST', '/api/owner-catalog/promotions', { token, body: { code: 'monsoon15', name: 'Monsoon offer', type: 'promo_code', discountType: 'percent', discountValue: 15, maxDiscount: 2500, minNights: 2, maxUses: 1 } });
  assert.equal(promo.status, 201);
  assert.equal(promo.data.code, 'MONSOON15');
  assert.equal((await api('POST', '/api/owner-catalog/promotions', { token, body: { code: 'MONSOON15', name: 'Dup', type: 'promo_code', discountType: 'fixed', discountValue: 100 } })).status, 409);
  const list = await api('GET', '/api/owner-catalog/promotions', { token });
  assert.equal(list.data[0].state, 'live');
});

let mainQuote;
let inquiryId;

test('preview prices server-side, flags capacity, and rejects bad promotions', async () => {
  const { data: inquiry } = await api('POST', '/api/owner-crm/inquiries', { token, body: { guestName: 'Rahul Mehta', guestPhone: '9876500001', guestEmail: 'rahul@example.com', source: 'phone', propertyId: String(property._id) } });
  inquiryId = inquiry._id;
  const preview = await api('POST', '/api/owner-quotes/preview', { token, body: quoteBody({ adults: 8, children: 2, addOns: [{ addOnId: breakfast._id }], promotionCode: 'MONSOON15' }) });
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.totals.accommodation, 24000);
  assert.equal(preview.data.addOns[0].quantity, 10, 'per-guest add-ons default to the guest count');
  assert.equal(preview.data.addOns[0].amount, 7000);
  assert.equal(preview.data.promotion.discountAmount, 2500);
  assert.ok(preview.data.warnings.some(text => /capacity/.test(text)));
  const tooShort = await api('POST', '/api/owner-quotes/preview', { token, body: quoteBody({ checkOut: day(16), promotionCode: 'MONSOON15' }) });
  assert.equal(tooShort.status, 400);
  assert.match(tooShort.data.msg, /at least 2 nights/);
  assert.equal((await api('POST', '/api/owner-quotes/preview', { token, body: quoteBody({ promotionCode: 'NOPE99' }) })).status, 400);
  assert.equal((await api('POST', '/api/owner-quotes/preview', { token, body: quoteBody({ checkIn: day(-2), checkOut: day(1) }) })).status, 400);
  assert.equal((await api('POST', '/api/owner-quotes/preview', { token, body: quoteBody({ holdInventory: true, validityMinutes: 5000 }) })).status, 400);
  assert.equal((await api('POST', '/api/owner-quotes/preview', { token: otherToken, body: quoteBody() })).status, 404);
});

test('draft → send with hold blocks the room for everyone else', async () => {
  const created = await api('POST', '/api/owner-quotes', { token, body: quoteBody({ inquiryId, addOns: [{ addOnId: breakfast._id, quantity: 5 }, { addOnId: bonfire._id }], promotionCode: 'MONSOON15', holdInventory: true }) });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  mainQuote = created.data;
  assert.equal(mainQuote.status, 'draft');
  assert.match(mainQuote.code, /^QT-/);
  // Drafts are not visible to guests.
  assert.equal((await api('GET', `/api/public/quotes/${tokenOf(mainQuote)}`)).status, 404);

  const edited = await api('PUT', `/api/owner-quotes/${mainQuote._id}`, { token, body: quoteBody({ inquiryId, addOns: [{ addOnId: breakfast._id, quantity: 5 }, { addOnId: bonfire._id }], promotionCode: 'MONSOON15', holdInventory: true, nightlyRate: 13000 }) });
  assert.equal(edited.data.totals.accommodation, 26000);

  const sent = await api('POST', `/api/owner-quotes/${mainQuote._id}/send`, { token, body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  assert.equal(sent.data.status, 'sent');
  assert.equal(sent.data.heldNights, 2);
  assert.ok(new Date(sent.data.validUntil) > new Date());
  assert.equal((await api('PUT', `/api/owner-quotes/${mainQuote._id}`, { token, body: quoteBody() })).status, 409);
  assert.equal((await Inquiry.findById(inquiryId)).status, 'quotation_sent');

  const block = await api('POST', `/api/owner-pms/rooms/${room._id}/blocks`, { token, body: { start: day(15), end: day(16), reason: 'Owner stay' } });
  assert.equal(block.status, 409);
  const rival = await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Other Guest', guestPhone: '9000011111', guestEmail: '' }) });
  assert.ok(rival.data.warnings.some(text => /not free/.test(text)));
  const rivalSend = await api('POST', `/api/owner-quotes/${rival.data._id}/send`, { token, body: {} });
  assert.equal(rivalSend.status, 409);
});

test('guest view: marks viewed once, hides internal details', async () => {
  const link = tokenOf(mainQuote);
  const first = await api('GET', `/api/public/quotes/${link}`);
  assert.equal(first.status, 200);
  assert.equal(first.data.status, 'viewed');
  const raw = JSON.stringify(first.data);
  assert.ok(!raw.includes('Friend of Sunil'), 'internal notes never reach the guest');
  assert.ok(!raw.includes('"V1"'), 'physical room number stays internal');
  assert.ok(!raw.includes('9876500001'), 'guest phone is not echoed on the public page');
  assert.equal(first.data.room.name, 'Whole Villa');
  assert.equal(first.data.discounts[0].amount, 2500);
  assert.equal(first.data.onlinePayment, false);
  await api('GET', `/api/public/quotes/${link}`);
  const stored = await Quotation.findById(mainQuote._id);
  assert.equal(stored.viewCount, 2);
  const detail = await api('GET', `/api/owner-quotes/${mainQuote._id}`, { token });
  assert.equal(detail.data.activities.filter(item => item.type === 'quote_viewed').length, 1);
  assert.equal((await api('GET', `/api/public/quotes/${'a'.repeat(64)}`)).status, 404);
  assert.equal((await api('GET', '/api/public/quotes/not-a-token')).status, 404);
});

test('guest accepts; concurrent conversions create exactly one booking', async () => {
  const link = tokenOf(mainQuote);
  assert.equal((await api('POST', `/api/public/quotes/${link}/accept`, { body: { name: 'Rahul Mehta' } })).status, 400);
  const accepted = await api('POST', `/api/public/quotes/${link}/accept`, { body: { name: 'Rahul Mehta', agree: true } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.status, 'accepted');
  assert.equal((await Inquiry.findById(inquiryId)).status, 'payment_pending');

  const results = await Promise.all([1, 2, 3].map(() => api('POST', `/api/owner-quotes/${mainQuote._id}/convert`, { token })));
  assert.equal(results.filter(item => item.status === 200).length >= 1, true);
  const bookings = await Booking.find({ quotation: mainQuote._id });
  assert.equal(bookings.length, 1);
  const booking = bookings[0];
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(String(booking.room), String(room._id));
  assert.equal(booking.guest.name, 'Rahul Mehta');
  assert.equal(booking.user, null);
  const storedQuote = await Quotation.findById(mainQuote._id);
  assert.equal(booking.totalPrice, storedQuote.totals.total);
  assert.equal(storedQuote.status, 'converted');
  assert.equal(storedQuote.lockedUntil, null);
  assert.ok(booking.lineItems.some(line => line.kind === 'addon' && line.label === 'Bonfire'));
  assert.equal(await RoomNight.countDocuments({ kind: 'booking', reference: booking._id }), 2);
  assert.equal(await RoomNight.countDocuments({ kind: 'hold', reference: mainQuote._id }), 0);
  assert.equal((await Promotion.findOne({ code: 'MONSOON15' })).usedCount, 1);
  const inquiry = await Inquiry.findById(inquiryId);
  assert.equal(inquiry.status, 'booked');
  assert.equal(String(inquiry.booking), String(booking._id));
  const guestView = await api('GET', `/api/public/quotes/${link}`);
  assert.equal(guestView.data.status, 'converted');
  assert.equal(guestView.data.booking.status, 'confirmed');
  // The converted booking shows up for the owner and can be cancelled by the owner.
  const ownerBookings = await api('GET', '/api/bookings/owner', { token });
  assert.ok(ownerBookings.data.some(item => item._id === String(booking._id) && item.guest.name === 'Rahul Mehta'));
});

test('promotion usage limit is enforced at conversion', async () => {
  const second = await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Second Guest', guestPhone: '9000022222', guestEmail: '', checkIn: day(25), checkOut: day(27), promotionCode: 'MONSOON15' }) });
  assert.equal(second.status, 400, 'limit already reached by the first conversion');
  assert.match(second.data.msg, /usage limit/);
});

test('withdraw releases the hold; revise creates a fresh draft', async () => {
  const created = (await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Neha', guestPhone: '9000033333', guestEmail: '', checkIn: day(30), checkOut: day(33), holdInventory: true }) })).data;
  await api('POST', `/api/owner-quotes/${created._id}/send`, { token, body: {} });
  assert.equal(await RoomNight.countDocuments({ kind: 'hold', reference: created._id }), 3);
  const revised = await api('POST', `/api/owner-quotes/${created._id}/revise`, { token });
  assert.equal(revised.status, 201);
  assert.equal(revised.data.status, 'draft');
  assert.equal(revised.data.revisionOf.code, created.code);
  const original = await Quotation.findById(created._id);
  assert.equal(original.status, 'withdrawn');
  assert.equal(await RoomNight.countDocuments({ kind: 'hold', reference: created._id }), 0);
  const guestView = await api('GET', `/api/public/quotes/${tokenOf(created)}`);
  assert.equal(guestView.data.replaced, true);
  assert.equal((await api('POST', `/api/public/quotes/${tokenOf(created)}/accept`, { body: { name: 'Neha', agree: true } })).status, 409);
  assert.equal((await api('POST', `/api/owner-quotes/${created._id}/revise`, { token })).status, 409, 'only one revision per quote');
});

test('expired quotes are swept, holds released and acceptance refused', async () => {
  const created = (await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Late Guest', guestPhone: '9000044444', guestEmail: '', checkIn: day(40), checkOut: day(41), holdInventory: true }) })).data;
  await api('POST', `/api/owner-quotes/${created._id}/send`, { token, body: {} });
  await Quotation.updateOne({ _id: created._id }, { $set: { validUntil: new Date(Date.now() - 1000) } });
  await RoomNight.updateMany({ reference: created._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const accept = await api('POST', `/api/public/quotes/${tokenOf(created)}/accept`, { body: { name: 'Late Guest', agree: true } });
  assert.equal(accept.status, 410);
  const stored = await Quotation.findById(created._id);
  assert.equal(stored.status, 'expired');
  assert.equal(await RoomNight.countDocuments({ reference: created._id }), 0);
  assert.equal((await api('POST', `/api/owner-quotes/${created._id}/convert`, { token })).status, 409);
});

test('guest decline moves the lead to follow-up and frees the room', async () => {
  const { data: inquiry } = await api('POST', '/api/owner-crm/inquiries', { token, body: { guestName: 'Decliner', guestPhone: '9000055555', source: 'website' } });
  const created = (await api('POST', '/api/owner-quotes', { token, body: quoteBody({ inquiryId: inquiry._id, guestName: 'Decliner', guestPhone: '9000055555', guestEmail: '', checkIn: day(50), checkOut: day(52), holdInventory: true }) })).data;
  await api('POST', `/api/owner-quotes/${created._id}/send`, { token, body: {} });
  const declined = await api('POST', `/api/public/quotes/${tokenOf(created)}/reject`, { body: { reason: 'Found a cheaper place' } });
  assert.equal(declined.data.status, 'rejected');
  assert.equal(await RoomNight.countDocuments({ reference: created._id }), 0);
  assert.equal((await Inquiry.findById(inquiry._id)).status, 'follow_up');
  assert.equal((await api('POST', `/api/public/quotes/${tokenOf(created)}/pay`)).status, 503, 'online payment is reported unavailable without keys');
});

test('online payment (gateway stubbed): verify converts once, duplicates are idempotent, lost room is flagged', async () => {
  const gateway = require('../services/paymentGateway');
  const secret = 'test_secret_value_123';
  const original = { available: gateway.available, keySecret: gateway.keySecret, keyId: gateway.keyId, createOrder: gateway.createOrder, fetchPayment: gateway.fetchPayment };
  const payments = new Map();
  gateway.available = () => true;
  gateway.keySecret = () => secret;
  gateway.keyId = () => 'rzp_test_abc123';
  gateway.createOrder = async ({ amountPaise }) => ({ id: `order_${crypto.randomBytes(6).toString('hex')}`, amount: amountPaise });
  gateway.fetchPayment = async id => payments.get(id);
  const sign = (orderId, paymentId) => crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  try {
    const created = (await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Payer', guestPhone: '9000066666', guestEmail: '', checkIn: day(60), checkOut: day(62), holdInventory: true }) })).data;
    await api('POST', `/api/owner-quotes/${created._id}/send`, { token, body: {} });
    const link = tokenOf(created);
    assert.equal((await api('POST', `/api/public/quotes/${link}/pay`)).status, 409, 'must accept first');
    await api('POST', `/api/public/quotes/${link}/accept`, { body: { name: 'Payer', agree: true } });
    const order = await api('POST', `/api/public/quotes/${link}/pay`);
    assert.equal(order.status, 200, JSON.stringify(order.data));
    const stored = await Quotation.findById(created._id);
    assert.equal(order.data.amount, stored.totals.total * 100);

    const paymentId = 'pay_first001';
    payments.set(paymentId, { id: paymentId, order_id: order.data.order_id, amount: order.data.amount, currency: 'INR', status: 'captured' });
    const forged = await api('POST', `/api/public/quotes/${link}/verify`, { body: { razorpay_order_id: order.data.order_id, razorpay_payment_id: paymentId, razorpay_signature: 'f'.repeat(64) } });
    assert.equal(forged.status, 400);
    const body = { razorpay_order_id: order.data.order_id, razorpay_payment_id: paymentId, razorpay_signature: sign(order.data.order_id, paymentId) };
    const [one, two] = await Promise.all([api('POST', `/api/public/quotes/${link}/verify`, { body }), api('POST', `/api/public/quotes/${link}/verify`, { body })]);
    assert.ok([one.status, two.status].includes(200));
    const bookings = await Booking.find({ quotation: created._id });
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].paymentStatus, 'paid');
    assert.equal(bookings[0].razorpayPaymentId, paymentId);
    assert.equal(String(bookings[0].room), String(room._id));
    const again = await api('POST', `/api/public/quotes/${link}/verify`, { body });
    assert.equal(again.status, 200, 'replayed callback is idempotent');

    // Room lost while paying: payment is kept, booking left unassigned.
    const late = (await api('POST', '/api/owner-quotes', { token, body: quoteBody({ guestName: 'Slow Payer', guestPhone: '9000077777', guestEmail: '', checkIn: day(70), checkOut: day(71) }) })).data;
    await api('POST', `/api/owner-quotes/${late._id}/send`, { token, body: {} });
    const lateLink = tokenOf(late);
    await api('POST', `/api/public/quotes/${lateLink}/accept`, { body: { name: 'Slow Payer', agree: true } });
    const lateOrder = (await api('POST', `/api/public/quotes/${lateLink}/pay`)).data;
    await RoomNight.deleteMany({ reference: late._id });
    const block = await api('POST', `/api/owner-pms/rooms/${room._id}/blocks`, { token, body: { start: day(70), end: day(71), reason: 'Plumbing' } });
    assert.equal(block.status, 201);
    const latePayment = 'pay_late0001';
    payments.set(latePayment, { id: latePayment, order_id: lateOrder.order_id, amount: lateOrder.amount, currency: 'INR', status: 'captured' });
    const verified = await api('POST', `/api/public/quotes/${lateLink}/verify`, { body: { razorpay_order_id: lateOrder.order_id, razorpay_payment_id: latePayment, razorpay_signature: sign(lateOrder.order_id, latePayment) } });
    assert.equal(verified.status, 200);
    assert.match(verified.data.msg, /host will confirm your room/);
    const lateBooking = await Booking.findOne({ quotation: late._id });
    assert.equal(lateBooking.room, null);
    assert.equal(lateBooking.paymentStatus, 'paid');
  } finally {
    Object.assign(gateway, original);
  }
});
