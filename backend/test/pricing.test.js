const test = require('node:test');
const assert = require('node:assert/strict');
const { priceQuote, promotionDiscount, addOnAmount } = require('../services/quotePricing');

test('accommodation only, no tax', () => {
  const result = priceQuote({ nights: 3, nightlyRate: 10000, checkIn: '2026-12-10', today: '2026-10-02' });
  assert.equal(result.totals.accommodation, 30000);
  assert.equal(result.totals.tax, 0);
  assert.equal(result.totals.total, 30000);
  assert.deepEqual(result.schedule, { advanceAmount: 30000, balanceAmount: 0, balanceDueDate: null });
});

test('GST hotel slab follows the tariff actually charged per night', () => {
  const high = priceQuote({ nights: 2, nightlyRate: 9000, taxMode: 'gst_hotel', checkIn: '2026-12-10', today: '2026-10-02' });
  assert.equal(high.accommodationTaxRate, 18);
  assert.equal(high.totals.tax, 3240);
  // A discount that brings the nightly tariff to 7,500 moves it into the 5% slab.
  const discounted = priceQuote({ nights: 2, nightlyRate: 9000, manualDiscount: 3000, taxMode: 'gst_hotel', checkIn: '2026-12-10', today: '2026-10-02' });
  assert.equal(discounted.accommodationNet, 15000);
  assert.equal(discounted.accommodationTaxRate, 5);
  assert.equal(discounted.totals.tax, 750);
  assert.equal(discounted.totals.total, 15750);
});

test('promotion percent is capped and applies to accommodation only', () => {
  const promo = { discountType: 'percent', discountValue: 20, maxDiscount: 3000 };
  assert.equal(promotionDiscount(promo, 10000), 2000);
  assert.equal(promotionDiscount(promo, 50000), 3000);
  assert.equal(promotionDiscount({ discountType: 'fixed', discountValue: 5000 }, 4000), 4000);
  const result = priceQuote({
    nights: 2, nightlyRate: 10000, promotion: promo,
    addOns: [{ unitPrice: 500, pricingUnit: 'per_guest_per_night', quantity: 4, taxRate: 5 }],
    taxMode: 'custom', customTaxRate: 12, checkIn: '2026-12-10', today: '2026-10-02'
  });
  assert.equal(result.totals.accommodation, 20000);
  assert.equal(result.totals.addOns, 4000);
  assert.equal(result.totals.discount, 3000);
  assert.equal(result.totals.taxable, 21000);
  // 12% on 17,000 accommodation + 5% on 4,000 breakfast.
  assert.equal(result.totals.tax, 2040 + 200);
  assert.equal(result.totals.total, 23240);
});

test('add-on multipliers and fees; tax mode none zeroes line taxes', () => {
  assert.equal(addOnAmount(1000, 'per_stay', 2, 3), 2000);
  assert.equal(addOnAmount(1000, 'per_night', 1, 3), 3000);
  assert.equal(addOnAmount(300, 'per_guest', 4, 3), 1200);
  assert.equal(addOnAmount(300, 'per_guest_per_night', 4, 3), 3600);
  const result = priceQuote({ nights: 3, nightlyRate: 5000, addOns: [{ unitPrice: 2500, pricingUnit: 'per_stay', quantity: 1, taxRate: 18 }], fees: [{ label: 'Cleaning', amount: 1000, taxRate: 18 }], checkIn: '2026-12-10', today: '2026-10-02' });
  assert.equal(result.totals.tax, 0);
  assert.equal(result.totals.total, 15000 + 2500 + 1000);
});

test('extra discount cannot exceed the remaining accommodation amount', () => {
  assert.throws(() => priceQuote({ nights: 1, nightlyRate: 5000, promotion: { discountType: 'fixed', discountValue: 4000 }, manualDiscount: 1500, checkIn: '2026-12-10', today: '2026-10-02' }), /extra discount/);
});

test('payment schedule splits advance and balance and never dates the balance in the past', () => {
  const result = priceQuote({ nights: 2, nightlyRate: 17500, advancePercent: 30, balanceDueDaysBeforeCheckIn: 7, checkIn: '2026-10-05', today: '2026-10-02' });
  assert.equal(result.totals.total, 35000);
  assert.equal(result.schedule.advanceAmount, 10500);
  assert.equal(result.schedule.balanceAmount, 24500);
  assert.equal(result.schedule.balanceDueDate, '2026-10-02');
  const later = priceQuote({ nights: 2, nightlyRate: 17500, advancePercent: 30, balanceDueDaysBeforeCheckIn: 1, checkIn: '2026-12-10', today: '2026-10-02' });
  assert.equal(later.schedule.balanceDueDate, '2026-12-09');
});
