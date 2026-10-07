// payment-service: verifies with the provider, records the payment in its own
// database, publishes payment.success, and never writes booking data itself.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('../../../test/helpers');
const provider = require('../src/providers/razorpay');

const originals = Object.fromEntries(['available', 'keyId', 'mode', 'createOrder', 'fetchPayment', 'validSignature'].map(key => [key, provider[key]]));
let owner, Payment, Booking;
const captured = new Map();

before(async () => {
  await h.start();
  owner = await h.createOwner('payment-owner');
  Payment = require('../src/models/Payment');
  Booking = require('../../../models/Booking');
  let seq = 0;
  Object.assign(provider, {
    available: () => true, keyId: () => 'rzp_test_payments', mode: () => 'test',
    createOrder: async ({ amountPaise }) => { const id = `order_pay${++seq}`; captured.set(id, amountPaise); return { id, amount: amountPaise }; },
    fetchPayment: async id => ({ order_id: `order_${id.slice(4)}`, status: 'captured', currency: 'INR', amount: captured.get(`order_${id.slice(4)}`) }),
    validSignature: (_, __, signature) => signature === 'signed'
  });
});
after(async () => { Object.assign(provider, originals); await h.stop(); });

test('verify records the payment once, publishes payment.success and returns the booking outcome', async () => {
  const villa = await h.createProperty(owner.user, { name: 'Payment Villa' });
  const guest = await h.createCustomer('payment-guest');
  const hold = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: villa.property.id, roomId: villa.room.id, checkIn: h.day(6), checkOut: h.day(8), guests: 2 } });
  const pay = await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/pay`, { token: guest.token, body: { guest: { name: 'Pay Guest', phone: '9833333333', email: guest.user.email, idType: 'Passport', idNumber: 'Z9876543' } } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  const order = await Payment.findOne({ orderId: pay.data.order_id }).lean();
  assert.equal(order.status, 'created');
  assert.equal(order.bookingId, String(pay.data.bookingId));

  const body = { razorpay_order_id: pay.data.order_id, razorpay_payment_id: `pay_${pay.data.order_id.slice(6)}`, razorpay_signature: 'signed' };
  assert.equal((await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/verify`, { token: guest.token, body: { ...body, razorpay_signature: 'forged' } })).status, 400);
  const other = await h.createCustomer('payment-intruder');
  assert.equal((await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/verify`, { token: other.token, body })).status, 404, 'another guest cannot verify this hold');

  const verified = await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/verify`, { token: guest.token, body });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.status, 'confirmed');
  const again = await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/verify`, { token: guest.token, body });
  assert.equal(again.status, 200, 'a retried verify is idempotent');
  assert.equal(again.data.status, 'confirmed');

  const record = await Payment.findOne({ orderId: pay.data.order_id }).lean();
  assert.equal(record.status, 'captured');
  assert.equal(record.paymentId, body.razorpay_payment_id);
  assert.equal(await Payment.countDocuments({ orderId: pay.data.order_id }), 1);
  assert.equal((await Booking.findById(pay.data.bookingId)).status, 'confirmed');
});

test('payment-service source never imports booking/villa models (it publishes events instead)', () => {
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.endsWith('.js')) files.push(full); } };
  walk(path.join(__dirname, '..', 'src'));
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /require\([^)]*\/models\/(Booking|CustomerHold|Property|Room|RoomNight)['"]\)/, file);
});
