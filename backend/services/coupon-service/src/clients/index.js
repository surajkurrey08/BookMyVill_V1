const { internalRequest } = require('../../../../shared/internal');

// What coupon-service needs from other services — over their internal APIs.
module.exports = {
  // Validates that every id is a property the owner may operate; returns the ids.
  ownerSelection: (owner, ids, requestId) => internalRequest('villa-service', '/internal/villas/owner-selection', { method: 'POST', body: { owner: String(owner), ids: (ids || []).map(String) }, requestId }).then(r => r.ids),
  villaNames: (ids, requestId) => (ids.length ? internalRequest('villa-service', '/internal/villas/names', { query: { ids }, requestId }) : Promise.resolve([])),
  addOnInUse: (owner, addOnId, requestId) => internalRequest('pricing-service', `/internal/pricing/addons/${addOnId}/in-use`, { query: { owner }, requestId }).then(r => r.inUse),
  openPromotionQuotes: (owner, requestId) => internalRequest('pricing-service', '/internal/pricing/promotions/open-quotes', { query: { owner }, requestId })
};
