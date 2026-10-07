// search-service: keeps its own derived index from villa events and asks
// availability-service for date availability.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const h = require('../../../test/helpers');

let owner;
before(async () => { await h.start(); owner = await h.createOwner('search-owner'); });
after(() => h.stop());

const waitFor = async (fn, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };

test('index follows villa events and hides villas booked or held for the dates', async () => {
  const SearchListing = require('../src/models/SearchListing');
  assert.equal(SearchListing.db.name.endsWith('_search'), true, 'search-service uses its own database in tests');
  const { property, room } = await h.createProperty(owner.user, { name: 'Search Lake Villa', location: 'Panchgani', bookingMode: 'ENTIRE' });
  const hidden = await h.createProperty(owner.user, { name: 'Hidden Villa', location: 'Panchgani', websiteVisible: false });
  assert.ok(await waitFor(async () => await SearchListing.exists({ villaId: String(property._id) })), 'villa.created reached the search index');
  assert.equal(await SearchListing.exists({ villaId: String(hidden.property._id) }), null, 'hidden villas are never indexed');

  let res = (await h.api('GET', '/api/v1/search/villas?q=panchgani')).data;
  assert.deepEqual(res.items.map(p => p.name), ['Search Lake Villa']);
  const RoomNight = require('../../../models/RoomNight');
  await RoomNight.create({ property: property._id, room: room._id, date: h.day(20), kind: 'booking', reference: new mongoose.Types.ObjectId(), operationId: new mongoose.Types.ObjectId() });
  res = (await h.api('GET', `/api/search/villas?q=panchgani&checkIn=${h.day(20)}&checkOut=${h.day(21)}&guests=2`)).data;
  assert.equal(res.items.length, 0, 'booked for that night (asked availability-service)');
  res = (await h.api('GET', `/api/search/villas?q=panchgani&checkIn=${h.day(22)}&checkOut=${h.day(23)}&guests=2`)).data;
  assert.equal(res.items.length, 1);

  // A guest's live checkout hold (Redis lock) also hides the villa for those dates.
  const guest = await h.createCustomer('search-guest');
  const hold = await h.api('POST', '/api/customer-booking/holds', { token: guest.token, body: { propertyId: String(property._id), roomId: String(room._id), checkIn: h.day(22), checkOut: h.day(23), guests: 2 } });
  assert.equal(hold.status, 201, JSON.stringify(hold.data));
  res = (await h.api('GET', `/api/search/villas?q=panchgani&checkIn=${h.day(22)}&checkOut=${h.day(23)}&guests=2`)).data;
  assert.equal(res.items.length, 0, 'held during checkout');

  const Property = require('../../../models/Property');
  await Property.updateOne({ _id: property._id }, { websiteVisible: false });
  assert.ok(await waitFor(async () => !(await SearchListing.exists({ villaId: String(property._id) }))), 'villa.updated removed a hidden villa from the index');
});
