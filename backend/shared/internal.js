const { HttpError } = require('../utils/validate');
const { serviceUrl } = require('./serviceCatalog');

// Service-to-service HTTP. Internal routes live under /internal/* on each
// service; the API Gateway never routes /internal, and in Docker/Kubernetes
// services are not published, so these are reachable only inside the network.
// When INTERNAL_SERVICE_TOKEN is set every internal call must present it.

const TOKEN_HEADER = 'x-internal-token';

function requireInternal(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (expected && req.get(TOKEN_HEADER) !== expected) return res.status(403).json({ msg: 'Internal endpoint.' });
  next();
}

// Calls another service. 4xx responses become HttpError with the same status
// and message (so callers can pass them through); network errors and 5xx
// become 503 "temporarily unavailable".
async function internalRequest(service, pathName, { method = 'GET', body, query, timeoutMs = 8000, requestId } = {}) {
  const url = new URL(pathName, `${serviceUrl(service)}/`);
  for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(process.env.INTERNAL_SERVICE_TOKEN && { [TOKEN_HEADER]: process.env.INTERNAL_SERVICE_TOKEN }), ...(requestId && { 'x-request-id': requestId }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    throw new HttpError(503, `${service.replace(/-service$/, '')} is temporarily unavailable. Please try again.`);
  }
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;
  if (response.status < 500) throw new HttpError(response.status, data.msg || data.message || 'Request was rejected.');
  throw new HttpError(503, `${service.replace(/-service$/, '')} is temporarily unavailable. Please try again.`);
}

module.exports = { requireInternal, internalRequest, TOKEN_HEADER };
