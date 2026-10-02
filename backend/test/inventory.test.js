const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, api, createOwner, createProperty, day } = require('./helpers');

let RoomNight;
let inventory;
let owner;
let token;
let room;
let property;

test.before(async () => {
  await start();
  RoomNight = require('../models/RoomNight');
  inventory = require('../services/inventory');
  ({ user: owner, token } = await createOwner('inv'));
  ({ property, room } = await createProperty(owner));
});
test.after(stop);

test('concurrent reservations of the same nights: exactly one wins', async () => {
  const dates = [day(30), day(31), day(32)];
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => inventory.reserveNights(room, dates, 'booking', new mongoose.Types.ObjectId())));
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  assert.ok(attempts.filter(item => item.status === 'rejected').every(item => item.reason.status === 409));
  assert.equal(await RoomNight.countDocuments({ room: room._id, date: { $in: dates } }), 3);
});

test('overlapping ranges racing: no night is double-owned and losers leave nothing behind', async () => {
  const ranges = [[day(40), day(41), day(42)], [day(42), day(43)], [day(39), day(40)]];
  const results = await Promise.allSettled(ranges.map(dates => inventory.reserveNights(room, dates, 'booking', new mongoose.Types.ObjectId())));
  const won = ranges.filter((_, i) => results[i].status === 'fulfilled').flat();
  const stored = await RoomNight.find({ room: room._id, date: { $in: ranges.flat() } }).lean();
  assert.deepEqual(stored.map(night => night.date).sort(), [...new Set(won)].sort());
});

test('a lapsed hold never blocks a new reservation', async () => {
  const dates = [day(50), day(51)];
  const quoteId = new mongoose.Types.ObjectId();
  await inventory.reserveNights(room, dates, 'hold', quoteId, { expiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(() => inventory.reserveNights(room, dates, 'block', new mongoose.Types.ObjectId()), { status: 409 });
  await RoomNight.updateMany({ reference: quoteId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await inventory.reserveNights(room, dates, 'block', new mongoose.Types.ObjectId());
  assert.equal(await RoomNight.countDocuments({ reference: quoteId }), 0);
});

test('converting a hold moves nights to the booking and restores the hold if a night is taken', async () => {
  const dates = [day(60), day(61), day(62)];
  const quoteId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + 3600000);
  await inventory.reserveNights(room, dates, 'hold', quoteId, { expiresAt });
  // Night 2 lapses and someone else takes it.
  await RoomNight.updateOne({ reference: quoteId, date: dates[1] }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await RoomNight.deleteOne({ reference: quoteId, date: dates[1] });
  await inventory.reserveNights(room, [dates[1]], 'booking', new mongoose.Types.ObjectId());
  const bookingId = new mongoose.Types.ObjectId();
  await assert.rejects(() => inventory.convertHoldToBooking(room, dates, quoteId, bookingId), { status: 409 });
  assert.equal(await RoomNight.countDocuments({ reference: bookingId }), 0);
  assert.equal(await RoomNight.countDocuments({ kind: 'hold', reference: quoteId }), 2);

  const freeQuote = new mongoose.Types.ObjectId();
  const freeDates = [day(70), day(71)];
  await inventory.reserveNights(room, freeDates, 'hold', freeQuote, { expiresAt });
  const okBooking = new mongoose.Types.ObjectId();
  const result = await inventory.convertHoldToBooking(room, freeDates, freeQuote, okBooking);
  assert.equal(result.converted, 2);
  assert.equal(await RoomNight.countDocuments({ kind: 'booking', reference: okBooking, expiresAt: null }), 2);
});

test('owner calendar hides lapsed holds and owner blocks clear them', async () => {
  const dates = [day(80), day(81)];
  const quoteId = new mongoose.Types.ObjectId();
  await inventory.reserveNights(room, dates, 'hold', quoteId, { expiresAt: new Date(Date.now() + 60000) });
  let calendar = await api('GET', `/api/owner-pms/properties/${property._id}/availability?start=${day(80)}&end=${day(82)}`, { token });
  assert.equal(calendar.status, 200);
  assert.equal(calendar.data.nights.filter(night => night.kind === 'hold').length, 2);
  await RoomNight.updateMany({ reference: quoteId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  calendar = await api('GET', `/api/owner-pms/properties/${property._id}/availability?start=${day(80)}&end=${day(82)}`, { token });
  assert.equal(calendar.data.nights.length, 0);
  const block = await api('POST', `/api/owner-pms/rooms/${room._id}/blocks`, { token, body: { start: day(80), end: day(82), reason: 'Painting' } });
  assert.equal(block.status, 201);
});

test('checkout creates the turnover cleaning task exactly once', async () => {
  const Booking = require('../models/Booking');
  const booking = await Booking.create({
    user: null, guest: { name: 'Walk-in Guest' }, property: property._id, room: room._id,
    checkIn: new Date(`${day(-1)}T00:00:00.000Z`), checkOut: new Date(`${day(0)}T00:00:00.000Z`),
    totalPrice: 12000, status: 'confirmed', stayStatus: 'in_house', actualCheckIn: new Date()
  });
  const first = await api('POST', `/api/owner-ops/bookings/${booking._id}/check-out`, { token });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.warning, null);
  assert.equal(first.data.task.category, 'turnover');
  const HousekeepingTask = require('../models/HousekeepingTask');
  assert.equal(await HousekeepingTask.countDocuments({ booking: booking._id }), 1);
  assert.equal((await api('POST', `/api/owner-ops/bookings/${booking._id}/check-out`, { token })).status, 409);
});
