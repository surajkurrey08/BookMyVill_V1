#!/usr/bin/env node
// End-to-end smoke test of the microservice stack, isolated from real data:
// starts an in-memory MongoDB, runs the gateway + all 12 services on shifted
// ports (gateway 3001), then checks routing, health, CORS and errors through
// the gateway. Exit code 0 = all checks passed.   npm run smoke
const path = require('path');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { SERVICES } = require('../shared/serviceCatalog');

const OFFSET = 1000;
const GATEWAY = `http://127.0.0.1:${2001 + OFFSET}`;
const today = new Date(Date.now() + 5.5 * 3600000);
const day = n => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

const CHECKS = [
  ['gateway liveness', 'GET', '/health', { status: 200 }],
  ['gateway readiness + every service ready', 'GET', '/api/health', { status: 200, test: body => Object.values(body.services).every(s => s === 'ready') }],
  ['villa list (legacy path)', 'GET', '/api/properties/all', { status: 200, service: 'villa-service' }],
  ['villa list (v1 alias)', 'GET', '/api/v1/villas/all', { status: 200, service: 'villa-service' }],
  ['auth login validation', 'POST', '/api/auth/login', { status: 400, service: 'auth-service', body: {} }],
  ['auth v1 alias', 'POST', '/api/v1/auth/login', { status: 400, service: 'auth-service', body: {} }],
  ['admin console requires login', 'GET', '/api/admin-console/me', { status: 401, service: 'user-service' }],
  ['customer bookings require login', 'GET', '/api/bookings/my-bookings', { status: 401, service: 'booking-service' }],
  ['checkout verify -> payment-service', 'POST', '/api/customer-booking/holds/000000000000000000000000/verify', { status: 401, service: 'payment-service', body: {} }],
  ['payments API -> payment-service', 'GET', '/api/v1/payments/health-check', { status: 404, service: 'payment-service' }],
  ['owner calendar -> availability-service', 'GET', '/api/owner-pms/properties', { status: 401, service: 'availability-service' }],
  ['availability API', 'GET', `/api/v1/availability/unavailable?checkIn=${day(10)}&checkOut=${day(12)}&guests=2`, { status: 200, service: 'availability-service' }],
  ['quotes -> pricing-service', 'GET', '/api/owner-quotes', { status: 401, service: 'pricing-service' }],
  ['finance -> booking-service', 'GET', '/api/owner-finance/summary', { status: 401, service: 'booking-service' }],
  ['search', 'GET', `/api/v1/search/villas?q=villa&checkIn=${day(10)}&checkOut=${day(12)}&guests=2`, { status: 200, service: 'search-service', test: body => Array.isArray(body.items) }],
  ['reviews -> review-service', 'GET', '/api/feedback/admin', { status: 401, service: 'review-service' }],
  ['coupons -> coupon-service', 'GET', '/api/owner-catalog/promotions', { status: 401, service: 'coupon-service' }],
  ['media files -> media-service', 'GET', '/api/properties/media/not-a-file.txt', { status: 404, service: 'media-service' }],
  ['site heroes -> media-service', 'GET', '/api/site-heroes', { service: 'media-service' }],
  ['notifications require admin', 'GET', '/api/notifications', { status: 401, service: 'notification-service' }],
  ['internal APIs are not public', 'GET', '/internal/villas/names?ids=000000000000000000000000', { status: 404 }],
  ['unknown route', 'GET', '/api/does-not-exist', { status: 404 }]
];

async function request(method, pathName, { body, headers = {} } = {}) {
  const res = await fetch(GATEWAY + pathName, { method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, headers: res.headers, body: json };
}

async function waitFor(fn, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) { try { if (await fn()) return true; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
  return false;
}

(async () => {
  const mongo = await MongoMemoryServer.create();
  const env = { ...process.env, MONGODB_URI: mongo.getUri('bmv_smoke'), NODE_ENV: 'test', JWT_SECRET: 'smoke-secret', DEV_PORT_OFFSET: String(OFFSET), RABBITMQ_URL: '', REDIS_URL: '', LOG_LEVEL: 'warn' };
  const stack = spawn(process.execPath, [path.join(__dirname, 'dev-all.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  stack.stdout.on('data', c => { log += c; }); stack.stderr.on('data', c => { log += c; });
  let failed = 0;
  try {
    const up = await waitFor(async () => (await request('GET', '/api/health')).status === 200, 90000);
    if (!up) throw new Error('stack did not become ready in 90s');
    for (const [name, method, pathName, expect] of CHECKS) {
      const res = await request(method, pathName, { body: expect.body });
      const problems = [];
      if (expect.status && res.status !== expect.status) problems.push(`status ${res.status} != ${expect.status}`);
      if (expect.service && res.headers.get('x-served-by') !== expect.service) problems.push(`served by ${res.headers.get('x-served-by')} != ${expect.service}`);
      if (expect.test && !expect.test(res.body || {})) problems.push('body check failed');
      if (!res.headers.get('x-request-id')) problems.push('missing X-Request-Id');
      console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${name}${problems.length ? ` — ${problems.join('; ')}` : ''}`);
      failed += problems.length ? 1 : 0;
    }
    const preflight = await fetch(`${GATEWAY}/api/properties/all`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
    const allow = preflight.headers.get('access-control-allow-origin');
    const corsOk = preflight.status === 204 && allow === 'http://localhost:5173';
    console.log(`${corsOk ? 'PASS' : 'FAIL'}  CORS preflight answered once by the gateway`);
    const simple = await fetch(`${GATEWAY}/api/properties/all`, { headers: { Origin: 'http://localhost:5173' } });
    const single = simple.headers.get('access-control-allow-origin') === 'http://localhost:5173';
    console.log(`${single ? 'PASS' : 'FAIL'}  single Access-Control-Allow-Origin on proxied response`);
    const limited = (await request('GET', '/api/properties/all')).headers.get('ratelimit-limit');
    console.log(`${limited ? 'PASS' : 'FAIL'}  rate limit headers`);
    let direct = 0;
    for (const [name, def] of Object.entries(SERVICES)) { const r = await fetch(`http://127.0.0.1:${def.port + OFFSET}/ready`); if (r.status === 200) direct++; else console.log(`FAIL  ${name} /ready ${r.status}`); }
    console.log(`${direct === 12 ? 'PASS' : 'FAIL'}  ${direct}/12 services report /ready`);
    failed += [corsOk, single, Boolean(limited), direct === 12].filter(ok => !ok).length;
  } catch (error) {
    failed++; console.error(`FAIL  ${error.message}\n--- stack log (tail) ---\n${log.slice(-4000)}`);
  } finally {
    stack.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1500));
    await mongo.stop();
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll smoke checks passed');
  process.exit(failed ? 1 : 0);
})();
