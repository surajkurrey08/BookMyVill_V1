const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');

let vm, other, ownerId;
const call = (method, path, body, token = vm.token) => h.api(method, '/api/villa-manager/owner-directory' + path, { token, ...(body !== undefined && { body }) });
async function staff(suffix) { const user = await User.create({ name: suffix, email: `${suffix}@example.com`, password: 'password-123', role: 'villa_manager' }); return { user, token: jwt.sign({ id: user._id, role: 'villa_manager' }, process.env.JWT_SECRET) }; }
const villa = { name: 'Hilltop Villa', type: 'Villa', location: 'Panchgani', address: 'Table Land Road', maxGuests: 8, bedrooms: 3, bathrooms: 2, price: 12000, extraGuestRate: 800, checkInTime: '1:00 PM', checkOutTime: '11:00 AM', wifiName: 'hilltop', wifiPassword: 'pass-1', keyLocation: 'Gate box', caretakerName: 'Ravi', caretakerPhone: '9822000001' };

before(async () => {
  await h.start();
  vm = await staff('vme-manager'); other = await staff('vme-other');
  const res = await call('POST', '', { owner: { name: 'Edit Owner', phone: '9822012399' }, villa });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  ownerId = res.data.owner._id;
});
after(() => h.stop());

const villaOf = async () => (await call('GET', `/${ownerId}`)).data.villas;

test('manager edits villa details and the bookable unit follows', async () => {
  const [v] = await villaOf();
  const res = await call('PUT', `/villas/${v._id}`, { ...villa, name: 'Hilltop Villa & Pool', description: 'Pool villa with valley views.', maxGuests: 10, bedrooms: '', price: 15000, extraGuestRate: 1000, wifiPassword: 'pass-2', caretakerName: 'Sunil', coordinates: { lat: 17.9244, lng: 73.8016 }, mapLink: 'https://maps.google.com/?q=17.9244,73.8016' });
  assert.equal(res.status, 200, JSON.stringify(res.data));

  const saved = await Property.findById(v._id).select('+handover').lean();
  assert.equal(saved.name, 'Hilltop Villa & Pool');
  assert.equal(saved.price, 15000);
  assert.equal(saved.status, 'pending', 'approval state is untouched');
  assert.equal(saved.listingData.details.guestCapacity, 10);
  assert.equal(saved.listingData.details.description, 'Pool villa with valley views.');
  assert.equal(saved.listingData.details.bedrooms, undefined, 'cleared bedrooms are removed');
  assert.equal(saved.listingData.details.bathrooms, 2);
  assert.equal(saved.stayInfo.wifiPassword, 'pass-2');
  assert.equal(saved.handover.caretakerName, 'Sunil');
  assert.deepEqual(saved.coordinates, { lat: 17.9244, lng: 73.8016 });
  const unit = await Room.findOne({ property: v._id }).lean();
  assert.equal(unit.capacity, 10);
  assert.equal(unit.baseRate, 15000);
  assert.equal(unit.extraGuestRate, 1000);

  const [shown] = await villaOf();
  assert.equal(shown.name, 'Hilltop Villa & Pool', 'owner page shows the saved details');

  assert.equal((await call('PUT', `/villas/${v._id}`, { ...villa, name: '' })).status, 400, 'required fields are validated');
  assert.equal((await call('PUT', `/villas/${v._id}`, villa, other.token)).status, 404, 'other managers cannot edit it');
});

test('a villa with bookings cannot be deleted; an unbooked one is removed with its unit and calendar', async () => {
  const added = await call('POST', `/${ownerId}/villas`, { ...villa, name: 'Spare Cottage' });
  assert.equal(added.status, 201, JSON.stringify(added.data));
  const [booked] = await villaOf();
  await Booking.create({ property: booked._id, checkIn: new Date('2026-12-01'), checkOut: new Date('2026-12-03'), totalPrice: 30000, status: 'confirmed' });
  const blocked = await call('DELETE', `/villas/${booked._id}`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.data.msg, /Hide it from the website/);
  assert.ok(await Property.exists({ _id: booked._id }));

  const spare = added.data._id;
  const unit = await Room.findOne({ property: spare });
  const ref = new (require('mongoose').Types.ObjectId)();
  await RoomNight.create({ property: spare, room: unit._id, date: '2026-12-10', kind: 'block', reference: ref, operationId: ref });
  assert.ok(await RoomNight.exists({ property: spare }), 'calendar block exists before delete');
  assert.equal((await call('DELETE', `/villas/${spare}`, undefined, other.token)).status, 404, 'other managers cannot delete it');
  const removed = await call('DELETE', `/villas/${spare}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  assert.equal(await Property.exists({ _id: spare }), null);
  assert.equal(await Room.exists({ property: spare }), null);
  assert.equal(await RoomNight.exists({ property: spare }), null);
  assert.equal((await villaOf()).length, 1);
});

test('manager edits an owner\'s contact details', async () => {
  const res = await call('PUT', `/${ownerId}`, { name: 'Edit Owner Jr', phone: '9822012398', whatsapp: '9822012397', email: 'edit.owner@example.com', address: 'Wai', notes: 'Call after 6 PM' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const saved = await User.findById(ownerId).lean();
  assert.equal(saved.name, 'Edit Owner Jr');
  assert.equal(saved.email, 'edit.owner@example.com');
  assert.equal(saved.ownerProfile.whatsapp, '9822012397');
  assert.equal(saved.ownerProfile.notes, 'Call after 6 PM');
  assert.equal((await call('PUT', `/${ownerId}`, { name: '', phone: '9822012398' })).status, 400);
  assert.equal((await call('PUT', `/${ownerId}`, { name: 'X Y', phone: '9822012398' }, other.token)).status, 404, 'other managers cannot edit');
});

test('manager deletes an unbooked owner with their villas; booked owners and owners with a login are kept', async () => {
  const fresh = await call('POST', '', { owner: { name: 'Short Lived', phone: '9822012311' }, villa: { ...villa, name: 'Short Villa' } });
  const id = fresh.data.owner._id;
  assert.equal((await call('DELETE', `/${id}`, undefined, other.token)).status, 404);
  const removed = await call('DELETE', `/${id}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  assert.equal(removed.data.villas, 1);
  assert.equal(await User.exists({ _id: id }), null);
  assert.equal(await Property.exists({ owner: id }), null);

  const booked = await call('DELETE', `/${ownerId}`);
  assert.equal(booked.status, 409, 'owner with a booked villa is kept');
  assert.ok(await User.exists({ _id: ownerId }));

  const login = await call('POST', '', { owner: { name: 'Has Login', phone: '9822012322' }, villa: { ...villa, name: 'Login Villa' } });
  await User.updateOne({ _id: login.data.owner._id }, { $set: { ownerPasswordSetAt: new Date() } });
  assert.equal((await call('DELETE', `/${login.data.owner._id}`)).status, 403, 'owners who sign in are removed by Admin only');
});

test('manager picks amenities from the standard list; edits without amenities keep them', async () => {
  const list = await call('GET', '/amenities');
  assert.equal(list.status, 200);
  assert.ok(list.data.includes('Private Swimming Pool'));
  const [v] = await villaOf();
  const picked = ['Private Swimming Pool', 'Free High-Speed Wi-Fi', 'Jacuzzi'];
  assert.equal((await call('PUT', `/villas/${v._id}`, { ...villa, amenities: picked })).status, 200);
  assert.deepEqual((await villaOf())[0].amenities, picked, 'owner page shows the picked amenities');
  assert.equal((await call('PUT', `/villas/${v._id}`, { ...villa, name: 'Kept Amenities Villa' })).status, 200);
  assert.deepEqual((await Property.findById(v._id).lean()).amenities, picked, 'a form that omits amenities leaves them unchanged');
  await Property.updateOne({ _id: v._id }, { $set: { status: 'approved' } }); // public only after Admin approval
  const publicView = await h.api('GET', `/api/properties/${v._id}`);
  assert.deepEqual(publicView.data.amenities, picked, 'guests see them on the property page');
});
