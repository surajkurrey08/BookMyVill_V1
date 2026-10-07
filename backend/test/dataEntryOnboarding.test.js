const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
process.env.PROPERTY_MEDIA_DIR = path.join(os.tmpdir(), `bmv-de-onboarding-${process.pid}`);
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');

let entry, vm, admin, guest, managed, self, area, guide;
const base = '/api/properties/data-entry/onboarding';
const call = (method, p, body, token = entry.token) => h.api(method, base + p, { token, ...(body !== undefined && { body }) });
async function staff(role, name) { const user = await User.create({ name, email: `${name}@example.com`, password: 'password-123', role, status: 'active' }); return { user, token: jwt.sign({ id: user._id, role }, process.env.JWT_SECRET) }; }
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAJRU5ErkJggg==';
const villa = name => ({ name, type: 'Villa', location: 'Mahabaleshwar', maxGuests: 10, bedrooms: 4, bathrooms: 3, price: 15000, description: 'Valley-facing villa', amenities: 'Pool, Wi-Fi, Parking', photos: ['https://img.example.com/a.jpg', PNG] });

before(async () => {
  await h.start();
  entry = await staff('data_entry', 'de-staff'); vm = await staff('villa_manager', 'de-manager');
  admin = await h.createAdmin(); guest = await h.createCustomer('de-guest');
});
after(async () => { await h.stop(); await fsp.rm(process.env.PROPERTY_MEDIA_DIR, { recursive: true, force: true }); });

test('Data Entry adds a BookMyVilla-managed owner + villa; it lands in the chosen Villa Manager panel', async () => {
  const managers = await call('GET', '/villa-managers');
  assert.ok(managers.data.some(m => m._id === String(vm.user._id)));
  assert.equal((await call('POST', '/owners', { managementMode: 'BOOKMYVILLA_MANAGED', owner: { name: 'Ravi Shinde', phone: '9822011111' }, villa: villa('Valley Villa') })).status, 400, 'Villa Manager is required');

  const res = await call('POST', '/owners', { managementMode: 'BOOKMYVILLA_MANAGED', villaManager: String(vm.user._id), owner: { name: 'Ravi Shinde', phone: '9822011111' }, villa: villa('Valley Villa') });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  managed = res.data;
  const property = await Property.findById(managed.villa._id).select('+assignedVillaManager +assignedDataEntryUser');
  assert.equal(property.bookingMode, 'ENTIRE');
  assert.equal(property.status, 'pending');
  assert.equal(String(property.assignedVillaManager), String(vm.user._id));
  assert.equal(String(property.assignedDataEntryUser), String(entry.user._id));
  assert.deepEqual(property.amenities, ['Pool', 'Wi-Fi', 'Parking']);
  assert.equal(property.photos.length, 2);
  assert.equal(await Room.countDocuments({ property: property._id }), 1, 'one whole-villa unit, no rooms');

  const vmOwners = await h.api('GET', '/api/villa-manager/owner-directory', { token: vm.token });
  assert.ok(vmOwners.data.some(o => o._id === managed.owner._id), 'shows in the Villa Manager panel');
  const mine = await call('GET', '/owners');
  assert.equal(mine.data[0].villas[0].villaManager, 'de-manager');
});

test('Data Entry adds a self-managed owner; Admin sends a setup link and the owner sets a password', async () => {
  assert.equal((await call('POST', '/owners', { managementMode: 'SELF_MANAGED', owner: { name: 'Meera Joshi', phone: '9822022222' }, villa: villa('Meera Villa') })).status, 400, 'email required');
  const res = await call('POST', '/owners', { managementMode: 'SELF_MANAGED', owner: { name: 'Meera Joshi', phone: '9822022222', email: 'meera@example.com' }, villa: villa('Meera Villa') });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  self = res.data;
  const property = await Property.findById(self.villa._id).select('+assignedVillaManager');
  assert.equal(property.managementMode, 'SELF_MANAGED');
  assert.equal(property.assignedVillaManager, null);

  assert.equal((await h.api('POST', `/api/admin-console/owners/${self.owner._id}/setup-link`, { token: admin.token })).status, 409, 'approve the villa before enabling owner access');
  const approved = await h.api('POST', `/api/admin-console/properties/${self.villa._id}/review`, { token: admin.token, body: { action: 'approve' } });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  const link = await h.api('POST', `/api/admin-console/owners/${self.owner._id}/setup-link`, { token: admin.token });
  assert.equal(link.status, 200, JSON.stringify(link.data));
  const setup = await h.api('POST', '/api/auth/owner-setup', { body: { token: link.data.token, password: 'owner-pass-123', confirmPassword: 'owner-pass-123' } });
  assert.equal(setup.status, 200, JSON.stringify(setup.data));
  await require('../models/PartnerApplication').create({ fullName: 'Meera Joshi', email: 'meera@example.com', phone: '9822022222', status: 'pending' });
  const login = await h.api('POST', '/api/auth/login', { body: { email: 'meera@example.com', password: 'owner-pass-123' } });
  assert.equal(login.status, 200, 'approved Admin access also works when an older partner application is pending');
  assert.equal((await h.api('POST', '/api/auth/owner-setup', { body: { token: link.data.token, password: 'another-pass-123', confirmPassword: 'another-pass-123' } })).status, 400, 'setup token works once');
  assert.equal((await h.api('POST', `/api/admin-console/owners/${managed.owner._id}/setup-link`, { token: admin.token })).status, 409, 'managed owners do not sign in');

  const more = await call('POST', `/owners/${self.owner._id}/villas`, { villa: villa('Meera Cottage') });
  assert.equal(more.status, 201);
  assert.equal((await call('POST', `/owners/${self.owner._id}/villas`, { villa: villa('X') }, vm.token)).status, 403);
});

test('local guide: Data Entry sets location rate + guides; guest adds a guide at checkout; manager assigns; guest sees contact', async () => {
  area = (await call('POST', '/guide-areas', { name: 'Mahabaleshwar', dailyRate: 1500 })).data;
  assert.equal((await call('POST', '/guide-areas', { name: ' mahabaleshwar ', dailyRate: 900 })).status, 409, 'one rate per location');

  await Property.updateOne({ _id: managed.villa._id }, { status: 'approved' });
  const unit = await Room.findOne({ property: managed.villa._id });
  const held = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: managed.villa._id, roomId: String(unit._id), checkIn: h.day(4), checkOut: h.day(6), guests: 4 } });
  assert.equal(held.status, 201, JSON.stringify(held.data));
  const holdId = held.data.holdId;
  let price = await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: {} });
  assert.equal(price.data.guideOption, null, 'no guide offered until a guide exists for the location');
  assert.equal((await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: { guideDays: 1 } })).status, 409);

  guide = (await call('POST', '/guides', { area: area._id, name: 'Sanjay Guide', phone: '9822033333', languages: 'Marathi, Hindi, English' })).data;
  price = await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: {} });
  assert.deepEqual(price.data.guideOption, { dailyRate: 1500, maxDays: 2 });
  assert.equal(JSON.stringify(price.data).includes('Sanjay'), false, 'guests never see guide details before booking');
  const withGuide = await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: { guideDays: 2 } });
  assert.equal(withGuide.data.total, 15000 * 2 + 3000);
  const advance = await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: { guideDays: 2, paymentPlan: 'advance' } });
  assert.equal(advance.data.amountDueNow, 9900, '30% includes the guide charge');
  assert.equal(advance.data.balance, 23100);
  assert.equal((await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: { guideDays: 3 } })).status, 400, 'at most one day per night');

  const gateway = require('../services/payment-service/src/providers/razorpay');
  const originals = Object.fromEntries(['available', 'keyId', 'mode', 'createOrder', 'fetchPayment', 'validSignature'].map(k => [k, gateway[k]]));
  try {
    gateway.available = () => true; gateway.keyId = () => 'k'; gateway.mode = () => 'test';
    gateway.createOrder = async ({ amountPaise }) => ({ id: 'order_guide1', amount: amountPaise });
    gateway.fetchPayment = async () => ({ order_id: 'order_guide1', status: 'captured', currency: 'INR', amount: 9900 * 100 });
    gateway.validSignature = () => true;
    const pay = await h.api('POST', `/api/customer-booking/holds/${holdId}/pay`, { token: guest.token, body: { guideDays: 2, paymentPlan: 'advance', guest: { name: 'Neha Rao', phone: '9811122233', email: guest.user.email, idType: 'Passport', idNumber: 'P1234567' } } });
    assert.equal(pay.status, 200, JSON.stringify(pay.data));
    const locked = await h.api('POST', `/api/customer-booking/holds/${holdId}/price`, { token: guest.token, body: { guideDays: 0, paymentPlan: 'full' } });
    assert.equal(locked.data.guide.days, 2, 'payment order freezes guide selection');
    assert.equal(locked.data.amountDueNow, 9900);
    assert.equal(locked.data.balance, 23100);
    assert.equal((await h.api('POST', `/api/customer-booking/holds/${holdId}/verify`, { token: guest.token, body: { razorpay_order_id: 'order_guide1', razorpay_payment_id: 'pay_guide1', razorpay_signature: 's' } })).status, 200);

    let confirmation = await h.api('GET', `/api/customer-booking/bookings/${pay.data.bookingId}/confirmation`, { token: guest.token });
    assert.deepEqual(confirmation.data.guide, { days: 2, assigned: null });
    assert.equal(confirmation.data.amountPaid, 9900);
    assert.equal(confirmation.data.remainingBalance, 23100);

    const options = await h.api('GET', `/api/villa-manager/owner-directory/bookings/${pay.data.bookingId}/guides`, { token: vm.token });
    assert.equal(options.status, 200);
    assert.equal(options.data.guides[0].name, 'Sanjay Guide');
    assert.equal((await h.api('GET', `/api/villa-manager/owner-directory/bookings/${pay.data.bookingId}/guides`, { token: guest.token })).status, 403);
    assert.equal((await h.api('POST', `/api/villa-manager/owner-directory/bookings/${pay.data.bookingId}/guide`, { token: vm.token, body: { guideId: guide._id } })).status, 200);

    confirmation = await h.api('GET', `/api/customer-booking/bookings/${pay.data.bookingId}/confirmation`, { token: guest.token });
    assert.equal(confirmation.data.guide.assigned.phone, '9822033333');
    const bookingDetail = await h.api('GET', `/api/villa-manager/bookings/${pay.data.bookingId}`, { token: vm.token });
    assert.equal(bookingDetail.data.guide.assigned.name, 'Sanjay Guide');
    const trip = await h.api('GET', `/api/stay/trips/${pay.data.bookingId}`, { token: guest.token });
    assert.equal(trip.status, 200, JSON.stringify(trip.data));
    assert.equal(trip.data.stay.guide.phone, '9822033333');
    const detail = await h.api('GET', `/api/villa-manager/owner-directory/${managed.owner._id}`, { token: vm.token });
    assert.equal(detail.data.upcoming[0].guide.assigned.name, 'Sanjay Guide');
  } finally { Object.assign(gateway, originals); }
});

test('Admin operations can arrange guides for self-managed stays, with permissions and booking state enforced', async () => {
  const property = await Property.findById(self.villa._id);
  const booking = await h.createBooking(guest.user, property, { guide: { requested: true, days: 1, dailyRate: 1500, amount: 1500 } });
  const path = `/api/admin-console/bookings/${booking._id}`;
  const readOnly = await h.createAdmin('read_only', 'guide-readonly');
  assert.equal((await h.api('GET', `${path}/guides`, { token: readOnly.token })).status, 403);
  assert.equal((await h.api('POST', `${path}/guide`, { token: readOnly.token, body: { guideId: guide._id } })).status, 403);
  assert.equal((await h.api('GET', `/api/villa-manager/owner-directory/bookings/${booking._id}/guides`, { token: vm.token })).status, 404, 'a manager cannot access a self-managed property');
  const options = await h.api('GET', `${path}/guides`, { token: admin.token });
  assert.equal(options.status, 200);
  assert.equal(options.data.guides[0].name, guide.name);
  const assigned = await h.api('POST', `${path}/guide`, { token: admin.token, body: { guideId: guide._id } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
  const trip = await h.api('GET', `/api/stay/trips/${booking._id}`, { token: guest.token });
  assert.equal(trip.data.stay.guide.name, guide.name);
  assert.ok(await require('../models/AdminAudit').exists({ entityId: booking._id, action: 'booking.guide_assigned' }));
  const queue = await h.api('GET', '/api/admin-console/bookings?view=guide_requests', { token: admin.token });
  assert.ok(queue.data.items.some(b => b._id === String(booking._id) && b.guide.requested));
  await require('../models/Booking').updateOne({ _id: booking._id }, { $set: { status: 'cancelled' } });
  assert.equal((await h.api('POST', `${path}/guide`, { token: admin.token, body: { guideId: guide._id } })).status, 409);
});
