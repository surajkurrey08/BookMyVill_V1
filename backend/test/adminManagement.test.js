const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createAdmin, createOwner, createCustomer, createProperty } = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');

let admin, readonly, owner, customer, manager, entry, self, managed, unassigned, legacy;
test.before(async () => {
  await start();
  admin = await createAdmin('operations', 'assignmentadmin');
  readonly = await createAdmin('read_only', 'assignmentreadonly');
  owner = await createOwner('assignmentowner');
  customer = await createCustomer('assignmentcustomer');
  [manager, entry] = await User.create([
    { name: 'Active Manager', email: 'active-manager@example.com', password: 'password-123', role: 'villa_manager', status: 'active' },
    { name: 'Approved Data Entry', email: 'active-entry@example.com', password: 'password-123', role: 'data_entry', status: 'approved' },
    { name: 'Suspended Manager', email: 'inactive-manager@example.com', password: 'password-123', role: 'villa_manager', status: 'suspended' },
    { name: 'Pending Entry', email: 'pending-entry@example.com', password: 'password-123', role: 'data_entry', status: 'pending' },
  ]);
  ({ property: self } = await createProperty(owner.user));
  ({ property: managed } = await createProperty(owner.user, { managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: manager._id, assignedDataEntryUser: entry._id }));
  ({ property: unassigned } = await createProperty(owner.user, { managementMode: 'BOOKMYVILLA_MANAGED' }));
  ({ property: legacy } = await createProperty(owner.user));
  await Property.collection.updateOne({ _id: legacy._id }, { $unset: { managementMode: '', assignedVillaManager: '', assignedDataEntryUser: '' } });
});
test.after(stop);

test('staff choices contain only eligible roles/accounts and require management permission', async () => {
  const choices = await api('GET', '/api/admin-console/property-management-staff', { token: admin.token });
  assert.equal(choices.status, 200);
  assert.deepEqual(choices.data.villaManagers.map(user => user._id), [String(manager._id)]);
  assert.deepEqual(choices.data.dataEntryUsers.map(user => user._id), [String(entry._id)]);
  assert.equal(choices.data.villaManagers[0].email, manager.email);
  assert.equal(Object.hasOwn(choices.data.villaManagers[0], 'password'), false);
  for (const token of [readonly.token, owner.token, customer.token]) {
    assert.equal((await api('GET', '/api/admin-console/property-management-staff', { token })).status, 403);
  }
});

test('admin property lists/details populate staff names; public responses keep assignments private', async () => {
  const detail = await api('GET', `/api/admin-console/properties/${managed._id}`, { token: admin.token });
  assert.equal(detail.data.property.assignedVillaManager.name, manager.name);
  assert.equal(detail.data.property.assignedDataEntryUser.name, entry.name);
  assert.equal(detail.data.property.owner._id, String(owner.user._id));
  assert.equal(Object.hasOwn(detail.data.property.assignedVillaManager, 'password'), false);
  const classic = await api('GET', '/api/admin/properties', { token: admin.token });
  assert.equal(classic.status, 200);
  assert.equal(classic.data.find(property => property._id === String(managed._id)).assignedVillaManager.name, manager.name);
  assert.equal(classic.data.find(property => property._id === String(legacy._id)).managementMode, 'SELF_MANAGED');
  assert.equal((await api('GET', '/api/admin/properties', { token: customer.token })).status, 403);
  const publicList = await api('GET', '/api/properties');
  for (const property of publicList.data) {
    assert.equal(Object.hasOwn(property, 'assignedVillaManager'), false);
    assert.equal(Object.hasOwn(property, 'assignedDataEntryUser'), false);
  }
});

test('server filters and KPI totals include legacy and unassigned properties accurately', async () => {
  const selfList = await api('GET', '/api/admin-console/properties?managementMode=SELF_MANAGED', { token: admin.token });
  assert.equal(selfList.data.total, 2);
  const managerList = await api('GET', '/api/admin-console/properties?managementMode=BOOKMYVILLA_MANAGED&assignedVillaManager=unassigned', { token: admin.token });
  assert.deepEqual(managerList.data.items.map(property => property._id), [String(unassigned._id)]);
  const entryList = await api('GET', '/api/admin-console/properties?assignedDataEntryUser=unassigned', { token: admin.token });
  assert.equal(entryList.data.total, 3);
  assert.equal((await api('GET', '/api/admin-console/properties?assignedVillaManager=invalid', { token: admin.token })).status, 400);
  const overview = await api('GET', '/api/admin-console/overview', { token: admin.token });
  assert.equal(overview.status, 200);
  assert.equal(overview.data.kpis.selfManagedProperties.value, 2);
  assert.equal(overview.data.kpis.companyManagedProperties.value, 2);
  assert.equal(overview.data.kpis.unassignedManagedProperties.value, 1);
});
