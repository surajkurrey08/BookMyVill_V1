const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
// Uploaded villa photos go to a throwaway folder during tests.
process.env.PROPERTY_MEDIA_DIR = path.join(os.tmpdir(), `bmv-vm-owner-media-${process.pid}`);
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');

let vm, other, guest, admin, created;
const call = (method, path, body, token = vm.token) => h.api(method, '/api/villa-manager/owner-directory' + path, { token, ...(body !== undefined && { body }) });
async function staff(role, suffix) { const user = await User.create({ name: suffix, email: `${suffix}@example.com`, password: 'password-123', role }); return { user, token: jwt.sign({ id: user._id, role }, process.env.JWT_SECRET) }; }

const owner = { name: 'Ramesh Jadhav', phone: '9822012345', whatsapp: '9822012345', address: 'Wai, Satara', notes: 'Prefers WhatsApp' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const villa = { photos: ['https://images.example.com/lakeview.jpg', PNG], name: 'Lakeview Villa', type: 'Villa', location: 'Mahabaleshwar', maxGuests: 10, bedrooms: 4, bathrooms: 3, price: 18000, extraGuestRate: 1200, checkInTime: '1:00 PM', checkOutTime: '11:00 AM', keyLocation: 'With caretaker', caretakerName: 'Sunil', caretakerPhone: '9822000000', wifiName: 'lakeview', wifiPassword: 'secret' };

before(async () => {
  await h.start();
  vm = await staff('villa_manager', 'vmo-manager'); other = await staff('villa_manager', 'vmo-other');
  guest = await h.createCustomer(); admin = await h.createAdmin();
});
after(async () => { await h.stop(); await fsp.rm(process.env.PROPERTY_MEDIA_DIR, { recursive: true, force: true }); });

test('manager adds an owner (no sign-in) with a whole-villa listing pending Admin approval', async () => {
  const res = await call('POST', '', { owner, villa });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  created = res.data;
  assert.equal(created.villa.website, 'pending_approval');

  const savedOwner = await User.findById(created.owner._id);
  assert.equal(savedOwner.role, 'owner');
  assert.equal(savedOwner.ownerManagementMode, 'BOOKMYVILLA_MANAGED');
  assert.equal(savedOwner.ownerProfile.whatsapp, '9822012345');
  assert.equal(savedOwner.email, undefined, 'email is optional');

  const property = await Property.findById(created.villa._id).select('+assignedVillaManager +handover');
  assert.equal(property.status, 'pending');
  assert.equal(property.bookingMode, 'ENTIRE');
  assert.equal(property.managementMode, 'BOOKMYVILLA_MANAGED');
  assert.equal(String(property.assignedVillaManager), String(vm.user._id));
  assert.equal(property.handover.caretakerPhone, '9822000000');
  assert.equal(property.photos.length, 2);
  assert.equal(property.photos[0], 'https://images.example.com/lakeview.jpg', 'pasted URL kept as-is');
  assert.match(property.photos[1], /\/api\/properties\/media\/[a-f0-9-]{36}\.png$/, 'upload saved as a file URL');
  await fsp.access(path.join(process.env.PROPERTY_MEDIA_DIR, path.basename(property.photos[1])));
  const units = await Room.find({ property: property._id });
  assert.equal(units.length, 1, 'a villa is one bookable unit');
  assert.equal(units[0].capacity, 10);
  assert.equal(units[0].baseRate, 18000);

  const publicList = await h.api('GET', '/api/properties/all');
  assert.ok(!publicList.data.some(p => p._id === created.villa._id), 'not on the website before Admin approval');
});

test('owner list and detail show villas, state right now, upcoming bookings and history', async () => {
  const property = await Property.findById(created.villa._id);
  const room = await Room.findOne({ property: property._id });
  await h.createBooking(guest.user, property, { room: room._id, stayStatus: 'in_house', checkIn: new Date(`${h.day(-1)}T00:00:00Z`), checkOut: new Date(`${h.day(2)}T00:00:00Z`), guest: { name: 'Neha', phone: '9811100000' } });
  await h.createBooking(guest.user, property, { room: room._id, checkIn: new Date(`${h.day(5)}T00:00:00Z`), checkOut: new Date(`${h.day(7)}T00:00:00Z`) });
  await h.createBooking(guest.user, property, { room: room._id, stayStatus: 'checked_out', checkIn: new Date(`${h.day(-10)}T00:00:00Z`), checkOut: new Date(`${h.day(-8)}T00:00:00Z`), totalPrice: 36000 });

  const list = await call('GET', '');
  assert.equal(list.status, 200);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].villas[0].now.state, 'occupied');
  assert.equal(list.data[0].occupied, 1);

  const detail = await call('GET', `/${created.owner._id}`);
  assert.equal(detail.status, 200, JSON.stringify(detail.data));
  assert.equal(detail.data.owner.phone, '9822012345');
  assert.equal(detail.data.villas[0].now.current.name, 'Neha');
  assert.equal(detail.data.villas[0].handover.keyLocation, 'With caretaker');
  assert.equal(detail.data.upcoming.length, 2);
  assert.equal(detail.data.history.length, 1);
  assert.deepEqual(detail.data.totals, { stays: 1, nights: 2, revenue: 36000 });
});

test('website switch works only after Admin approval, and hides the villa from customers', async () => {
  const id = created.villa._id;
  assert.equal((await call('PATCH', `/villas/${id}/website`, { visible: false })).status, 409);

  const approve = await h.api('POST', `/api/admin-console/properties/${id}/review`, { token: admin.token, body: { action: 'approve' } });
  assert.equal(approve.status, 200, JSON.stringify(approve.data));
  assert.ok((await h.api('GET', '/api/properties/all')).data.some(p => p._id === id && p.bookingMode === 'ENTIRE'));

  assert.equal((await call('PATCH', `/villas/${id}/website`, { visible: false })).status, 200);
  assert.ok(!(await h.api('GET', '/api/properties/all')).data.some(p => p._id === id));
  assert.equal((await h.api('GET', `/api/properties/${id}`)).status, 404);
  assert.equal((await h.api('GET', `/api/customer-booking/properties/${id}/rooms?checkIn=${h.day(20)}&checkOut=${h.day(22)}&guests=2`)).status, 404);

  assert.equal((await call('PATCH', `/villas/${id}/website`, { visible: true })).status, 200);
  assert.equal((await h.api('GET', `/api/customer-booking/properties/${id}/rooms?checkIn=${h.day(20)}&checkOut=${h.day(22)}&guests=2`)).status, 200);
  assert.equal((await h.api('GET', `/api/properties/${id}`)).status, 200);
});

test('manager replaces villa photos (keep, add upload, remove); bad files are rejected', async () => {
  const id = created.villa._id;
  const before = (await Property.findById(id)).photos;
  const res = await call('PUT', `/villas/${id}/photos`, { photos: [before[1], PNG] });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.photos.length, 2);
  assert.equal(res.data.photos[0], before[1], 'reordered: upload is now the cover');
  assert.equal((await call('PUT', `/villas/${id}/photos`, { photos: ['data:text/html;base64,PGgxPg=='] })).status, 400);
  assert.equal((await call('PUT', `/villas/${id}/photos`, { photos: ['javascript:alert(1)'] })).status, 400);
  assert.equal((await call('PUT', `/villas/${id}/photos`, { photos: [PNG] }, other.token)).status, 404);
});

test('another villa for the same owner; other managers and roles are kept out', async () => {
  const added = await call('POST', `/${created.owner._id}/villas`, { ...villa, name: 'Hilltop Cottage', type: 'Cottage', maxGuests: 6, price: 9000 });
  assert.equal(added.status, 201, JSON.stringify(added.data));
  assert.equal((await call('GET', `/${created.owner._id}`)).data.villas.length, 2);

  assert.equal((await call('GET', `/${created.owner._id}`, undefined, other.token)).status, 404);
  assert.equal((await call('GET', '', undefined, other.token)).data.length, 0);
  assert.equal((await call('PATCH', `/villas/${created.villa._id}/website`, { visible: false }, other.token)).status, 404);
  assert.equal((await call('GET', '', undefined, guest.token)).status, 403);
  assert.equal((await call('POST', '', { owner, villa: { ...villa, type: 'Resort' } })).status, 400);
  assert.equal((await call('POST', '', { owner: { ...owner, phone: '' }, villa })).status, 400);
});
