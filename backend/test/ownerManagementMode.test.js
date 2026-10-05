const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');

let admin, villaManager;
const path = '/api/admin-console/owners';
let n = 0;
const ownerBody = (extra = {}) => ({ name: 'Mode Owner', email: `mode-owner-${n += 1}@example.com`, password: 'owner-password-123', ...extra });
const create = body => h.api('POST', path, { body, token: admin.token });

test.before(async () => {
  await h.start();
  admin = await h.createAdmin();
  villaManager = await User.create({ name: 'Vera Manager', email: 'vera-manager@example.com', password: 'password-123', role: 'villa_manager', status: 'active' });
});
test.after(h.stop);

test('owners default to self-managed and their new properties stay self-managed', async () => {
  const result = await create(ownerBody());
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.managementMode, 'SELF_MANAGED');
  const property = await Property.create({ owner: result.data._id, name: 'Own Villa', location: 'Panchgani' });
  assert.equal(property.managementMode, 'SELF_MANAGED');
});

test('a BookMyVilla-managed owner passes the mode and Villa Manager to every new property', async () => {
  const managers = await h.api('GET', `${path}/villa-managers`, { token: admin.token });
  assert.equal(managers.status, 200);
  assert.ok(managers.data.some(m => m._id === String(villaManager._id)));

  const result = await create(ownerBody({ managementMode: 'BOOKMYVILLA_MANAGED', villaManager: String(villaManager._id) }));
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const saved = await User.findById(result.data._id);
  assert.equal(saved.ownerManagementMode, 'BOOKMYVILLA_MANAGED');

  const property = await Property.create({ owner: saved._id, name: 'Managed Villa', location: 'Mahabaleshwar' });
  const stored = await Property.findById(property._id).select('+assignedVillaManager');
  assert.equal(stored.managementMode, 'BOOKMYVILLA_MANAGED');
  assert.equal(String(stored.assignedVillaManager), String(villaManager._id));

  const explicit = await Property.create({ owner: saved._id, name: 'Kept Self', location: 'Wai', managementMode: 'SELF_MANAGED' });
  assert.equal(explicit.managementMode, 'SELF_MANAGED', 'an explicit mode is not overridden');
});

test('managed owner without a Villa Manager yet: properties are managed and unassigned', async () => {
  const result = await create(ownerBody({ managementMode: 'BOOKMYVILLA_MANAGED' }));
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const property = await Property.create({ owner: result.data._id, name: 'Queue Villa', location: 'Mahabaleshwar' });
  const stored = await Property.findById(property._id).select('+assignedVillaManager');
  assert.equal(stored.managementMode, 'BOOKMYVILLA_MANAGED');
  assert.equal(stored.assignedVillaManager, null);
});

test('invalid management choices are rejected', async () => {
  assert.equal((await create(ownerBody({ managementMode: 'SOMETHING' }))).status, 400);
  assert.equal((await create(ownerBody({ managementMode: 'SELF_MANAGED', villaManager: String(villaManager._id) }))).status, 400);
  assert.equal((await create(ownerBody({ managementMode: 'BOOKMYVILLA_MANAGED', villaManager: String(admin.user._id) }))).status, 400);
});
