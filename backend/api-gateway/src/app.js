const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../../shared/logger');
const { createMetrics } = require('../../shared/metrics');
const { requestContext, securityHeaders, errorHandler, TRUST_PROXY } = require('../../shared/http');
const { hit } = require('../../shared/cache');
const { SERVICES, resolveService, serviceUrl } = require('../../shared/serviceCatalog');
const { forward, probe } = require('./proxy');

// API Gateway — the single public backend entry point (port 2001).
// Routing comes from shared/serviceCatalog.js. Domain logic lives only in the
// services; the gateway does routing, CORS, rate limiting, security headers,
// request IDs, structured logs, token pre-validation and health aggregation.

// Services whose readiness decides /api/health (the deploy check). Others are
// reported but cannot fail the whole site.
const CRITICAL = (process.env.GATEWAY_CRITICAL_SERVICES || 'auth-service,user-service,villa-service,booking-service,payment-service').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY_BYTES = Number(process.env.GATEWAY_MAX_BODY_BYTES) || 55 * 1024 * 1024;
const RATE = { windowMs: 60000, max: Number(process.env.GATEWAY_RATE_LIMIT_PER_MINUTE) || 600, authMax: Number(process.env.GATEWAY_AUTH_RATE_LIMIT_PER_MINUTE) || 60 };

function createGateway({ env = process.env } = {}) {
  const logger = createLogger('api-gateway');
  const metrics = createMetrics('api-gateway');
  const app = express();
  app.set('trust proxy', TRUST_PROXY);
  app.disable('x-powered-by');
  const targets = Object.fromEntries(Object.keys(SERVICES).map(name => [name, serviceUrl(name, env)]));

  async function health() {
    const results = await Promise.all(Object.entries(targets).map(async ([name, target]) => [name, await probe(target, '/ready')]));
    const services = Object.fromEntries(results.map(([name, r]) => [name, r.ok ? 'ready' : r.status ? 'not_ready' : 'unreachable']));
    const ok = CRITICAL.every(name => services[name] === 'ready');
    return { ok, services };
  }

  app.use(requestContext(logger, metrics));
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway', uptime: Math.round(process.uptime()) }));
  app.get(['/ready', '/api/health'], async (req, res) => {
    const { ok, services } = await health();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', service: 'api-gateway', database: services['auth-service'] === 'ready' ? 'connected' : 'disconnected', services });
  });
  app.get('/metrics', (req, res) => res.type('text/plain; version=0.0.4').send(metrics.render()));

  app.use(securityHeaders());
  app.use(require('../../services/cors'));

  // Reject oversized uploads before they reach a service.
  app.use((req, res, next) => {
    if (Number(req.get('content-length') || 0) > MAX_BODY_BYTES) return res.status(413).json({ success: false, msg: 'Upload is too large.', requestId: req.id });
    next();
  });

  // Per-IP fixed-window rate limits, shared across gateway replicas via Redis.
  app.use(async (req, res, next) => {
    try {
      const sensitive = req.method === 'POST' && /^\/api\/(v1\/)?auth\//.test(req.path);
      const limit = sensitive ? RATE.authMax : RATE.max;
      const { count, resetMs } = await hit(`gw:rl:${sensitive ? 'auth' : 'all'}:${req.ip}`, RATE.windowMs);
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(Math.max(0, limit - count)));
      if (count > limit) {
        metrics.increment('bmv_gateway_rate_limited_total', { scope: sensitive ? 'auth' : 'all' });
        res.set('Retry-After', String(Math.ceil(resetMs / 1000)));
        return res.status(429).json({ success: false, msg: 'Too many requests. Please wait a minute and try again.', requestId: req.id });
      }
    } catch (error) { logger.warn('rate limiter unavailable', { error }); }
    next();
  });

  // Token pre-validation: identifies the caller for logs/metrics and forwards
  // x-gateway-user-* headers. Services still enforce their own authorization,
  // so an invalid token is passed through for the service to reject.
  app.use((req, res, next) => {
    const raw = req.get('x-auth-token') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (raw && env.JWT_SECRET) {
      try { const claims = jwt.verify(raw, env.JWT_SECRET); req.auth = { id: String(claims.id || ''), role: String(claims.role || '') }; }
      catch { metrics.increment('bmv_gateway_invalid_tokens_total'); }
    }
    next();
  });

  app.use((req, res) => {
    const service = resolveService(req.method, req.path);
    if (!service) return res.status(404).json({ success: false, msg: 'Route not found.', requestId: req.id });
    metrics.increment('bmv_gateway_routed_total', { target: service });
    forward(req, res, targets[service], { logger, service, timeoutMs: Number(env.GATEWAY_UPSTREAM_TIMEOUT_MS) || 60000 });
  });
  app.use(errorHandler(logger)); // e.g. CORS rejections -> JSON 403

  return { app, logger, targets };
}

module.exports = { createGateway };
