const { internalRequest } = require('../shared/internal');

// How booking-service and pricing-service reach payment-service (the only
// service that talks to the payment provider).
// True when online payment can be offered (false if payment-service is unreachable).
const online = requestId => internalRequest('payment-service', '/internal/payments/config', { requestId, timeoutMs: 3000 }).then(cfg => Boolean(cfg.available)).catch(() => false);

module.exports = {
  online,
  config: requestId => internalRequest('payment-service', '/internal/payments/config', { requestId }),
  createOrder: (order, requestId) => internalRequest('payment-service', '/internal/payments/orders', { method: 'POST', body: order, requestId, timeoutMs: 20000 }),
  attachBooking: (orderId, bookingId, requestId) => internalRequest('payment-service', `/internal/payments/orders/${encodeURIComponent(orderId)}/booking`, { method: 'PATCH', body: { bookingId: String(bookingId) }, requestId }),
  verifyQuote: (payload, requestId) => internalRequest('payment-service', '/internal/payments/quotes/verify', { method: 'POST', body: payload, requestId, timeoutMs: 20000 })
};
