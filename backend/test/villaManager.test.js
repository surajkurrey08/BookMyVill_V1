const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Housekeeping = require('../models/HousekeepingTask');
const { CHECKLIST } = require('../services/roomReadiness');
let vm, other, owner, owner2, guest, admin, entry, a, b, c, d, booking;
const call = (method, path, body, token = vm.token) => h.api(method, '/api' + path, { token, ...(body !== undefined && { body }) });
async function staff(role, suffix) { const user = await User.create({ name: suffix, email: `${suffix}@example.com`, password: 'password-123', role }); return { user, token: jwt.sign({ id: user._id, role }, process.env.JWT_SECRET) }; }
before(async () => {
  await h.start(); vm = await staff('villa_manager', 'manager'); other = await staff('villa_manager', 'other-manager'); entry = await staff('data_entry', 'entry'); owner = await h.createOwner('villa-owner'); owner2 = await h.createOwner('villa-owner2'); guest = await h.createCustomer(); admin = await h.createAdmin();
  a = await h.createProperty(owner.user, { name: 'Managed Mountain', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: vm.user._id });
  b = await h.createProperty(owner.user, { name: 'Other manager', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: other.user._id });
  c = await h.createProperty(owner.user, { name: 'Self managed', managementMode: 'SELF_MANAGED', assignedVillaManager: vm.user._id });
  d = await h.createProperty(owner2.user, { name: 'Managed Lake', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: vm.user._id });
});
after(h.stop);
test('1–5,14: manager login, role denial, server assignment/mode scopes, multi-owner pagination and privacy', async () => {
  const login = await h.api('POST', '/api/auth/login', { body: { email: vm.user.email, password: 'password-123' } }); assert.equal(login.status, 200);
  assert.equal((await call('GET', '/villa-manager/session', undefined, login.data.token)).status, 200);
  for (const account of [owner, guest, admin, entry]) assert.equal((await call('GET', '/villa-manager/session', undefined, account.token)).status, 403);
  const list = await call('GET', '/villa-manager/properties?limit=1'); assert.equal(list.status, 200); assert.equal(list.data.total, 2); assert.equal(list.data.items.length, 1);
  assert.equal((await call('GET', '/villa-manager/owners')).data.length, 2);
  for (const denied of [b, c]) {
    assert.equal((await call('GET', '/villa-manager/properties/' + denied.property._id)).status, 404);
    assert.equal((await call('GET', '/villa-manager/resources/bookings?propertyId=' + denied.property._id)).status, 404);
    assert.equal((await call('POST', '/villa-manager/tasks', { propertyId: denied.property._id, kind: 'task', title: 'Forbidden', dueDate: h.day() })).status, 404);
  }
  const scoped = await call('GET', '/villa-manager/properties?owner=' + owner2.user._id); assert.equal(scoped.data.total, 1); assert.equal(scoped.data.items[0].name, 'Managed Lake');
  const dto = (await call('GET', '/villa-manager/properties/' + a.property._id)).data;
  assert.deepEqual(Object.keys(dto.property.owner).sort(), ['_id', 'name']); assert.equal(dto.property.assignedDataEntryUser, undefined);
  const forged = jwt.sign({ id: owner.user._id, role: 'villa_manager' }, process.env.JWT_SECRET); assert.equal((await call('GET', '/villa-manager/session', undefined, forged)).status, 403);
});
test('6–8,12: new booking, capacity and verification guards, check-in, checkout, dirty/cleaning/inspection/ready', async () => {
  booking = await h.createBooking(guest.user, a.property, { room: a.room._id, checkIn: new Date(h.day() + 'T00:00:00Z'), checkOut: new Date(h.day(1) + 'T00:00:00Z'), guestDetails: { idProof: 'private-full-id', idLastFour: '1234' } });
  const list = await call('GET', '/villa-manager/resources/bookings'); assert.equal(list.data.total, 1); assert.equal(list.data.items[0].guestDetails.idProof, undefined); assert.equal(list.data.items[0].guestDetails.idLastFour, undefined);
  assert.equal((await call('POST', `/owner-ops/bookings/${booking._id}/check-in`, {})).status, 409);
  assert.equal((await call('PATCH', `/villa-manager/bookings/${booking._id}/details`, { actualGuests: 9 })).status, 400);
  assert.equal((await call('PATCH', `/villa-manager/bookings/${booking._id}/details`, { actualGuests: 4, idVerified: true, depositVerified: true, arrivalTime: '2:00 PM' })).status, 200);
  assert.equal((await call('POST', `/owner-ops/bookings/${booking._id}/check-in`, {})).status, 200);
  assert.equal((await call('GET', '/villa-manager/dashboard')).data.summary.activeGuests, 4);
  const checkout = await call('POST', `/owner-ops/bookings/${booking._id}/check-out`, {}); assert.equal(checkout.status, 200);
  const task = checkout.data.housekeepingTask || checkout.data.task || await Housekeeping.findOne({ booking: booking._id }); assert.ok(task);
  const taskId = task._id;
  assert.equal((await call('GET', '/villa-manager/properties/' + a.property._id)).data.rooms[0].readinessStatus, 'dirty');
  assert.equal((await call('PATCH', '/villa-manager/housekeeping/' + taskId, { stage: 'ready', checklist: CHECKLIST })).status, 409);
  assert.equal((await call('PATCH', '/owner-ops/housekeeping-task/' + taskId, { status: 'done' })).status, 409);
  for (const stage of ['cleaning', 'inspection']) assert.equal((await call('PATCH', '/villa-manager/housekeeping/' + taskId, { stage })).status, 200);
  assert.equal((await call('PATCH', '/villa-manager/housekeeping/' + taskId, { stage: 'ready' })).status, 409);
  assert.equal((await call('PATCH', '/villa-manager/housekeeping/' + taskId, { stage: 'ready', checklist: CHECKLIST })).status, 200);
  assert.equal((await call('GET', '/villa-manager/properties/' + a.property._id)).data.rooms[0].readinessStatus, 'ready');
  assert.equal((await Booking.findById(booking._id)).stayStatus, 'checked_out');
});
test('9–10: customer request routing, cross-property assignee denial and guest-visible complaint resolution', async () => {
  const stay = await h.createBooking(guest.user, d.property, { room: d.room._id, stayStatus: 'in_house' });
  const body = { bookingId: String(stay._id), kind: 'request', category: 'towels', description: 'Please bring clean towels' };
  assert.equal((await call('POST', '/stay/requests', body, guest.token)).status, 201);
  const complaint = await call('POST', '/stay/requests', { ...body, kind: 'issue', category: 'ac', description: 'AC is not cooling' }, guest.token); assert.equal(complaint.status, 201);
  const queue = await call('GET', '/villa-manager/resources/complaints?propertyId=' + d.property._id); assert.equal(queue.data.total, 1);
  assert.equal((await call('GET', '/villa-manager/resources/complaints', undefined, other.token)).data.total, 0);
  const staff = await call('POST', '/owner-ops/staff/' + d.property._id, { name: 'Repair staff', role: 'maintenance' });
  const alien = await call('POST', '/owner-ops/staff/' + a.property._id, { name: 'Other staff', role: 'maintenance' });
  assert.equal((await call('PATCH', '/owner-ops/guest-request/' + complaint.data._id, { status: 'acknowledged', assignedStaffId: String(alien.data._id) })).status, 400);
  for (const status of ['acknowledged', 'in_progress', 'completed']) assert.equal((await call('PATCH', '/owner-ops/guest-request/' + complaint.data._id, { status, assignedStaffId: String(staff.data._id), note: 'Repair completed' })).status, 200);
  const guestView = await call('GET', '/stay/requests?bookingId=' + stay._id, undefined, guest.token); assert.equal(guestView.data.find(r => r.kind === 'issue').status, 'completed');
  const checkout = await call('POST', '/stay/trips/' + stay._id + '/check-out', {}, guest.token); assert.equal(checkout.status, 200); assert.equal(await Housekeeping.countDocuments({ dedupeKey: 'checkout:' + stay._id }), 1);
});
test('11: maintenance updates customer availability, holds denied, resolution remains blocked until verification', async () => {
  const task = await call('POST', '/villa-manager/tasks', { propertyId: String(a.property._id), roomId: String(a.room._id), kind: 'maintenance', severity: 'out_of_order', title: 'Broken AC', dueDate: h.day() }); assert.equal(task.status, 201);
  const customer = await call('GET', `/customer-booking/properties/${a.property._id}/rooms?checkIn=${h.day(3)}&checkOut=${h.day(4)}&guests=2`, undefined, guest.token); assert.equal(customer.status, 200); assert.equal(customer.data.rooms[0].status, 'out_of_order');
  assert.equal((await call('POST', '/customer-booking/holds', { propertyId: String(a.property._id), roomId: String(a.room._id), checkIn: h.day(3), checkOut: h.day(4), guests: 2 }, guest.token)).status, 409);
  for (const status of ['in_progress', 'resolved']) assert.equal((await call('PATCH', '/villa-manager/tasks/' + task.data._id, { status })).status, 200);
  assert.equal((await Room.findById(a.room._id)).operationalStatus, 'out_of_order');
  assert.equal((await call('PATCH', '/villa-manager/tasks/' + task.data._id, { status: 'verified' })).status, 200);
  assert.equal((await Room.findById(a.room._id)).operationalStatus, 'ready');
});
test('extra guests, compatible reassignment audit, inventory, expenses and reports use scoped real records', async () => {
  const stay = await h.createBooking(guest.user, a.property, { room: a.room._id });
  assert.equal((await call('PATCH', '/villa-manager/rooms/' + a.room._id + '/pricing', { baseRate: 12000, extraGuestRate: 500 })).status, 200);
  const actual = await call('PATCH', `/villa-manager/bookings/${stay._id}/details`, { actualGuests: 6 }); assert.equal(actual.status, 200); assert.equal(actual.data.operations.extraGuestAmount, 2000); assert.equal(actual.data.operations.extraGuestPaymentStatus, 'pending');
  const alternative = await Room.create({ property: a.property._id, name: 'Lake suite', number: 'L2', type: 'Villa', capacity: 8, baseRate: 15000 });
  assert.equal((await call('GET', `/villa-manager/bookings/${stay._id}/alternatives`)).data.length, 1);
  assert.equal((await call('POST', `/villa-manager/bookings/${stay._id}/reassign`, { roomId: String(alternative._id), reason: 'Guest requested lake view' })).status, 200);
  assert.equal(String((await Booking.findById(stay._id)).room), String(alternative._id)); assert.equal((await Booking.findById(stay._id)).actionHistory.at(-1).action, 'Room Reassigned');
  const stock = await call('POST', '/villa-manager/inventory', { propertyId: String(a.property._id), itemName: 'Towels', category: 'Linen & Towels', quantity: 2, minThreshold: 5 }); assert.equal(stock.status, 201); assert.equal(stock.data.status, 'Low Stock');
  assert.equal((await call('PATCH', '/villa-manager/inventory/' + stock.data._id, { quantity: 20 })).data.status, 'In Stock');
  const expense = await call('POST', '/villa-manager/expenses', { propertyId: String(a.property._id), amount: 1000, category: 'maintenance', incurredOn: h.day(), description: 'AC repair' }); assert.equal(expense.status, 201); assert.equal(expense.data.approvalStatus, 'pending');
  assert.equal((await call('GET', '/villa-manager/reports')).status, 200);
  const check = await call('GET', `/villa-manager/bookings/${stay._id}/stay-change-check?kind=extend_stay&newCheckout=${h.day(5)}`); assert.equal(check.data.approved, false);
});
test('13,15: assignment removal, protected administration and finance, suspended sessions', async () => {
  for (const path of ['/admin-console/overview', '/owner-finance/summary', '/properties/data-entry/session']) assert.equal((await call('GET', path)).status, 403);
  const mode = await call('PUT', '/properties/' + a.property._id, { managementMode: 'SELF_MANAGED', assignedDataEntryUser: entry.user._id }); assert.ok([400, 403].includes(mode.status));
  await Property.updateOne({ _id: a.property._id }, { $set: { assignedVillaManager: null } });
  assert.equal((await call('GET', '/villa-manager/properties/' + a.property._id)).status, 404);
  assert.equal((await call('PATCH', '/villa-manager/rooms/' + a.room._id + '/pricing', { baseRate: 1 })).status, 404);
  assert.equal((await call('GET', '/villa-manager/properties')).data.total, 1);
  await User.updateOne({ _id: vm.user._id }, { $set: { status: 'suspended' } }); assert.equal((await call('GET', '/villa-manager/session')).status, 403);
});
