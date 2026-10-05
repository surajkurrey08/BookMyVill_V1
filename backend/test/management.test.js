const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { start, stop, api, createOwner, createCustomer, createAdmin, createProperty, createBooking, day } = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const AdminAudit = require('../models/AdminAudit');
const GuestRequest = require('../models/GuestRequest');
const { canManageProperty, canAccessProperty } = require('../services/propertyAccess');

let owner, admin, readonly, manager, otherManager, entry, otherEntry, customer, self, managed, legacy, booking;
const tokenFor = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
async function staff(role, label) {
  const user = await User.create({ name: `Test ${label}`, email: `${label}@example.com`, password: 'password-123', role });
  return { user, token: tokenFor(user) };
}
const management = (property, body, token = admin.token) => api('PATCH', `/api/admin-console/properties/${property._id}/management`, { token, body });

test.before(async () => {
  await start();
  owner = await createOwner('management');
  admin = await createAdmin('operations', 'managementadmin');
  readonly = await createAdmin('read_only', 'managementreadonly');
  customer = await createCustomer('managementguest');
  manager = await staff('villa_manager', 'assignedmanager');
  otherManager = await staff('villa_manager', 'othermanager');
  entry = await staff('data_entry', 'assignedentry');
  otherEntry = await staff('data_entry', 'otherentry');
  ({ property: self } = await createProperty(owner.user, { name: 'Self Managed Villa' }));
  let room;
  ({ property: managed, room } = await createProperty(owner.user, { name: 'Company Managed Villa', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: manager.user._id, assignedDataEntryUser: entry.user._id }));
  booking = await createBooking(customer.user, managed, { room: room._id });
  ({ property: legacy } = await createProperty(owner.user, { name: 'Legacy Villa' }));
  await Property.collection.updateOne({ _id: legacy._id }, { $unset: { managementMode: '', assignedVillaManager: '', assignedDataEntryUser: '' } });
});
test.after(stop);

test('CASE 1 and 9: owner operates self-managed and legacy properties, but cannot inject management fields', async () => {
  for (const property of [self, legacy]) {
    const response = await api('POST', `/api/owner-pms/properties/${property._id}/rooms`, { token: owner.token, body: { name: 'Garden Room', number: 'G1', type: 'Suite', capacity: 2, baseRate: 10000 } });
    assert.equal(response.status, 201);
    assert.equal(canManageProperty(owner.user, await Property.findById(property._id)), true);
  }
  const legacyView = await api('GET', `/api/admin-console/properties/${legacy._id}`, { token: admin.token });
  assert.equal(legacyView.data.property.managementMode, 'SELF_MANAGED');
  assert.equal((await api('PUT', `/api/properties/${self._id}`, { token: owner.token, body: { managementMode: 'BOOKMYVILLA_MANAGED' } })).status, 403);
  assert.equal((await api('POST', '/api/properties/add', { token: owner.token, body: { name: 'Injected', location: 'Panchgani', assignedVillaManager: manager.user._id } })).status, 403);
});

test('CASE 2: owning a company-managed property preserves reporting, not operational writes', async () => {
  const operations = [
    ['PUT', `/api/properties/${managed._id}`, { name: 'Owner edit attempt' }],
    ['DELETE', `/api/properties/${managed._id}`],
    ['POST', `/api/owner-pms/properties/${managed._id}/rooms`, { name: 'Blocked', number: 'B1', type: 'Suite', capacity: 2, baseRate: 1 }],
    ['PUT', `/api/bookings/status/${booking._id}`, { status: 'cancelled' }],
    ['POST', `/api/owner-ops/bookings/${booking._id}/check-in`, {}],
    ['POST', '/api/owner-finance/expenses', { propertyId: String(managed._id), category: 'utilities', amount: 100, incurredOn: day(), description: 'Unauthorized expense' }],
    ['POST', '/api/owner-quotes/preview', { propertyId: String(managed._id) }],
    ['POST', '/api/owner-crm/inquiries', { guestName: 'Test Guest', source: 'phone', propertyId: String(managed._id) }],
  ];
  for (const [method, path, body] of operations) assert.equal((await api(method, path, { token: owner.token, body })).status, 403, path);
  assert.equal(canManageProperty(owner.user, managed), false);
  assert.equal(canAccessProperty(owner.user, managed, 'report'), true);
  assert.equal((await api('GET', '/api/properties/my-properties', { token: owner.token })).data.length, 3);
  assert.equal(String((await Property.findById(managed._id)).owner), String(owner.user._id));
  assert.equal((await Booking.findById(booking._id)).status, 'confirmed');
});

test('CASE 3 and 4: assigned manager operates only assigned company-managed properties', async () => {
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: manager.token, body: { stayInfo: { arrivalNotes: 'Ask for the manager at the gate.' } } })).status, 200);
  assert.equal((await api('POST', `/api/owner-pms/properties/${managed._id}/rooms`, { token: manager.token, body: { name: 'Manager Room', number: 'M1', type: 'Suite', capacity: 2, baseRate: 12000, ownerId: otherManager.user._id } })).status, 201);
  for (const [token, property] of [[otherManager.token, managed], [manager.token, self]]) {
    assert.equal((await api('PUT', `/api/properties/${property._id}`, { token, body: { name: 'Unauthorized' } })).status, 404);
  }
  const list = await api('GET', '/api/owner-pms/properties', { token: manager.token });
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0]._id, String(managed._id));
  const request = await GuestRequest.create({ code: 'REQ-MGMT-1', property: managed._id, booking: booking._id, customer: customer.user._id, owner: owner.user._id, kind: 'request', category: 'other', title: 'Test request', description: 'Need assistance' });
  const update = await api('PATCH', `/api/owner-ops/guest-request/${request._id}`, { token: manager.token, body: { status: 'acknowledged' } });
  assert.equal(update.status, 200);
  assert.equal(update.data.updates.at(-1).byRole, 'villa_manager');
  assert.equal((await api('PATCH', `/api/owner-ops/guest-request/${request._id}`, { token: owner.token, body: { status: 'completed' } })).status, 403);
});

test('CASE 5 and 6: data-entry has assigned listing access without operational/financial/admin access', async () => {
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: entry.token, body: { name: 'Updated Listing Name', photos: ['/listing.jpg'] } })).status, 200);
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: otherEntry.token, body: { name: 'Not assigned' } })).status, 404);
  for (const body of [{ price: 1 }, { stayInfo: { wifiPassword: 'leak' } }, { status: 'approved' }, { owner: String(entry.user._id) }]) {
    assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: entry.token, body })).status, 403);
  }
  const list = await api('GET', '/api/properties/my-properties', { token: entry.token });
  assert.equal(list.data.length, 1);
  for (const key of ['price', 'stayInfo', 'owner', 'assignedVillaManager']) assert.equal(Object.hasOwn(list.data[0], key), false, key);
  assert.equal((await api('GET', '/api/owner-pms/properties', { token: entry.token })).status, 403);
  assert.equal((await api('GET', '/api/owner-finance/summary', { token: entry.token })).status, 403);
  assert.equal((await api('GET', '/api/admin-console/properties', { token: entry.token })).status, 403);
  assert.equal((await api('DELETE', `/api/properties/${managed._id}`, { token: entry.token })).status, 404);
});

test('CASE 7 and 8: admin changes management with audit; other users and read-only admins cannot', async () => {
  for (const token of [owner.token, manager.token, entry.token, customer.token, readonly.token]) {
    assert.equal((await management(self, { managementMode: 'BOOKMYVILLA_MANAGED' }, token)).status, 403);
  }
  const response = await management(self, { managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: String(manager.user._id), assignedDataEntryUser: String(entry.user._id) });
  assert.equal(response.status, 200);
  assert.equal(response.data.assignedVillaManager, String(manager.user._id));
  const audit = await AdminAudit.findOne({ entityId: self._id, action: 'property.management_change' });
  assert.equal(String(audit.actor), String(admin.user._id));
  assert.equal(audit.before.managementMode, 'SELF_MANAGED');
  assert.equal(audit.after.managementMode, 'BOOKMYVILLA_MANAGED');
  assert.ok(audit.createdAt);
  assert.equal((await api('PUT', `/api/properties/${self._id}`, { token: owner.token, body: { name: 'Mode changed' } })).status, 403);
  assert.equal((await api('PUT', `/api/properties/${self._id}`, { token: manager.token, body: { name: 'Manager listing edit' } })).status, 200);
});

test('assignments validate roles, account status and IDs; switching/removal revoke access without changing ownership/history', async () => {
  for (const body of [
    { assignedVillaManager: String(customer.user._id) }, { assignedDataEntryUser: String(manager.user._id) },
    { assignedVillaManager: 'invalid' }, { assignedVillaManager: String(new mongoose.Types.ObjectId()) },
    { managementMode: 'invalid' }, { owner: String(manager.user._id) },
  ]) assert.equal((await management(managed, body)).status, 400);
  await User.updateOne({ _id: otherManager.user._id }, { status: 'suspended' });
  assert.equal((await management(managed, { assignedVillaManager: String(otherManager.user._id) })).status, 400);
  await User.updateOne({ _id: otherManager.user._id }, { status: 'active' });
  assert.equal((await management(managed, { assignedVillaManager: null, assignedDataEntryUser: null })).status, 200);
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: manager.token, body: { name: 'Revoked' } })).status, 404);
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: entry.token, body: { name: 'Revoked' } })).status, 404);
  assert.equal((await management(self, { managementMode: 'SELF_MANAGED' })).status, 200);
  const result = await Property.findById(self._id).select('+assignedVillaManager');
  assert.equal(result.assignedVillaManager, null);
  assert.equal(String(result.owner), String(owner.user._id));
  assert.equal((await api('PUT', `/api/properties/${self._id}`, { token: manager.token, body: { name: 'Old manager' } })).status, 404);
  assert.equal((await api('PUT', `/api/properties/${self._id}`, { token: owner.token, body: { name: 'Self Managed Villa' } })).status, 200);
  assert.ok(await Booking.exists({ _id: booking._id }));
  assert.ok(await Room.exists({ property: self._id }));
});

test('internal filters include legacy self-managed values; public APIs hide all assignments', async () => {
  const company = await api('GET', '/api/admin-console/properties?managementMode=BOOKMYVILLA_MANAGED', { token: admin.token });
  assert.equal(company.status, 200);
  assert.equal(company.data.items.length, 1);
  const own = await api('GET', '/api/admin-console/properties?managementMode=SELF_MANAGED&q=Villa', { token: admin.token });
  assert.ok(own.data.items.some(item => item._id === String(legacy._id)));
  await management(managed, { assignedVillaManager: String(manager.user._id), assignedDataEntryUser: String(entry.user._id) });
  const assigned = await api('GET', `/api/admin-console/properties?assignedVillaManager=${manager.user._id}&assignedDataEntryUser=${entry.user._id}`, { token: admin.token });
  assert.equal(assigned.data.items.length, 1);
  assert.equal(assigned.data.items[0].assignedVillaManager._id, String(manager.user._id));
  assert.equal(assigned.data.items[0].assignedVillaManager.name, manager.user.name);
  assert.equal((await api('GET', '/api/admin-console/properties?managementMode=invalid', { token: admin.token })).status, 400);
  for (const path of ['/api/properties/all', `/api/properties/${managed._id}`]) {
    const response = await api('GET', path);
    const items = Array.isArray(response.data) ? response.data : [response.data];
    for (const item of items) {
      assert.equal(Object.hasOwn(item, 'assignedVillaManager'), false);
      assert.equal(Object.hasOwn(item, 'assignedDataEntryUser'), false);
    }
  }
});

test('JWT role spoofing, public staff registration and injected internal query IDs never grant access', async () => {
  const spoofed = jwt.sign({ id: entry.user._id, role: 'admin' }, process.env.JWT_SECRET);
  assert.equal((await management(managed, { managementMode: 'SELF_MANAGED' }, spoofed)).status, 403);
  assert.equal((await api('PUT', `/api/admin/property/${managed._id}/price`, { token: spoofed, body: { price: 1 } })).status, 403);
  assert.equal((await api('POST', '/api/auth/register', { body: { name: 'Staff Attacker', email: 'attacker@example.com', password: 'password-123', role: 'villa_manager' } })).status, 403);
  assert.equal((await api('POST', '/api/auth/register', { body: { name: 'Staff Attacker', email: 'attacker@example.com', password: 'password-123', role: 'data_entry' } })).status, 403);
  assert.equal((await api('GET', `/api/properties/my-properties?assignedVillaManager=${manager.user._id}`, { token: otherManager.token })).data.length, 0);
  const tampered = jwt.sign({ id: admin.user._id, role: 'admin' }, 'wrong-signature');
  assert.equal((await api('PUT', `/api/admin/property/${managed._id}/price`, { token: tampered, body: { price: 1 } })).status, 401);
  assert.equal((await management(managed, { managementMode: 'SELF_MANAGED' }, tampered)).status, 401);
});

test('existing owner/admin/customer login and new staff login retain database roles', async () => {
  for (const account of [owner, admin, customer, manager, entry]) {
    const response = await api('POST', '/api/auth/login', { body: { email: account.user.email, password: 'password-123', role: 'admin' } });
    assert.equal(response.status, 200);
    assert.equal(response.data.user.role, account.user.role);
    assert.equal(jwt.verify(response.data.token, process.env.JWT_SECRET).role, account.user.role);
  }
});

test('manager reassignment and legacy mode changes record exact audit values and revoke prior access', async () => {
  const oldAuditCount = await AdminAudit.countDocuments({ entityId: managed._id });
  const noop = await management(managed, { assignedVillaManager: String(manager.user._id) });
  assert.equal(noop.status, 200);
  assert.equal(await AdminAudit.countDocuments({ entityId: managed._id }), oldAuditCount);
  const replaced = await management(managed, { assignedVillaManager: String(otherManager.user._id), assignedDataEntryUser: String(otherEntry.user._id) });
  assert.equal(replaced.status, 200);
  const audit = await AdminAudit.findOne({ entityId: managed._id }).sort({ createdAt: -1 });
  assert.equal(audit.before.assignedVillaManager, String(manager.user._id));
  assert.equal(audit.after.assignedVillaManager, String(otherManager.user._id));
  assert.equal(audit.before.assignedDataEntryUser, String(entry.user._id));
  assert.equal(audit.after.assignedDataEntryUser, String(otherEntry.user._id));
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: manager.token, body: { name: 'Old manager attempt' } })).status, 404);
  assert.equal((await api('PUT', `/api/properties/${managed._id}`, { token: otherManager.token, body: { name: 'New manager edit' } })).status, 200);
  const changed = await management(legacy, { managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: String(manager.user._id) });
  assert.equal(changed.status, 200);
  assert.equal((await AdminAudit.findOne({ entityId: legacy._id })).before.managementMode, 'SELF_MANAGED');
  assert.equal(String(changed.data.owner), String(owner.user._id));
});
