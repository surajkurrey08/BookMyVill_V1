const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');
const gateway = require('../services/paymentGateway');
const User = require('../models/User');
const Property = require('../models/Property');

const base = '/api/customer-booking';
let originals, vm, owner, guest, admin, villa, own;

before(async () => {
  await h.start();
  originals = Object.fromEntries(['available', 'keyId', 'mode', 'createOrder', 'fetchPayment', 'validSignature'].map(key => [key, gateway[key]]));
  const vmUser = await User.create({ name: 'Adv Manager', email: 'adv-manager@example.com', password: 'password-123', role: 'villa_manager' });
  vm = { user: vmUser, token: jwt.sign({ id: vmUser._id, role: 'villa_manager' }, process.env.JWT_SECRET) };
  owner = await h.createOwner('adv-owner'); guest = await h.createCustomer('adv-guest'); admin = await h.createAdmin();
  villa = await h.createProperty(owner.user, {
    name: 'Advance Villa', bookingMode: 'ENTIRE', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: vmUser._id, price: 10000,
    handover: { caretakerName: 'Sunil', caretakerPhone: '9822000000', keyLocation: 'Locker 4' },
    listingData: { details: { bedrooms: 4, bathrooms: 3, guestCapacity: 8, address: '12 Private Road', description: 'Hill view villa' } },
    stayInfo: { checkInTime: '1:00 PM', checkOutTime: '11:00 AM', wifiName: 'secret-net', wifiPassword: 'secret-pass' }
  });
  own = await h.createProperty(owner.user, { name: 'Self Run Villa' });
});
after(async () => { Object.assign(gateway, originals); await h.stop(); });

test('guest pays 30% advance online; balance is due at the villa and the caretaker shows only after booking', async () => {
  const checkIn = h.day(3), checkOut = h.day(5);
  const held = await h.api('POST', `${base}/holds`, { token: guest.token, body: { propertyId: String(villa.property._id), roomId: String(villa.room._id), checkIn, checkOut, guests: 4 } });
  assert.equal(held.status, 201, JSON.stringify(held.data));
  const holdId = held.data.holdId;

  const full = await h.api('POST', `${base}/holds/${holdId}/price`, { token: guest.token, body: {} });
  assert.equal(full.data.paymentPlan, 'full');
  assert.equal(full.data.amountDueNow, full.data.total);
  const advance = await h.api('POST', `${base}/holds/${holdId}/price`, { token: guest.token, body: { paymentPlan: 'advance' } });
  assert.equal(advance.data.total, 24000);
  assert.equal(advance.data.amountDueNow, 7200);
  assert.equal(advance.data.balance, 16800);

  gateway.available = () => true; gateway.keyId = () => 'rzp_test'; gateway.mode = () => 'test';
  gateway.createOrder = async ({ amountPaise }) => ({ id: 'order_adv1', amount: amountPaise });
  gateway.fetchPayment = async () => ({ order_id: 'order_adv1', status: 'captured', currency: 'INR', amount: 7200 * 100 });
  gateway.validSignature = (_, __, signature) => signature === 'ok';
  const pay = await h.api('POST', `${base}/holds/${holdId}/pay`, { token: guest.token, body: { paymentPlan: 'advance', guest: { name: 'Asha Patil', phone: '9811111111', email: guest.user.email, idType: 'Passport', idNumber: 'AB123456' } } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  assert.equal(pay.data.amount, 7200 * 100, 'only the advance is charged online');
  assert.equal((await h.api('GET', `${base}/bookings/${pay.data.bookingId}/confirmation`, { token: guest.token })).status, 404, 'no confirmation (or caretaker) before payment');

  const verified = await h.api('POST', `${base}/holds/${holdId}/verify`, { token: guest.token, body: { razorpay_order_id: 'order_adv1', razorpay_payment_id: 'pay_adv1', razorpay_signature: 'ok' } });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  const confirmation = await h.api('GET', `${base}/bookings/${pay.data.bookingId}/confirmation`, { token: guest.token });
  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.data.amountPaid, 7200);
  assert.equal(confirmation.data.remainingBalance, 16800);
  assert.equal(confirmation.data.paymentPlan, 'advance');
  assert.deepEqual(confirmation.data.caretaker, { name: 'Sunil', phone: '9822000000' });

  const trip = await h.api('GET', `/api/stay/trips/${pay.data.bookingId}`, { token: guest.token });
  assert.equal(trip.status, 200, JSON.stringify(trip.data));
  assert.equal(trip.data.stay.caretaker.phone, '9822000000');
  assert.equal(trip.data.booking.balanceDue, 16800);

  const collect = `/api/villa-manager/owner-directory/bookings/${pay.data.bookingId}/collect-balance`;
  assert.equal((await h.api('POST', collect, { token: vm.token })).status, 200);
  assert.equal((await h.api('POST', collect, { token: vm.token })).status, 409, 'cannot collect twice');
  assert.equal((await h.api('GET', `${base}/bookings/${pay.data.bookingId}/confirmation`, { token: guest.token })).data.remainingBalance, 0);
});

test('public villa page shows details and the blue tick, never private handover data', async () => {
  const view = (await h.api('GET', `/api/properties/${villa.property._id}`)).data;
  assert.equal(view.verified, true, 'BookMyVilla-managed villas are verified');
  assert.equal(view.details.bedrooms, 4);
  assert.equal(view.description, 'Hill view villa');
  assert.equal(view.arrival.checkInTime, '1:00 PM');
  const text = JSON.stringify(view);
  for (const secret of ['12 Private Road', 'secret-net', 'secret-pass', '9822000000', 'Locker 4']) assert.ok(!text.includes(secret), `${secret} must stay private`);
});

test('self-managed owner applies for the blue tick and Admin approves it', async () => {
  const path = `/api/owner-pms/properties/${own.property._id}/verification`;
  assert.equal((await h.api('GET', `/api/properties/${own.property._id}`)).data.verified, false);
  assert.equal((await h.api('POST', path, { token: guest.token, body: {} })).status, 403);
  assert.equal((await h.api('POST', path, { token: owner.token, body: { note: 'All documents ready' } })).status, 200);
  assert.equal((await h.api('POST', path, { token: owner.token, body: {} })).status, 409, 'already requested');

  const queue = await h.api('GET', '/api/admin-console/verification-requests', { token: admin.token });
  assert.equal(queue.status, 200);
  assert.ok(queue.data.some(p => String(p._id) === String(own.property._id)));
  assert.equal((await h.api('POST', `/api/admin-console/properties/${own.property._id}/verification`, { token: admin.token, body: { action: 'reject' } })).status, 400, 'rejection needs a reason');
  assert.equal((await h.api('POST', `/api/admin-console/properties/${own.property._id}/verification`, { token: admin.token, body: { action: 'approve' } })).status, 200);
  assert.equal((await h.api('GET', `/api/properties/${own.property._id}`)).data.verified, true);
  assert.equal((await Property.findById(own.property._id)).verification.status, 'verified');
});
