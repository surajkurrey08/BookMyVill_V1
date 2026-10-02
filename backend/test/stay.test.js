const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createOwner, createCustomer, createProperty, createBooking, day } = require('./helpers');

let owner;
let ownerToken;
let rivalOwnerToken;
let customer;
let token;
let strangerToken;
let property;
let booking;

test.before(async () => {
  await start();
  ({ user: owner, token: ownerToken } = await createOwner('stayowner'));
  ({ token: rivalOwnerToken } = await createOwner('rivalowner'));
  ({ user: customer, token } = await createCustomer('traveller'));
  ({ token: strangerToken } = await createCustomer('stranger'));
  ({ property } = await createProperty(owner, { assignedCaretaker: { name: 'Suresh Pawar', phone: '9820011111' }, stayInfo: { wifiName: 'VillaNet', wifiPassword: 'hills123', checkInTime: '1:00 PM', houseRules: ['No loud music after 11 PM'] } }));
  booking = await createBooking(customer, property);
});
test.after(stop);

test('trip detail is scoped to the booking owner and exposes a stay pass', async () => {
  assert.equal((await api('GET', `/api/stay/trips/${booking._id}`)).status, 401);
  assert.equal((await api('GET', `/api/stay/trips/${booking._id}`, { token: strangerToken })).status, 404);
  const trip = await api('GET', `/api/stay/trips/${booking._id}`, { token });
  assert.equal(trip.status, 200, JSON.stringify(trip.data));
  assert.equal(trip.data.property.name, 'Valley View Villa');
  assert.equal(trip.data.stay.caretaker.name, 'Suresh Pawar');
  assert.equal(trip.data.stay.wifi.name, 'VillaNet');
  assert.equal(trip.data.stay.checkInTime, '1:00 PM');
  assert.ok(trip.data.stay.houseRules.includes('No loud music after 11 PM'));
  assert.equal(trip.data.deposit.amount, 5000);
  assert.equal(trip.data.deposit.status, 'held');
  assert.equal(trip.data.timeline.find(step => step.key === 'payment').state, 'done');
  assert.equal(trip.data.can.request, true);
  assert.equal(trip.data.can.reportIssue, true);
});

test('a pending (unpaid) booking cannot raise requests', async () => {
  const pending = await createBooking(customer, property, { status: 'pending', paymentStatus: 'pending' });
  const res = await api('POST', '/api/stay/requests', { token, body: { bookingId: pending._id, kind: 'request', category: 'towels', description: 'Two extra towels please' } });
  assert.equal(res.status, 409);
  assert.match(res.data.msg, /confirmed/);
});

let requestId;

test('guest raises a request; it is validated, scoped and visible to the owner', async () => {
  assert.equal((await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'request', category: 'nonsense', description: 'x y z' } })).status, 400);
  assert.equal((await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'request', category: 'towels', description: 'no' } })).status, 400);
  const created = await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'request', category: 'towels', description: 'Please send 2 extra towels and drinking water.' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.match(created.data.code, /^REQ-/);
  assert.equal(created.data.status, 'open');
  assert.equal(created.data.priority, 'normal');
  requestId = created.data._id;

  // Double-tap within a minute does not create a duplicate.
  const again = await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'request', category: 'towels', description: 'Please send 2 extra towels and drinking water.' } });
  assert.equal(again.data._id, requestId);

  // A stranger cannot create a request on someone else's booking.
  assert.equal((await api('POST', '/api/stay/requests', { token: strangerToken, body: { bookingId: booking._id, kind: 'request', category: 'towels', description: 'sneaky request here' } })).status, 404);

  // Owner sees it in Guest Operations; a rival owner does not.
  const ownerList = await api('GET', `/api/owner-ops/guest-requests/${property._id}`, { token: ownerToken });
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.data.openCount, 1);
  assert.ok(ownerList.data.requests.some(item => item._id === requestId));
  assert.equal((await api('GET', `/api/owner-ops/guest-requests/${property._id}`, { token: rivalOwnerToken })).status, 404);
});

test('an issue is high priority and allowed; board summary counts open requests', async () => {
  const issue = await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'issue', category: 'ac', description: 'The AC in the bedroom is not cooling.' } });
  assert.equal(issue.status, 201);
  assert.equal(issue.data.priority, 'high');
  assert.equal((await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'issue', category: 'towels', description: 'wrong category for an issue' } })).status, 400);
  const board = await api('GET', `/api/owner-ops/board/${property._id}?start=${day(0)}&end=${day(7)}`, { token: ownerToken });
  assert.equal(board.data.summary.openRequests, 2);
});

test('owner progresses a request and the guest sees the updates; terminal is enforced', async () => {
  assert.equal((await api('PATCH', `/api/owner-ops/guest-request/${requestId}`, { token: rivalOwnerToken, body: { status: 'in_progress' } })).status, 404);
  assert.equal((await api('PATCH', `/api/owner-ops/guest-request/${requestId}`, { token: ownerToken, body: { status: 'booked' } })).status, 400);
  const ack = await api('PATCH', `/api/owner-ops/guest-request/${requestId}`, { token: ownerToken, body: { status: 'in_progress', note: 'On the way', eta: '15 minutes' } });
  assert.equal(ack.status, 200);
  assert.equal(ack.data.status, 'in_progress');
  assert.equal(ack.data.eta, '15 minutes');

  const trip = await api('GET', `/api/stay/trips/${booking._id}`, { token });
  const mine = trip.data.requests.find(item => item._id === requestId);
  assert.equal(mine.status, 'in_progress');
  assert.equal(mine.eta, '15 minutes');
  assert.ok(mine.updates.some(u => u.note === 'On the way' && u.byRole === 'owner'));

  // In-progress cannot be cancelled by the guest; completed is terminal.
  assert.equal((await api('POST', `/api/stay/requests/${requestId}/cancel`, { token })).status, 409);
  const done = await api('PATCH', `/api/owner-ops/guest-request/${requestId}`, { token: ownerToken, body: { status: 'completed', note: 'Delivered' } });
  assert.equal(done.data.status, 'completed');
  assert.ok(done.data.resolvedAt);
  assert.equal((await api('PATCH', `/api/owner-ops/guest-request/${requestId}`, { token: ownerToken, body: { status: 'in_progress' } })).status, 409);
});

test('guest can cancel an open request of their own', async () => {
  const created = await api('POST', '/api/stay/requests', { token, body: { bookingId: booking._id, kind: 'request', category: 'taxi', description: 'Need a cab to Lonavala station at 9 AM.' } });
  assert.equal((await api('POST', `/api/stay/requests/${created.data._id}/cancel`, { token: strangerToken })).status, 404);
  const cancelled = await api('POST', `/api/stay/requests/${created.data._id}/cancel`, { token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.status, 'cancelled');
});

test('after checkout: service requests close, issues keep a grace window, deposit shows processing', async () => {
  const past = await createBooking(customer, property, { checkIn: new Date(`${day(-3)}T00:00:00.000Z`), checkOut: new Date(`${day(-1)}T00:00:00.000Z`), stayStatus: 'checked_out', actualCheckOut: new Date() });
  const trip = await api('GET', `/api/stay/trips/${past._id}`, { token });
  assert.equal(trip.data.can.request, false);
  assert.equal(trip.data.can.reportIssue, true, 'within 3-day grace window');
  assert.equal(trip.data.can.review, true);
  assert.equal(trip.data.deposit.status, 'processing');
  assert.equal((await api('POST', '/api/stay/requests', { token, body: { bookingId: past._id, kind: 'request', category: 'food', description: 'Dinner for four tonight please.' } })).status, 409);
  assert.equal((await api('POST', '/api/stay/requests', { token, body: { bookingId: past._id, kind: 'issue', category: 'billing', description: 'I was charged for a deposit I already paid in cash.' } })).status, 201);
});

test('cancelled paid booking shows refund tracking', async () => {
  const cancelled = await createBooking(customer, property, { status: 'cancelled', refundStatus: 'none' });
  const trip = await api('GET', `/api/stay/trips/${cancelled._id}`, { token });
  assert.equal(trip.data.refund.status, 'under_review');
  assert.equal(trip.data.refund.amount, 24000);
  assert.ok(trip.data.timeline.some(step => step.key === 'cancelled'));
});
