// booking-service: confirmation from payment.success is idempotent and never
// double-books; concurrent checkouts cannot hold the same villa nights.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../../../test/helpers');
const provider = require('../../payment-service/src/providers/razorpay');

let owner, Booking, RoomNight, confirmFromPayment;
const originals = Object.fromEntries(['available', 'keyId', 'mode', 'createOrder'].map(key => [key, provider[key]]));
let orderSeq = 0;

before(async () => {
  await h.start();
  owner = await h.createOwner('confirm-owner');
  Booking = require('../../../models/Booking');
  RoomNight = require('../../../models/RoomNight');
  ({ confirmFromPayment } = require('../../../services/bookingConfirmation'));
  Object.assign(provider, { available: () => true, keyId: () => 'rzp_test_confirm', mode: () => 'test', createOrder: async ({ amountPaise }) => ({ id: `order_confirm${++orderSeq}`, amount: amountPaise }) });
});
after(async () => { Object.assign(provider, originals); await h.stop(); });

// Hold + pay: returns the pending booking and its payment.success message.
async function pendingBooking(villa, offset, label) {
  const guest = await h.createCustomer(label);
  const hold = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: villa.property.id, roomId: villa.room.id, checkIn: h.day(offset), checkOut: h.day(offset + 2), guests: 2 } });
  assert.equal(hold.status, 201, JSON.stringify(hold.data));
  const pay = await h.api('POST', `/api/customer-booking/holds/${hold.data.holdId}/pay`, { token: guest.token, body: { guest: { name: 'Guest One', phone: '9822222222', email: guest.user.email, idType: 'Passport', idNumber: 'P1234567' } } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  const booking = await Booking.findById(pay.data.bookingId);
  const message = { id: `evt-${pay.data.order_id}`, event: 'payment.success', data: { paymentId: `pay_${pay.data.order_id.slice(6)}`, orderId: pay.data.order_id, bookingId: String(booking._id), holdId: String(hold.data.holdId), amount: booking.onlineAmount ?? booking.totalPrice, currency: 'INR', mode: 'test' } };
  return { guest, booking, message, holdId: hold.data.holdId };
}

test('the same payment.success delivered twice (and concurrently) confirms exactly once', async () => {
  const villa = await h.createProperty(owner.user, { name: 'Idempotent Villa' });
  const { booking, message } = await pendingBooking(villa, 5, 'idem-guest');
  const results = await Promise.allSettled([confirmFromPayment(message), confirmFromPayment(message)]);
  assert.ok(results.some(r => r.status === 'fulfilled' && r.value === 'confirmed'), JSON.stringify(results));
  // A concurrent duplicate is either a no-op or asked to retry; the retry is a no-op.
  assert.equal(await confirmFromPayment(message), 'confirmed');
  const saved = await Booking.findById(booking._id);
  assert.equal(saved.status, 'confirmed');
  assert.equal(saved.paymentStatus, 'paid');
  assert.equal(saved.actionHistory.filter(a => a.action === 'Payment Captured & Stay Confirmed').length, 1);
  assert.equal(await RoomNight.countDocuments({ reference: booking._id, kind: 'booking' }), 2, 'two nights, booked once');
});

test('a payment.success that does not match the booking amount never confirms it', async () => {
  const villa = await h.createProperty(owner.user, { name: 'Mismatch Villa' });
  const { booking, message } = await pendingBooking(villa, 9, 'mismatch-guest');
  assert.equal(await confirmFromPayment({ ...message, id: 'evt-bad', data: { ...message.data, amount: 1 } }), 'mismatch');
  const saved = await Booking.findById(booking._id);
  assert.equal(saved.status, 'pending');
  assert.equal(saved.paymentOutcome.code, 'mismatch');
  assert.equal(await RoomNight.countDocuments({ reference: booking._id }), 0);
});

test('confirmed nights cannot be held again, and concurrent holds for the same dates have one winner', async () => {
  const villa = await h.createProperty(owner.user, { name: 'No Double Booking Villa' });
  const { message } = await pendingBooking(villa, 14, 'first-guest');
  assert.equal(await confirmFromPayment(message), 'confirmed');
  const late = await h.createCustomer('late-guest');
  const again = await h.api('POST', '/api/customer-booking/holds', { token: late.token, body: { propertyId: villa.property.id, roomId: villa.room.id, checkIn: h.day(15), checkOut: h.day(16), guests: 2 } });
  assert.equal(again.status, 409);

  const racers = await Promise.all(['racer-a', 'racer-b', 'racer-c'].map(label => h.createCustomer(label)));
  const attempts = await Promise.all(racers.map(guest => h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: villa.property.id, roomId: villa.room.id, checkIn: h.day(20), checkOut: h.day(22), guests: 2 } })));
  assert.deepEqual(attempts.map(a => a.status).sort(), [201, 409, 409]);
});
