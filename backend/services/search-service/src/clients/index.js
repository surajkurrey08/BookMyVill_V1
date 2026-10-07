const { internalRequest } = require('../../../../shared/internal');

// search-service reads villas and availability only through their owners.
module.exports = {
  publicVillas: ids => internalRequest('villa-service', '/internal/villas/public', { query: ids && { ids }, timeoutMs: 20000 }),
  unavailable: ({ checkIn, checkOut, guests, propertyIds }) => internalRequest('availability-service', '/internal/availability/unavailable', { query: { checkIn, checkOut, guests, propertyIds } })
};
