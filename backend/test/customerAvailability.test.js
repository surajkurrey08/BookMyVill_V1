const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Property = require('../models/Property');

let guest, villa, empty;
const availability = (checkIn, checkOut, guests = 2) => h.api('GET', `/api/customer-booking/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);

before(async () => {
  await h.start();
  guest = await h.createCustomer();
  const owner = await h.createOwner('availability-owner');
  villa = await h.createProperty(owner.user, { name: 'Whole Villa Stay', bookingMode: 'ENTIRE' }); // one 8-guest unit
  empty = await Property.create({ owner: owner.user._id, name: 'No units yet', location: 'Wai', status: 'approved' });
});
after(h.stop);

test('a whole villa held for some dates is unavailable for those dates only', async () => {
  const free = await availability(h.day(10), h.day(12));
  assert.equal(free.status, 200);
  assert.deepEqual(free.data.unavailable, []);

  const hold = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: String(villa.property._id), roomId: String(villa.room._id), checkIn: h.day(10), checkOut: h.day(12), guests: 4 } });
  assert.equal(hold.status, 201, JSON.stringify(hold.data));

  assert.deepEqual((await availability(h.day(11), h.day(13))).data.unavailable, [String(villa.property._id)]);
  assert.deepEqual((await availability(h.day(12), h.day(14))).data.unavailable, [], 'check-out day is free again');
});

test('too many guests or a hidden villa; listings without units are never hidden', async () => {
  assert.deepEqual((await availability(h.day(20), h.day(21), 9)).data.unavailable, [String(villa.property._id)], 'unit sleeps 8');
  assert.ok(!(await availability(h.day(20), h.day(21))).data.unavailable.includes(String(empty._id)));

  await Property.updateOne({ _id: villa.property._id }, { websiteVisible: false });
  assert.deepEqual((await availability(h.day(20), h.day(21), 9)).data.unavailable, [], 'hidden villas are not public at all');
  assert.equal((await h.api('GET', `/api/properties/${villa.property._id}`)).status, 404);

  assert.equal((await availability(h.day(-2), h.day(1))).status, 400, 'past dates are rejected');
});
