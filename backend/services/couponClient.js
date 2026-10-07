const { internalRequest } = require('../shared/internal');

// How booking-service and pricing-service reach coupon-service (owner of
// add-ons and promotions).
module.exports = {
  // Active add-ons a guest may choose at this villa.
  offeredAddOns: (owner, property, requestId) => internalRequest('coupon-service', '/internal/coupons/addons/offered', { query: { owner: String(owner), property: String(property) }, requestId }),
  addOnsByIds: (owner, ids, requestId) => (ids.length ? internalRequest('coupon-service', '/internal/coupons/addons', { query: { owner: String(owner), ids: ids.map(String) }, requestId }) : Promise.resolve([])),
  // { promotion, failure }: promotion null when the code does not exist.
  evaluatePromotion: (input, requestId) => internalRequest('coupon-service', '/internal/coupons/promotions/evaluate', { method: 'POST', body: { ...input, owner: String(input.owner), propertyId: String(input.propertyId) }, requestId }),
  redeem: (owner, id, discount, { force = false } = {}, requestId) => internalRequest('coupon-service', `/internal/coupons/promotions/${id}/redeem`, { method: 'POST', body: { owner: String(owner), discount, force }, requestId }).then(r => r.redeemed),
  release: (id, discount, requestId) => internalRequest('coupon-service', `/internal/coupons/promotions/${id}/release`, { method: 'POST', body: { discount }, requestId })
};
