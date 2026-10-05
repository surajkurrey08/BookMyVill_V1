const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const PartnerApplication = require('../models/PartnerApplication');
const Audit = require('../models/AdminAudit');
let admin, operations, finance, customer;
const path = '/api/admin-console/owners';
const payload = { name: 'Direct Owner', email: 'direct-owner@example.com', phone: '+91 9811111111', password: 'owner-password-123' };
const create = (body, token = admin.token) => h.api('POST', path, { body, token });

test.before(async () => {
  await h.start();
  admin = await h.createAdmin(); operations = await h.createAdmin('operations');
  finance = await h.createAdmin('finance'); customer = await h.createCustomer();
});
test.after(h.stop);

test('Admin adds an active owner with hashed credentials, audit and immediate Owner panel access', async () => {
  const result = await create({ ...payload, email: ' DIRECT-OWNER@EXAMPLE.COM ', role: 'admin', status: 'suspended', adminPermissions: ['*'] });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.role, 'owner'); assert.equal(result.data.status, 'active');
  assert.equal(result.data.email, payload.email); assert.equal(result.data.password, undefined);
  const saved = await User.findById(result.data._id);
  assert.ok(await bcrypt.compare(payload.password, saved.password));
  assert.deepEqual(saved.adminPermissions, []); assert.ok(saved.ownerPasswordSetAt);
  assert.equal(await Property.countDocuments({ owner: saved._id }), 0);
  assert.equal(await PartnerApplication.countDocuments({ email: payload.email }), 0);
  const audit = await Audit.findOne({ action: 'owner.created', entityId: saved._id }).lean();
  assert.ok(audit); assert.equal(audit.after.password, undefined);
  const list = await h.api('GET', path + '?q=direct-owner', { token: admin.token });
  assert.equal(list.data.items[0]._id, saved.id); assert.equal(list.data.items[0].kyc, 'not_submitted');
  const login = await h.api('POST', '/api/auth/login', { body: { email: payload.email, password: payload.password } });
  assert.equal(login.status, 200); assert.equal(login.data.user.role, 'owner');
  assert.equal((await h.api('GET', '/api/owner-pms/properties', { token: login.data.token })).status, 200);
});

test('Owner creation requires permission, validates input and preserves existing users and applications', async () => {
  assert.equal((await h.api('POST', path, { body: payload })).status, 401);
  for (const token of [finance.token, customer.token]) assert.equal((await create(payload, token)).status, 403);
  for (const patch of [{ name: 'x' }, { email: 'invalid' }, { phone: 'invalid' }, { password: 'short' }, { password: '界'.repeat(30) }]) {
    assert.equal((await create({ ...payload, ...patch })).status, 400);
  }
  assert.equal((await create({ ...payload, email: payload.email.toUpperCase() })).status, 409);
  assert.equal((await create({ ...payload, email: customer.user.email })).status, 409);
  assert.equal((await User.findById(customer.user._id)).role, 'user');
  await PartnerApplication.create({ fullName: 'Pending Owner', email: 'application-owner@example.com', phone: '9811111111', partnerType: 'Property Owner', propertyName: 'Pending Villa', city: 'Panchgani' });
  assert.equal((await create({ ...payload, email: 'application-owner@example.com' })).status, 409);
  assert.equal(await User.countDocuments({ email: 'application-owner@example.com' }), 0);
  assert.equal((await create({ ...payload, email: 'operations-owner@example.com', phone: '' }, operations.token)).status, 201);
});

test('Concurrent owner creation cannot duplicate the same account', async () => {
  const body = { ...payload, email: 'concurrent-owner@example.com' };
  const results = await Promise.all([create(body), create(body)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: body.email }), 1);
  assert.equal(await Audit.countDocuments({ action: 'owner.created', 'after.email': body.email }), 1);
});
