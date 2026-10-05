const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { start, stop, api, createOwner, createAdmin, createCustomer, createProperty, day } = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');
const prefix = '/api/properties/data-entry';
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
let staff, other, owner, admin, customer, manager, a, b;
async function account(role, label) {
  const user = await User.create({ name: label, email: `${label}-${crypto.randomBytes(3).toString('hex')}@example.com`, password: 'staff-password-123', role });
  return { user, token: jwt.sign({ id: user._id, role }, process.env.JWT_SECRET) };
}
test.before(async () => {
  await start();
  staff = await account('data_entry', 'Entry Staff'); other = await account('data_entry', 'Other Staff');
  owner = await createOwner('entry-owner'); admin = await createAdmin(); customer = await createCustomer(); manager = await account('villa_manager', 'Manager');
  a = await createProperty(owner.user, { name: 'Assigned Mountain Villa', assignedDataEntryUser: staff.user._id });
  b = await createProperty(owner.user, { name: 'Other Valley Villa', assignedDataEntryUser: other.user._id });
});
test.after(stop);
const call = (method, path, body, token = staff.token) => api(method, `${prefix}${path}`, { token, body });
async function saved() { return (await call('GET', `/${a.property._id}`)).data; }
async function save(draft) { const v = await saved(); return call('PUT', `/${a.property._id}`, { revision: v.revision, draft }); }
function complete(v) {
  return { ...v.draft, name: 'Completed Mountain Villa', photos: [photo], photoCategories: ['Exterior'], mapLink: 'https://maps.google.com/?q=Mahabaleshwar', amenities: ['Free High-Speed Wi-Fi', 'Private Swimming Pool'], details: { shortDescription: 'A spacious mountain villa.', description: 'A private villa with a mountain view, three bedrooms and a garden.', address: 'Hill Road 12', city: 'Mahabaleshwar', state: 'Maharashtra', pincode: '412806', guestCapacity: 8, bedrooms: 3, bathrooms: 3, checkInTime: '14:00', checkOutTime: '11:00', petPolicy: 'Pets allowed on request.', smokingPolicy: 'Outdoor smoking only.', partyPolicy: 'No loud parties.', childPolicy: 'Children welcome.' } };
}

test('CASE 1–4: backend authenticates staff, denies other roles, and scopes assignments and pagination', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: staff.user.email, password: 'staff-password-123' } });
  assert.equal(login.status, 200);
  assert.equal((await api('GET', `${prefix}/session`, { token: login.data.token })).status, 200);
  for (const token of [owner.token, admin.token, customer.token, manager.token]) {
    assert.equal((await call('GET', '/session', undefined, token)).status, 403);
    assert.equal((await call('PUT', `/${a.property._id}`, { revision: 0, draft: { name: 'Invalid edit' } }, token)).status, 403);
  }
  const list = await call('GET', '/?limit=1');
  assert.equal(list.status, 200); assert.equal(list.data.assigned, 1); assert.equal(list.data.items[0]._id, String(a.property._id));
  assert.equal((await call('GET', `/${b.property._id}`)).status, 404);
  assert.equal((await call('PUT', `/${b.property._id}`, { revision: 0, draft: { name: 'Intrusion' } })).status, 404);
  const assigned = await api('PATCH', `/api/admin-console/properties/${b.property._id}/management`, { token: admin.token, body: { assignedDataEntryUser: String(staff.user._id) } });
  assert.equal(assigned.status, 200);
  assert.equal((await call('GET', '/?q=Other%20Valley')).data.total, 1);
  assert.equal((await call('GET', `/?q=${encodeURIComponent(owner.user.name)}`)).data.total, 2);
  assert.equal((await call('GET', '/?page=2&limit=1')).data.items.length, 1);
  await api('PATCH', `/api/admin-console/properties/${b.property._id}/management`, { token: admin.token, body: { assignedDataEntryUser: String(other.user._id) } });
  assert.equal((await call('GET', `/${b.property._id}`)).status, 404);
  const v = await saved();
  assert.deepEqual(Object.keys(v.owner).sort(), ['_id', 'name']);
  for (const key of ['password', 'phone', 'email', 'assignedVillaManager', 'wifiPassword']) assert.equal(JSON.stringify(v).includes(`"${key}"`), false, key);
});

test('CASE 5–8: drafts, media and room content persist privately; invalid submissions and stale saves fail', async () => {
  const first = await saved();
  const incomplete = await call('POST', `/${a.property._id}/submit`, { revision: first.revision });
  assert.equal(incomplete.status, 422); assert.equal(incomplete.data.checks.some(c => !c.valid), true);
  const draft = { ...first.draft, name: 'Private draft title', photos: [photo], photoCategories: ['Pool'] };
  draft.rooms[0].name = 'Mountain Suite';
  const updated = await save(draft); assert.equal(updated.status, 200);
  assert.equal(updated.data.draft.photos[0], photo); assert.equal(updated.data.draft.photoCategories[0], 'Pool');
  assert.equal((await Room.findById(a.room._id)).name, 'Whole Villa');
  assert.equal((await Property.findById(a.property._id)).name, 'Assigned Mountain Villa');
  assert.equal((await api('GET', `/api/properties/${a.property._id}`)).data.name, 'Assigned Mountain Villa');
  assert.equal((await call('PUT', `/${a.property._id}`, { revision: first.revision, draft })).status, 409);
  // The existing Data Entry update API must not bypass private drafting.
  assert.equal((await api('PUT', `/api/properties/${a.property._id}`, { token: staff.token, body: { name: 'Legacy API draft' } })).status, 200);
  assert.equal((await Property.findById(a.property._id)).name, 'Assigned Mountain Villa');
  assert.equal((await save({ ...draft, details: { pincode: 'abc' } })).status, 400);
  assert.equal((await save({ ...draft, rooms: [{ ...draft.rooms[0], _id: String(b.room._id) }] })).status, 403);
});

test('CASE 9–11: complete submission uses existing review queue, changes and resubmission, and Admin approval', async () => {
  const v = await saved(); const draft = complete(v);
  draft.rooms = [...draft.rooms, { name: 'Garden Cottage', number: 'C2', type: 'Cottage', capacity: 4, bedType: 'Queen', view: 'Garden', sizeSqFt: 300, photos: [photo], amenities: ['Free High-Speed Wi-Fi'] }];
  const ready = await save(draft); assert.equal(ready.status, 200); assert.equal(ready.data.completion.percent, 100);
  const submitted = await call('POST', `/${a.property._id}/submit`, { revision: ready.data.revision });
  assert.equal(submitted.status, 200); assert.equal(submitted.data.dataStatus, 'READY_FOR_REVIEW'); assert.equal(submitted.data.status, 'pending');
  assert.equal((await Room.findById(a.room._id)).name, 'Mountain Suite');
  const cottage = await Room.findOne({ property: a.property._id, number: 'C2' }); assert.equal(cottage.capacity, 4); assert.equal(cottage.baseRate, a.property.price);
  assert.equal((await api('GET', `/api/properties/${a.property._id}`)).status, 404);
  assert.equal((await api('GET', `/api/customer-booking/properties/${a.property._id}/rooms?checkIn=${day(2)}&checkOut=${day(3)}&guests=2`)).status, 404);
  const queue = await api('GET', '/api/admin-console/properties?view=review', { token: admin.token }); assert.equal(queue.data.items.some(p => p._id === String(a.property._id)), true);
  assert.equal((await save({ name: 'Cannot edit while in review' })).status, 409);
  const review = await api('POST', `/api/admin-console/properties/${a.property._id}/review`, { token: admin.token, body: { action: 'request_changes', reason: 'Add a clear pool photo and correct the address.' } }); assert.equal(review.status, 200);
  const changes = await saved(); assert.equal(changes.dataStatus, 'CHANGES_REQUIRED'); assert.match(changes.reviewReason, /pool photo/);
  const fixed = await save({ ...changes.draft, details: { ...changes.draft.details, address: 'Corrected Hill Road 12' } }); assert.equal(fixed.status, 200);
  const resend = await call('POST', `/${a.property._id}/submit`, { revision: fixed.data.revision }); assert.equal(resend.status, 200);
  const approval = await api('POST', `/api/admin-console/properties/${a.property._id}/review`, { token: admin.token, body: { action: 'approve' } }); assert.equal(approval.status, 200);
  const done = await saved(); assert.equal(done.dataStatus, 'COMPLETED'); assert.equal(done.permissions.edit, false);
  assert.equal((await api('GET', `/api/properties/${a.property._id}`)).status, 200);
});

test('CASE 12: management, pricing, operations and financial writes remain denied; removed/suspended staff loses access', async () => {
  for (const body of [{ managementMode: 'SELF_MANAGED' }, { assignedDataEntryUser: String(other.user._id) }, { owner: String(staff.user._id) }, { price: 1 }, { status: 'approved' }, { details: { wifiPassword: 'secret' } }, { rooms: [{ name: 'Inject', active: false }] }]) {
    // Unlock via the existing authorized review workflow first.
    await Property.updateOne({ _id: a.property._id }, { dataEntryStatus: 'CHANGES_REQUIRED' });
    const v = await saved();
    assert.equal((await call('PUT', `/${a.property._id}`, { revision: v.revision, draft: body })).status, 403);
  }
  for (const path of ['/api/owner-finance/summary', '/api/owner-pms/properties', '/api/owner-ops/board', '/api/admin-console/properties']) assert.equal((await api('GET', path, { token: staff.token })).status, 403, path);
  assert.equal((await api('PATCH', `/api/admin-console/properties/${a.property._id}/management`, { token: staff.token, body: { managementMode: 'BOOKMYVILLA_MANAGED' } })).status, 403);
  await User.updateOne({ _id: staff.user._id }, { status: 'suspended' });
  assert.equal((await call('GET', '/session')).status, 403);
  await User.updateOne({ _id: staff.user._id }, { status: 'active' });
  await api('PATCH', `/api/admin-console/properties/${a.property._id}/management`, { token: admin.token, body: { assignedDataEntryUser: null } });
  assert.equal((await call('GET', `/${a.property._id}`)).status, 404);
  assert.equal((await call('GET', '/')).data.total, 0);
});
