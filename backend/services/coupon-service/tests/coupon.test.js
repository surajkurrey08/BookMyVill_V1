// coupon-service: owns add-ons and promotions in its own database; other
// services evaluate and redeem through the internal API or booking.confirmed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../../../test/helpers');
const { promotionRuleFailure } = require('../src/services/promotionRules');

let owner, villa, Promotion;
before(async () => {
  await h.start();
  owner = await h.createOwner('coupon-owner');
  villa = await h.createProperty(owner.user, { name: 'Coupon Villa' });
  Promotion = require('../src/models/Promotion');
});
after(() => h.stop());

test('stay rules explain why a promotion does not apply', () => {
  const promo = { code: 'LONG', active: true, minNights: 3, properties: [], maxUses: 2, usedCount: 0 };
  const stay = { propertyId: 'x', today: '2030-01-01', checkIn: '2030-02-01', nights: 2, accommodationAmount: 1000, guests: 2 };
  assert.match(promotionRuleFailure(promo, stay), /at least 3 nights/);
  assert.equal(promotionRuleFailure(promo, { ...stay, nights: 3 }), null);
  assert.match(promotionRuleFailure({ ...promo, usedCount: 2 }, { ...stay, nights: 3 }), /usage limit/);
  assert.match(promotionRuleFailure({ ...promo, active: false }, stay), /paused/);
});

test('owner API stores promotions in the coupon database and shows villa names', async () => {
  const created = await h.api('POST', '/api/owner-catalog/promotions', { token: owner.token, body: { code: 'family5', name: 'Family', type: 'promo_code', discountType: 'percent', discountValue: 5, properties: [villa.property.id] } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.code, 'FAMILY5');
  assert.equal(created.data.properties[0].name, 'Coupon Villa');
  assert.equal(Promotion.db.name.endsWith('_coupon'), true, 'coupon-service uses its own database in tests');
  const outsider = await h.createOwner('coupon-outsider');
  assert.equal((await h.api('POST', '/api/owner-catalog/promotions', { token: outsider.token, body: { code: 'STEAL', name: 'x', type: 'promo_code', discountType: 'fixed', discountValue: 10, properties: [villa.property.id] } })).status, 404);
});

test('internal evaluate + redeem respect limits; booking.confirmed counts a use only once', async () => {
  await Promotion.create({ owner: owner.user.id, code: 'ONCE', name: 'Once', type: 'promo_code', discountType: 'fixed', discountValue: 500, maxUses: 1, createdBy: owner.user.id });
  const evaluate = await h.api('POST', '/internal/coupons/promotions/evaluate', { body: { owner: owner.user.id, code: 'once', propertyId: villa.property.id, checkIn: h.day(10), nights: 2, accommodationAmount: 10000, guests: 2 } });
  assert.equal(evaluate.status, 200);
  assert.equal(evaluate.data.promotion.code, 'ONCE');
  assert.equal(evaluate.data.failure, null);
  assert.equal((await h.api('POST', '/internal/coupons/promotions/evaluate', { body: { owner: owner.user.id, code: 'NOPE', propertyId: villa.property.id } })).data.promotion, null);

  const id = evaluate.data.promotion._id;
  assert.equal((await h.api('POST', `/internal/coupons/promotions/${id}/redeem`, { body: { owner: owner.user.id, discount: 500 } })).data.redeemed, true);
  assert.equal((await h.api('POST', `/internal/coupons/promotions/${id}/redeem`, { body: { owner: owner.user.id, discount: 500 } })).data.redeemed, false, 'limit reached');
  await h.api('POST', `/internal/coupons/promotions/${id}/release`, { body: { discount: 500 } });
  assert.equal((await Promotion.findById(id)).usedCount, 0);

  const { redeemForBooking } = require('../src/services/catalogService');
  const message = { id: 'evt-coupon', event: 'booking.confirmed', data: { bookingId: 'booking-1', promotion: { id, owner: owner.user.id, discount: 500 } } };
  assert.equal(await redeemForBooking(message), 'redeemed');
  assert.equal(await redeemForBooking(message), 'duplicate');
  assert.equal((await Promotion.findById(id)).usedCount, 1);
});

test('internal routes reject callers without the service token when one is configured', async () => {
  process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  try {
    assert.equal((await h.api('POST', '/internal/coupons/promotions/evaluate', { body: {} })).status, 403);
  } finally { process.env.INTERNAL_SERVICE_TOKEN = ''; }
});
