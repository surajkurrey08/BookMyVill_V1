// review-service: reviews live in its own database; it asks booking-service
// whether the guest completed a stay and villa-service who owns the villa.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../../../test/helpers');

let owner, villa, guest;
before(async () => {
  await h.start();
  owner = await h.createOwner('review-owner');
  villa = await h.createProperty(owner.user, { name: 'Review Villa' });
  guest = await h.createCustomer('review-guest');
});
after(() => h.stop());

test('only a completed paid stay can be reviewed, and the review is stored by review-service', async () => {
  const body = { propertyId: villa.property.id, rating: 5, reviewText: 'Lovely stay with a great view.' };
  assert.equal((await h.api('POST', '/api/feedback', { token: guest.token, body })).status, 403, 'no completed stay yet');
  await h.createBooking(guest.user, villa.property, { stayStatus: 'checked_out' });
  const created = await h.api('POST', '/api/feedback', { token: guest.token, body });
  assert.equal(created.status, 201, JSON.stringify(created.data));

  const Feedback = require('../src/models/Feedback');
  assert.equal(Feedback.db.name.endsWith('_review'), true, 'review-service uses its own database in tests');
  const saved = await Feedback.findById(created.data._id).lean();
  assert.equal(saved.propertyName, 'Review Villa', 'villa name came from villa-service');
  assert.equal(String(saved.ownerId), String(owner.user._id));

  const mine = await h.api('GET', '/api/feedback/owner', { token: owner.token });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.length, 1);
  const stranger = await h.createOwner('review-stranger');
  assert.equal((await h.api('GET', '/api/feedback/owner', { token: stranger.token })).data.length, 0);
  assert.equal((await h.api('PUT', `/api/feedback/${created.data._id}/toggle-select`, { token: stranger.token })).status, 404);
});
