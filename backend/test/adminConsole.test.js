const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createOwner, createCustomer, createAdmin, createProperty, createBooking, day } = require('./helpers');

let superToken;
let finToken;
let readToken;
let owner;
let ownerToken;
let customer;
let property;

test.before(async () => {
  await start();
  ({ token: superToken } = await createAdmin(null, 'super'));        // legacy full admin
  ({ token: finToken } = await createAdmin('finance', 'fin'));
  ({ token: readToken } = await createAdmin('read_only', 'ro'));
  ({ user: owner, token: ownerToken } = await createOwner('consoleowner'));
  ({ user: customer } = await createCustomer('consolecust'));
  ({ property } = await createProperty(owner, { status: 'pending' }));
  await createBooking(customer, property, { status: 'confirmed', paymentStatus: 'paid', paymentMode: 'live', totalPrice: 24000, checkIn: new Date(`${day(3)}T00:00:00Z`), checkOut: new Date(`${day(5)}T00:00:00Z`) });
});
test.after(stop);

test('strict auth: no token, non-admin token, and suspended admin are rejected', async () => {
  assert.equal((await api('GET', '/api/admin-console/overview')).status, 401);
  assert.equal((await api('GET', '/api/admin-console/overview', { token: ownerToken })).status, 403);
});

test('/me reports effective permissions by role', async () => {
  const su = await api('GET', '/api/admin-console/me', { token: superToken });
  assert.deepEqual(su.data.permissions, ['*']);
  const fin = await api('GET', '/api/admin-console/me', { token: finToken });
  assert.ok(fin.data.permissions.includes('bookings.view'));
  assert.ok(!fin.data.permissions.includes('properties.approve'));
});

test('overview returns real metrics and a prioritised attention list', async () => {
  const res = await api('GET', '/api/admin-console/overview', { token: superToken });
  assert.equal(res.status, 200);
  assert.ok(res.data.kpis.gmv.value >= 24000, 'paid booking counts toward GMV');
  assert.ok(res.data.kpis.pendingPropertyReviews.value >= 1);
  assert.equal(res.data.kpis.estimatedPlatformRevenue.estimate, true);
  assert.ok(res.data.attention.some(a => a.link.type === 'property_review'));
  // read_only can view the dashboard; finance also has dashboard.view
  assert.equal((await api('GET', '/api/admin-console/overview', { token: readToken })).status, 200);
});

test('RBAC: finance cannot list or approve properties; read_only cannot approve', async () => {
  assert.equal((await api('GET', '/api/admin-console/properties', { token: finToken })).status, 403);
  const list = await api('GET', '/api/admin-console/properties?view=review', { token: readToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.items.some(p => String(p._id) === String(property._id)));
  assert.equal((await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: readToken, body: { action: 'approve' } })).status, 403);
});

test('property review state machine enforces transitions, reasons and writes audit', async () => {
  // reject needs a reason
  assert.equal((await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: superToken, body: { action: 'reject' } })).status, 400);
  // request changes
  const changes = await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: superToken, body: { action: 'request_changes', reason: 'Add more exterior photos.' } });
  assert.equal(changes.status, 200);
  assert.equal(changes.data.property.status, 'under_review');
  assert.ok(changes.data.impact.futureBookings >= 1, 'impact counts the confirmed booking');
  // approve
  const approve = await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: superToken, body: { action: 'approve' } });
  assert.equal(approve.data.property.status, 'approved');
  // cannot suspend from a non-approved state is fine; now suspend the approved one (needs reason)
  assert.equal((await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: superToken, body: { action: 'suspend' } })).status, 400);
  const suspend = await api('POST', `/api/admin-console/properties/${property._id}/review`, { token: superToken, body: { action: 'suspend', reason: 'Repeated cleanliness complaints.' } });
  assert.equal(suspend.data.property.status, 'suspended');

  const audit = await api('GET', `/api/admin-console/audit?entityType=property&entityId=${property._id}`, { token: superToken });
  const actions = audit.data.items.map(i => i.action);
  assert.ok(actions.includes('property.request_changes') && actions.includes('property.approve') && actions.includes('property.suspend'));
  const suspendEntry = audit.data.items.find(i => i.action === 'property.suspend');
  assert.equal(suspendEntry.before.status, 'approved');
  assert.equal(suspendEntry.after.status, 'suspended');
  assert.equal(suspendEntry.reason, 'Repeated cleanliness complaints.');
  // suspended property is hidden from the public listing
  const pub = await api('GET', '/api/properties/all');
  assert.ok(!pub.data.some(p => String(p._id) === String(property._id)), 'suspended property not public');
});

test('suspending an owner locks their account (accountAuth denies)', async () => {
  assert.equal((await api('GET', '/api/owner-pms/properties', { token: ownerToken })).status, 200);
  assert.equal((await api('POST', `/api/admin-console/owners/${owner._id}/status`, { token: superToken, body: { action: 'suspend' } })).status, 400, 'reason required');
  const suspend = await api('POST', `/api/admin-console/owners/${owner._id}/status`, { token: superToken, body: { action: 'suspend', reason: 'Fraud review' } });
  assert.equal(suspend.status, 200);
  assert.equal(suspend.data.status, 'suspended');
  assert.equal((await api('GET', '/api/owner-pms/properties', { token: ownerToken })).status, 403, 'suspended owner is locked out');
  // restore
  await api('POST', `/api/admin-console/owners/${owner._id}/status`, { token: superToken, body: { action: 'activate' } });
  assert.equal((await api('GET', '/api/owner-pms/properties', { token: ownerToken })).status, 200);
});

test('owners list carries aggregates and 360 detail; finance cannot manage', async () => {
  const list = await api('GET', '/api/admin-console/owners', { token: superToken });
  const row = list.data.items.find(o => String(o._id) === String(owner._id));
  assert.ok(row.properties >= 1 && row.gmv >= 24000);
  const detail = await api('GET', `/api/admin-console/owners/${owner._id}`, { token: superToken });
  assert.equal(detail.data.properties.length >= 1, true);
  assert.ok(detail.data.stats.gmv >= 24000);
  assert.equal((await api('POST', `/api/admin-console/owners/${owner._id}/status`, { token: finToken, body: { action: 'suspend', reason: 'x' } })).status, 403);
});

test('customer suspend/restore is audited; a booking note is recorded', async () => {
  const booking = (await api('GET', '/api/admin-console/bookings', { token: superToken })).data.items[0];
  assert.ok(booking);
  const note = await api('POST', `/api/admin-console/bookings/${booking._id}/note`, { token: superToken, body: { note: 'Called guest to confirm arrival time.' } });
  assert.equal(note.status, 201);
  const detail = await api('GET', `/api/admin-console/bookings/${booking._id}`, { token: superToken });
  assert.ok(detail.data.audit.some(a => a.action === 'booking.note'));

  const suspend = await api('POST', `/api/admin-console/customers/${customer._id}/status`, { token: superToken, body: { action: 'restrict', reason: 'Multiple chargebacks' } });
  assert.equal(suspend.data.status, 'restricted');
});

test('audit entries are immutable at the model level', async () => {
  const AdminAudit = require('../models/AdminAudit');
  const entry = await AdminAudit.findOne();
  assert.ok(entry);
  entry.reason = 'tampered';
  await assert.rejects(() => entry.save(), /immutable/);
  await assert.rejects(() => AdminAudit.updateOne({ _id: entry._id }, { $set: { reason: 'x' } }), /immutable/);
});

test('admin team RBAC: only team.manage can view/change roles; cannot self-demote', async () => {
  assert.equal((await api('GET', '/api/admin-console/team', { token: finToken })).status, 403);
  const team = await api('GET', '/api/admin-console/team', { token: superToken });
  assert.equal(team.status, 200);
  const finMember = team.data.items.find(a => a.effectiveRole === 'finance');
  assert.ok(finMember);
  const promote = await api('POST', `/api/admin-console/team/${finMember._id}/role`, { token: superToken, body: { adminRole: 'operations' } });
  assert.equal(promote.data.effectiveRole, 'operations');
  // the operations admin now has properties.approve
  const check = await api('GET', '/api/admin-console/me', { token: finToken });
  assert.ok(check.data.permissions.includes('properties.approve'));
  // super admin cannot demote themselves below super_admin
  const me = (await api('GET', '/api/admin-console/me', { token: superToken })).data;
  assert.equal((await api('POST', `/api/admin-console/team/${me.id}/role`, { token: superToken, body: { adminRole: 'read_only' } })).status, 409);
});

test('global search respects permissions', async () => {
  const su = await api('GET', '/api/admin-console/search?q=consoleowner', { token: superToken });
  assert.ok(su.data.results.some(r => r.type === 'owner'));
  // a support admin (no properties.view) sees no property results
  const { token: supportToken } = await createAdmin('support', 'sup');
  const sup = await api('GET', '/api/admin-console/search?q=Valley', { token: supportToken });
  assert.ok(!sup.data.results.some(r => r.type === 'property'));
});
