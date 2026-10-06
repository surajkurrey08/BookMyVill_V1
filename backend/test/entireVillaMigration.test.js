const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const h = require('./helpers');
const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const { planMigration, applyMigration } = require('../services/entireVillaMigration');

let owner, single, resort, empty, bookingId;

before(async () => {
  await h.start();
  owner = await h.createOwner('migration-owner');
  single = await h.createProperty(owner.user, { name: 'Single Unit Villa' }); // helper adds one 8-guest unit
  const r = await h.createProperty(owner.user, { name: 'Room Resort', type: 'Resort', price: 9000 });
  resort = r.property;
  await Room.create({ property: resort._id, name: 'Deluxe', number: 'D2', type: 'Deluxe', capacity: 3, baseRate: 14000 });
  bookingId = new mongoose.Types.ObjectId();
  await RoomNight.create([
    { property: resort._id, room: r.room._id, date: h.day(5), kind: 'booking', reference: bookingId, operationId: new mongoose.Types.ObjectId() },
    { property: resort._id, room: r.room._id, date: h.day(-5), kind: 'booking', reference: bookingId, operationId: new mongoose.Types.ObjectId() }
  ]);
  empty = await Property.create({ owner: owner.user._id, name: 'No Units', location: 'Wai', price: 7000, listingData: { details: { guestCapacity: 6 } } });
});
after(h.stop);

test('dry run lists every room-by-room property without changing anything', async () => {
  const plan = await planMigration();
  assert.equal(plan.length, 3);
  const byName = Object.fromEntries(plan.map(p => [p.name, p]));
  assert.equal(byName['Single Unit Villa'].action, 'reuse_single_unit');
  assert.equal(byName['Room Resort'].action, 'merge_rooms_into_entire_unit');
  assert.equal(byName['Room Resort'].capacity, 11, 'all rooms together');
  assert.equal(byName['Room Resort'].rate, 14000, 'highest of property price and room rates');
  assert.equal(byName['Room Resort'].futureNights, 1);
  assert.equal(byName['No Units'].action, 'create_entire_unit');
  assert.equal(await Property.countDocuments({ bookingMode: 'ENTIRE' }), 0, 'dry run writes nothing');
});

test('apply makes every property a whole villa and keeps future booked dates closed', async () => {
  await applyMigration();
  assert.equal(await Property.countDocuments({ bookingMode: { $ne: 'ENTIRE' } }), 0);

  assert.equal(await Room.countDocuments({ property: single.property._id, active: true }), 1);
  const unit = await Room.findOne({ property: resort._id, number: 'ENTIRE' });
  assert.equal(unit.capacity, 11);
  assert.equal(await Room.countDocuments({ property: resort._id, active: true }), 1, 'old rooms deactivated, not deleted');
  assert.equal(await Room.countDocuments({ property: resort._id }), 3);
  const carried = await RoomNight.find({ room: unit._id }).lean();
  assert.deepEqual(carried.map(n => [n.date, n.kind, String(n.reference)]), [[h.day(5), 'booking', String(bookingId)]], 'only future nights carried');

  const emptyUnit = await Room.findOne({ property: empty._id });
  assert.equal(emptyUnit.capacity, 6);
  assert.equal(emptyUnit.baseRate, 7000);

  await require('../services/inventory').releaseBookingNights(bookingId);
  assert.equal(await RoomNight.countDocuments({ room: unit._id }), 0, 'cancelling the booking frees the villa too');
  assert.deepEqual(await planMigration(), [], 'running again is a no-op');
});

test('overlapping legacy bookings and blocks keep the entire villa closed until all references are released', async () => {
  const original = await h.createProperty(owner.user, { name: 'Overlapping legacy stays', price: 15000 });
  const second = await Room.create({ property: original.property._id, name: 'Second room', number: 'S2', type: 'Room', capacity: 2, baseRate: 7000 });
  const firstBooking = new mongoose.Types.ObjectId(), secondBooking = new mongoose.Types.ObjectId(), block = new mongoose.Types.ObjectId();
  for (const [room, kind, reference] of [[original.room, 'booking', firstBooking], [second, 'booking', secondBooking], [second, 'block', block]]) {
    await RoomNight.create({ property: original.property._id, room: room._id, date: h.day(kind === 'block' ? 31 : 30), kind, reference, operationId: new mongoose.Types.ObjectId() });
  }
  const guest = await h.createCustomer('overlapping-migration');
  const holdBody = { propertyId: String(original.property._id), roomId: String(original.room._id), checkIn: h.day(30), checkOut: h.day(31), guests: 2 };
  assert.equal((await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: holdBody })).status, 409, 'room-by-room bookings are no longer allowed');
  await applyMigration();
  const unit = await Room.findOne({ property: original.property._id, active: true });
  const inventory = require('../services/inventory');
  const copied = await RoomNight.findOne({ room: unit._id, date: h.day(30) });
  await inventory.releaseBookingNights(copied.reference);
  const remaining = String(copied.reference) === String(firstBooking) ? secondBooking : firstBooking;
  const calendar = await require('../services/availability').calendar(original.property._id, [h.day(30), h.day(31)]);
  assert.deepEqual(calendar.rooms.find(r => String(r._id) === String(unit._id)).days.map(d => d.status), ['booked', 'blocked']);
  const search = await h.api('GET', `/api/customer-booking/availability?checkIn=${h.day(30)}&checkOut=${h.day(31)}&guests=2`);
  assert.ok(search.data.unavailable.includes(String(original.property._id)), 'search still sees the other room booking');
  const publicUnits = await h.api('GET', `/api/customer-booking/properties/${original.property._id}/rooms?checkIn=${h.day(30)}&checkOut=${h.day(31)}&guests=2`);
  assert.equal(publicUnits.data.rooms.length, 1, 'inactive historical rooms are not offered');
  assert.equal(publicUnits.data.rooms[0].status, 'booked');
  assert.equal((await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { ...holdBody, roomId: String(unit._id) } })).status, 409);
  await inventory.releaseBookingNights(remaining);
  const hold = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { ...holdBody, roomId: String(unit._id) } });
  assert.equal(hold.status, 201, JSON.stringify(hold.data));
  assert.equal((await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { ...holdBody, roomId: String(unit._id), checkIn: h.day(31), checkOut: h.day(32) } })).status, 409, 'legacy blocks also protect the villa');
});

test('a failed migration restores legacy rooms and can be safely retried', async () => {
  const original = await h.createProperty(owner.user, { name: 'Retryable villa' });
  await Room.create({ property: original.property._id, name: 'Second room', number: 'R2', type: 'Room', capacity: 2, baseRate: 6000 });
  await RoomNight.create({ property: original.property._id, room: original.room._id, date: h.day(40), kind: 'booking', reference: new mongoose.Types.ObjectId(), operationId: new mongoose.Types.ObjectId() });
  const insertMany = RoomNight.insertMany;
  try {
    RoomNight.insertMany = async () => { throw new Error('Simulated ledger write failure'); };
    await assert.rejects(applyMigration(), /Simulated ledger write failure/);
  } finally { RoomNight.insertMany = insertMany; }
  assert.equal((await Property.findById(original.property._id)).bookingMode, 'ROOMS');
  assert.equal(await Room.countDocuments({ property: original.property._id }), 2, 'no orphaned entire villa unit');
  assert.equal(await Room.countDocuments({ property: original.property._id, active: true }), 2);
  await applyMigration();
  assert.equal(await Room.countDocuments({ property: original.property._id, active: true }), 1);
  assert.deepEqual(await planMigration(), []);
});

test('dry run preserves oversized guest totals and apply requires capacity review', async () => {
  const original = await h.createProperty(owner.user, { name: 'Large legacy property' });
  await Room.updateOne({ _id: original.room._id }, { capacity: 40 });
  await Room.create({ property: original.property._id, name: 'Second large room', number: 'L2', type: 'Room', capacity: 20, baseRate: 10000 });
  const plan = await planMigration();
  assert.equal(plan.find(p => String(p._id) === String(original.property._id)).capacity, 60, 'capacity is not silently capped');
  await assert.rejects(applyMigration(), /above the supported 50 guests/);
  assert.equal((await Property.findById(original.property._id)).bookingMode, 'ROOMS');
  assert.equal(await Room.countDocuments({ property: original.property._id, active: true }), 2);
});
