const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createAdmin, createOwner } = require('./helpers');
const PartnerApplication = require('../models/PartnerApplication');
const PartnerInquiry = require('../models/PartnerInquiry');
const User = require('../models/User');
const Property = require('../models/Property');

let adminToken, readToken, ownerToken;
const contact = { fullName: 'Test Property Owner', email: 'partner-test@example.com', phone: '+91 98765 43210', city: 'Panchgani', propertyName: 'Test Valley Villa', message: 'Please help me register as a property owner.' };
test.before(async () => {
  await start();
  ({ token: adminToken } = await createAdmin());
  ({ token: readToken } = await createAdmin('read_only'));
  ({ token: ownerToken } = await createOwner());
});
test.after(stop);

test('registration and listing persist separately and appear in both admin views', async () => {
  const listing = await api('POST', '/api/partner/apply', { body: { ...contact, price: '18000', photos: ['/villa.jpg'] } });
  assert.equal(listing.status, 201);
  const signup = await api('POST', '/api/partner/apply', { body: { ...contact, email: ' PARTNER-TEST@example.com ', applicationType: 'owner-registration' } });
  assert.equal(signup.status, 201);
  assert.notEqual(signup.data.application._id, listing.data.application._id);
  const saved = await PartnerApplication.findById(signup.data.application._id);
  assert.equal(saved.status, 'pending');
  assert.equal(saved.phone, '919876543210');
  assert.equal(saved.price, '');
  assert.equal(await User.countDocuments({ email: contact.email }), 0);
  const modern = await api('GET', '/api/admin-console/partner-requests', { token: adminToken });
  assert.equal(modern.status, 200);
  assert.equal(modern.data.applications.filter(row => row.email === contact.email).length, 2);
  const classic = await api('GET', '/api/admin/partner-applications', { token: adminToken });
  assert.ok(classic.data.some(row => row._id === signup.data.application._id));
});

test('inquiries persist independently and can be marked contacted by an authorized admin', async () => {
  const before = await PartnerApplication.find({ email: contact.email }).lean();
  const response = await api('POST', '/api/partner/inquiry', { body: contact });
  assert.equal(response.status, 201);
  const id = response.data.inquiry._id;
  assert.equal((await PartnerInquiry.findById(id)).message, contact.message);
  assert.deepEqual(await PartnerApplication.find({ email: contact.email }).lean(), before);
  const requests = await api('GET', '/api/admin-console/partner-requests', { token: adminToken });
  assert.ok(requests.data.inquiries.some(row => row._id === id && row.email === contact.email));
  const overview = await api('GET', '/api/admin-console/overview', { token: adminToken });
  assert.ok(overview.data.attention.some(row => row.link.type === 'partner_inquiries'));
  assert.equal((await api('PATCH', `/api/admin-console/partner-inquiries/${id}`, { token: readToken, body: { status: 'contacted' } })).status, 403);
  assert.equal((await api('PATCH', `/api/admin-console/partner-inquiries/${id}`, { token: adminToken, body: { status: 'approved' } })).status, 400);
  const update = await api('PATCH', `/api/admin-console/partner-inquiries/${id}`, { token: adminToken, body: { status: 'contacted' } });
  assert.equal(update.status, 200);
  assert.equal((await PartnerInquiry.findById(id)).status, 'contacted');
});

test('owner registration approval creates an owner account without publishing an incomplete property', async () => {
  const signup = await PartnerApplication.findOne({ email: contact.email, applicationType: 'owner-registration' });
  const approved = await api('PUT', `/api/admin/partner-application/${signup._id}/status`, { token: adminToken, body: { status: 'approved' } });
  assert.equal(approved.status, 200);
  assert.equal((await User.findOne({ email: contact.email })).role, 'owner');
  assert.equal(await Property.countDocuments({ name: contact.propertyName }), 0);
  const setup = await api('POST', `/api/admin/partner-application/${signup._id}/setup-link`, { token: adminToken });
  assert.equal(setup.status, 200);
  assert.match(setup.data.token, /^[a-f0-9]{64}$/);
  assert.ok(new Date(setup.data.expiresAt) > new Date());
  const resubmit = await api('POST', '/api/partner/apply', { body: { ...contact, applicationType: 'owner-registration' } });
  assert.equal(resubmit.status, 409);
  assert.equal((await PartnerApplication.findById(signup._id)).status, 'approved');
});

test('invalid contacts are rejected and private requests require an admin session', async () => {
  const count = await PartnerInquiry.countDocuments();
  for (const body of [{ ...contact, phone: '123' }, { ...contact, email: 'wrong' }, { ...contact, message: 'short' }, { ...contact, fullName: '' }]) {
    assert.equal((await api('POST', '/api/partner/inquiry', { body })).status, 400);
  }
  assert.equal(await PartnerInquiry.countDocuments(), count);
  assert.equal((await api('GET', '/api/admin-console/partner-requests')).status, 401);
  assert.equal((await api('GET', '/api/admin-console/partner-requests', { token: ownerToken })).status, 403);
  const publicList = await api('GET', '/api/partner/all');
  assert.ok(publicList.data.every(row => row.status === 'approved' && !row.email && !row.phone && !row.message));
});
