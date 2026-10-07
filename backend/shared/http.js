const { randomUUID } = require('node:crypto');

// Generic HTTP building blocks for the gateway and services (no domain logic).

const REQUEST_ID = /^[A-Za-z0-9._-]{8,80}$/;

// Keeps the caller's X-Request-Id (from the gateway) or creates one, and logs
// one structured line per request with its duration.
function requestContext(logger, metrics) {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', req.id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - started) / 1e6;
      if (!/^\/(health|ready|metrics)$|^\/api\/health$/.test(req.path)) {
        logger.info('request', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, duration: Math.round(duration) });
      }
      metrics?.observeRequest(req.method, res.statusCode, duration);
    });
    next();
  };
}

// Helmet-style response headers suitable for a JSON API.
function securityHeaders() {
  return (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-DNS-Prefetch-Control': 'off',
      'X-Permitted-Cross-Domain-Policies': 'none'
    });
    if (req.secure || req.get('x-forwarded-proto') === 'https') res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    res.removeHeader('X-Powered-By');
    next();
  };
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found.', requestId: req.id });
}

// Last error handler: never leaks stack traces; keeps the { msg } shape the
// existing panels already read, plus a requestId for support.
function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = Number(err.status || err.statusCode) || 500;
    if (status >= 500) logger.error('unhandled error', { requestId: req.id, path: req.originalUrl, error: err });
    if (res.headersSent) return;
    const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';
    res.status(status).json({ success: false, msg: message, message, requestId: req.id });
  };
}

// Trust proxies on loopback and private networks (host nginx, the gateway,
// Docker/Kubernetes pod networks) so req.ip is the real client address.
const TRUST_PROXY = ['loopback', 'linklocal', 'uniquelocal'];

// Wraps an async controller: errors become the standard JSON error response
// (HttpError status/message; 500 with a generic message otherwise).
const asyncHandler = label => fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { require('../utils/validate').sendError(res, err, label); }
};

module.exports = { requestContext, securityHeaders, notFound, errorHandler, asyncHandler, TRUST_PROXY };
