const { internalRequest } = require('../../../../shared/internal');

// What review-service needs from other services — over their internal APIs.
module.exports = {
  villaSummary: (id, requestId) => internalRequest('villa-service', `/internal/villas/${id}/summary`, { requestId }),
  villaAccess: (id, user, requestId) => internalRequest('villa-service', `/internal/villas/${id}/access`, { query: { userId: user.id, role: user.role, access: 'operate' }, requestId }),
  ownerVillas: (ownerId, requestId) => internalRequest('villa-service', '/internal/villas/owned', { query: { owner: ownerId }, requestId }),
  completedStay: (userId, propertyId, requestId) => internalRequest('booking-service', '/internal/bookings/completed-stay', { query: { userId, propertyId }, requestId })
};
