const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const AdminAudit = require('../models/AdminAudit');

let admin, readOnly;
const call = (method, path, body, token = admin.token) => h.api(method, '/api/admin-console' + path, { token, ...(body !== undefined && { body }) });
const villaBody = { name: 'Admin Edited Villa', type: 'Villa', location: 'Lonavala', address: 'Tiger Point Road', description: 'Edited by admin.', maxGuests: 6, bedrooms: 2, bathrooms: 2, price: 9000, extraGuestRate: 500, checkInTime: '2:00 PM', checkOutTime: '11:00 AM', wifiName: 'lv', wifiPassword: 'lv-pass', keyLocation: 'Caretaker', caretakerName: 'Mahesh', caretakerPhone: '9822000002' };

before(async () => {
  await h.start();
  admin = await h.createAdmin(null, 'records-admin');
  readOnly = await h.createAdmin('read_only', 'records-reader');
});
after(() => h.stop());

test('admin edits a property\'s details; the whole-villa unit and audit trail follow', async () => {
  const { user } = await h.createOwner('records-owner-a');
  const { property } = await h.createProperty(user, { bookingMode: 'ENTIRE' });
  const detail = await call('GET', `/properties/${property._id}`);
  assert.equal(detail.data.unit.baseRate, 12000, 'drawer gets the unit rates for the edit form');

  assert.equal((await call('PUT', `/properties/${property._id}/details`, villaBody, readOnly.token)).status, 403);
  const res = await call('PUT', `/properties/${property._id}/details`, villaBody);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const saved = await Property.findById(property._id).select('+handover').lean();
  assert.equal(saved.name, 'Admin Edited Villa');
  assert.equal(saved.status, 'approved', 'still live');
  assert.equal(saved.listingData.details.guestCapacity, 6);
  assert.equal(saved.handover.caretakerName, 'Mahesh');
  const unit = await Room.findOne({ property: property._id }).lean();
  assert.equal(unit.capacity, 6);
  assert.equal(unit.baseRate, 9000);
  const audit = await AdminAudit.findOne({ entityId: property._id, action: 'property.updated' }).lean();
  assert.equal(audit.before.name, 'Valley View Villa');
  assert.equal(audit.after.price, 9000);
});

test('admin deletes an unbooked property with a reason; a booked one is kept', async () => {
  const { user } = await h.createOwner('records-owner-b');
  const { property: spare } = await h.createProperty(user, { name: 'Spare One' });
  const { property: booked } = await h.createProperty(user, { name: 'Booked One' });
  await Booking.create({ property: booked._id, checkIn: new Date('2026-12-01'), checkOut: new Date('2026-12-02'), totalPrice: 12000, status: 'confirmed' });

  assert.equal((await call('DELETE', `/properties/${spare._id}`, {})).status, 400, 'reason is required');
  assert.equal((await call('DELETE', `/properties/${spare._id}`, { reason: 'Duplicate listing' })).status, 200);
  assert.equal(await Property.exists({ _id: spare._id }), null);
  assert.equal(await Room.exists({ property: spare._id }), null);
  assert.equal((await AdminAudit.findOne({ entityId: spare._id, action: 'property.deleted' }).lean()).reason, 'Duplicate listing');

  assert.equal((await call('DELETE', `/properties/${booked._id}`, { reason: 'Test' })).status, 409);
  assert.ok(await Property.exists({ _id: booked._id }));
});

test('admin edits an owner and deletes one without booked villas', async () => {
  const { user: owner } = await h.createOwner('records-owner-c');
  const { user: taken } = await h.createOwner('records-owner-taken');
  assert.equal((await call('PATCH', `/owners/${owner._id}`, { name: 'Renamed Owner', phone: '9822012000', email: taken.email })).status, 409, 'email already used');
  assert.equal((await call('PATCH', `/owners/${owner._id}`, { name: 'Renamed Owner', phone: '9822012000', email: '' })).status, 400, 'a sign-in email cannot be removed');
  const res = await call('PATCH', `/owners/${owner._id}`, { name: 'Renamed Owner', phone: '9822012000', email: 'renamed.owner@example.com', whatsapp: '9822012001', address: 'Pune' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const saved = await User.findById(owner._id).lean();
  assert.equal(saved.name, 'Renamed Owner');
  assert.equal(saved.email, 'renamed.owner@example.com');
  assert.equal(saved.ownerProfile.address, 'Pune');
  assert.ok(await AdminAudit.exists({ entityId: owner._id, action: 'owner.updated' }));

  await h.createProperty(owner, { name: 'Owner C Villa' });
  assert.equal((await call('DELETE', `/owners/${owner._id}`, { reason: 'Left the platform' }, readOnly.token)).status, 403);
  const removed = await call('DELETE', `/owners/${owner._id}`, { reason: 'Left the platform' });
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  assert.equal(removed.data.villas, 1);
  assert.equal(await User.exists({ _id: owner._id }), null);
  assert.equal(await Property.exists({ owner: owner._id }), null);

  const { user: busy } = await h.createOwner('records-owner-busy');
  const { property } = await h.createProperty(busy);
  await Booking.create({ property: property._id, checkIn: new Date('2026-12-05'), checkOut: new Date('2026-12-06'), totalPrice: 12000, status: 'confirmed' });
  assert.equal((await call('DELETE', `/owners/${busy._id}`, { reason: 'Test' })).status, 409);
  assert.ok(await User.exists({ _id: busy._id }));
});
