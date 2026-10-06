const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createOwner, createCustomer, createProperty, createBooking, day } = require('./helpers');
const Inventory = require('../models/Inventory');
const Feedback = require('../models/Feedback');
const TouristRegister = require('../models/TouristRegister');
const Property = require('../models/Property');

let owner, other, self, managed, managedRoom, booking, guest, companyStock, selfStock, companyReview, companyTourist;
const request = (method, path, body, token = owner.token) => api(method, path, { token, body });
test.before(async () => {
  await start(); owner = await createOwner('phase3'); other = await createOwner('phase3-other'); guest = await createCustomer('phase3-guest');
  ({ property: self } = await createProperty(owner.user, { name: 'Owner Operated Villa' }));
  ({ property: managed, room: managedRoom } = await createProperty(owner.user, { name: 'Company Operated Villa', managementMode: 'BOOKMYVILLA_MANAGED' }));
  await createProperty(other.user, { name: 'Other Owner Self Villa' });
  booking = await createBooking(guest.user, managed, { room: managedRoom._id });
  companyStock = await Inventory.create({ ownerId: owner.user._id, propertyId: managed._id, propertyName: managed.name, itemName: 'Company linen', category: 'Linen & Towels', quantity: 5 });
  selfStock = await Inventory.create({ ownerId: owner.user._id, propertyId: self._id, propertyName: self.name, itemName: 'Owner linen', category: 'Linen & Towels', quantity: 5 });
  companyReview = await Feedback.create({ ownerId: owner.user._id, propertyId: managed._id, propertyName: managed.name, guestName: 'Guest', rating: 5, reviewText: 'Great stay.' });
  companyTourist = await TouristRegister.create({ ownerId: owner.user._id, propertyId: managed._id, propertyName: managed.name, guestName: 'Company Guest', phone: '9811111111' });
});
test.after(stop);

test('owner sees every owned property with backend permission and no internal staff assignment metadata', async () => {
  for (const path of ['/api/properties/my-properties', '/api/owner-pms/properties']) {
    const result = await request('GET', path);
    assert.equal(result.status, 200); assert.equal(result.data.length, 2);
    assert.equal(result.data.find(property => property._id === String(self._id)).canOperate, true);
    assert.equal(result.data.find(property => property._id === String(managed._id)).canOperate, false);
    for (const property of result.data) for (const field of ['assignedVillaManager', 'assignedDataEntryUser']) assert.equal(Object.hasOwn(property, field), false);
  }
  const detail = await request('GET', `/api/properties/${managed._id}`);
  assert.equal(detail.data.owner._id, String(owner.user._id)); assert.equal(detail.data.canOperate, false);
  assert.equal(Object.hasOwn(detail.data, 'assignedVillaManager'), false);
});

test('managed calendar, operational summaries and finance remain readable only to the owning account', async () => {
  for (const path of [
    `/api/owner-pms/properties/${managed._id}/availability?start=${day()}&end=${day(8)}`,
    `/api/owner-ops/board/${managed._id}`, `/api/owner-ops/staff/${managed._id}`,
    `/api/owner-ops/housekeeping/${managed._id}`, `/api/owner-ops/rooms/${managed._id}`, `/api/owner-ops/guest-requests/${managed._id}`,
  ]) {
    assert.equal((await request('GET', path)).status, 200, path);
    assert.equal((await request('GET', path, undefined, other.token)).status, 404, path);
  }
  const report = await request('GET', `/api/owner-finance/summary?start=${day(-1)}&end=${day(8)}&propertyId=${managed._id}`);
  assert.equal(report.status, 200); assert.equal(report.data.totals.liveCaptured, 24000);
  assert.equal(report.data.properties[0].canOperate, false);
  assert.equal((await request('GET', `/api/owner-finance/report.csv?start=${day(-1)}&end=${day(8)}&propertyId=${managed._id}`)).status, 200);
  assert.equal((await request('GET', '/api/bookings/owner')).data.length, 1);
});

test('managed operational writes reject direct calls while mixed-owner self-managed workflows still work', async () => {
  const room = { name: 'Extra suite', number: 'E1', type: 'Suite', capacity: 2, baseRate: 8000 };
  assert.equal((await request('PUT', `/api/properties/${managed._id}`, { price: 1 })).status, 403);
  assert.equal((await request('POST', `/api/owner-pms/properties/${managed._id}/rooms`, room)).status, 403);
  assert.equal((await request('POST', `/api/owner-ops/bookings/${booking._id}/check-in`, {})).status, 403);
  assert.equal((await request('POST', `/api/owner-ops/staff/${managed._id}`, { name: 'Unauthorized', role: 'housekeeping' })).status, 403);
  assert.equal((await request('POST', '/api/owner-finance/expenses', { propertyId: String(managed._id), category: 'supplies', amount: 5, incurredOn: day(), description: 'Blocked' })).status, 403);
  assert.equal((await request('POST', '/api/caretaker/apply', { propertyId: String(managed._id) })).status, 403);
  assert.equal((await request('POST', `/api/owner-pms/properties/${self._id}/rooms`, room)).status, 409);
  assert.equal((await request('PUT', `/api/properties/${self._id}`, { price: 13000 })).status, 200);
  assert.equal((await request('POST', `/api/owner-ops/staff/${self._id}`, { name: 'Owner staff', role: 'housekeeping' })).status, 201);
  assert.equal((await request('POST', '/api/caretaker/apply', { propertyId: String(self._id), propertyName: self.name })).status, 201);
  assert.equal((await Property.findById(managed._id)).price, 12000);
});

test('legacy owner-wide actions cannot bypass mode restrictions; linked self-managed records stay editable', async () => {
  for (const [method, path, body] of [
    ['POST', '/api/caretaker-tasks', { title: 'Blocked owner-wide task', propertyId: String(self._id) }],
    ['DELETE', '/api/caretaker-tasks/1'], ['PUT', '/api/caretaker-tasks/1/toggle'],
    ['POST', '/api/guest-requirements/GST-901/requests', { label: 'Blocked' }],
    ['PUT', `/api/inventory/${companyStock._id}/restock`, { quantity: 5, propertyId: String(self._id) }],
    ['PUT', `/api/tourist-register/${companyTourist._id}/status`, { status: 'Arrived' }],
    ['PUT', `/api/feedback/${companyReview._id}/toggle-select`],
  ]) assert.equal((await request(method, path, body)).status, 403, path);
  assert.equal((await Inventory.findById(companyStock._id)).quantity, 5);
  assert.equal((await request('PUT', `/api/inventory/${selfStock._id}/restock`, { quantity: 5 })).status, 200);
  assert.equal((await Inventory.findById(selfStock._id)).quantity, 10);
  const nameOnly = await Inventory.create({ ownerId: owner.user._id, propertyName: managed.name, itemName: 'Legacy linked stock', category: 'Linen & Towels', quantity: 1 });
  assert.equal((await request('PUT', `/api/inventory/${nameOnly._id}/restock`, { quantity: 5 })).status, 403);
  assert.equal((await request('POST', '/api/caretaker-tasks', { title: 'Self-only task' }, other.token)).status, 201);
});
