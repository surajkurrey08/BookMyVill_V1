// Tests never talk to a real Redis/RabbitMQ from backend/.env (dotenv keeps existing keys).
process.env.REDIS_URL = '';
process.env.RABBITMQ_URL = '';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const h = require('./helpers');
const { SERVICES, resolveService, prefixTable } = require('../shared/serviceCatalog');

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
let gateway, gatewayUrl, upstream, upstreamPort, owner;

before(async () => {
  await h.start();
  owner = await h.createOwner('micro-owner');
  // One fake upstream answering for every service: echoes what it received.
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*'); // must be stripped by the gateway
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ path: req.url, method: req.method, body, requestId: req.headers['x-request-id'], forwardedFor: req.headers['x-forwarded-for'], user: req.headers['x-gateway-user-id'] || null }));
    });
  });
  upstreamPort = await listen(upstream);
  const env = { ...process.env, JWT_SECRET: process.env.JWT_SECRET };
  for (const name of Object.keys(SERVICES)) env[`${name.replace(/-/g, '_').toUpperCase()}_URL`] = `http://127.0.0.1:${upstreamPort}`;
  env.SEARCH_SERVICE_URL = 'http://127.0.0.1:1'; // nothing listens here
  const { createGateway } = require('../api-gateway/src/app');
  gateway = http.createServer(createGateway({ env }).app);
  gatewayUrl = `http://127.0.0.1:${await listen(gateway)}`;
});
after(async () => {
  for (const server of [gateway, upstream]) { server?.closeAllConnections(); server?.close(); }
  await h.stop();
});

test('catalog routes every legacy prefix to exactly one service, longest prefix first', () => {
  assert.equal(resolveService('GET', '/api/properties/all'), 'villa-service');
  assert.equal(resolveService('GET', '/api/properties/media/abc.jpg'), 'media-service');
  assert.equal(resolveService('POST', '/api/customer-booking/holds/abc/verify'), 'payment-service');
  assert.equal(resolveService('POST', '/api/v1/bookings/holds/abc/verify'), 'payment-service');
  assert.equal(resolveService('POST', '/api/customer-booking/holds/abc/pay'), 'booking-service');
  assert.equal(resolveService('GET', '/api/owner-finance/summary'), 'booking-service');
  assert.equal(resolveService('POST', '/api/bookings'), 'booking-service');
  assert.equal(resolveService('GET', '/api/bookings/my-bookings'), 'booking-service');
  assert.equal(resolveService('POST', '/api/bookings/cancel/1'), 'booking-service');
  assert.equal(resolveService('GET', '/api/v1/search/villas'), 'search-service');
  assert.equal(resolveService('GET', '/api/propertiesx'), null, 'prefix must end at a path boundary');
  assert.equal(resolveService('GET', '/api/unknown'), null);
  const prefixes = prefixTable().map(r => r.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length, 'no prefix is claimed twice');
  const ports = Object.values(SERVICES).map(s => s.port);
  assert.equal(new Set(ports).size, ports.length);
  assert.ok(!ports.includes(2001), 'port 2001 belongs to the gateway');
});

test('gateway streams requests to the service with request id, forwarded-for and verified identity', async () => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 'user-42', role: 'user' }, process.env.JWT_SECRET);
  const res = await fetch(`${gatewayUrl}/api/customer-booking/holds?x=1`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token, Origin: 'http://localhost:5173' }, body: JSON.stringify({ a: 1 }) });
  assert.equal(res.status, 200);
  const echoed = await res.json();
  assert.equal(echoed.path, '/api/customer-booking/holds?x=1');
  assert.equal(echoed.body, '{"a":1}');
  assert.equal(echoed.user, 'user-42');
  assert.ok(echoed.requestId && echoed.requestId === res.headers.get('x-request-id'));
  assert.ok(echoed.forwardedFor);
  assert.equal(res.headers.get('x-served-by'), 'booking-service');
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173', 'gateway CORS replaces the upstream wildcard');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('ratelimit-limit'));
});

test('gateway answers 404 for unknown routes, 503 when a service is down, and rejects foreign origins', async () => {
  assert.equal((await fetch(`${gatewayUrl}/api/nope`)).status, 404);
  const down = await fetch(`${gatewayUrl}/api/v1/search/villas`);
  assert.equal(down.status, 503);
  assert.ok((await down.json()).requestId);
  assert.equal((await fetch(`${gatewayUrl}/api/properties/all`, { headers: { Origin: 'https://evil.example' } })).status, 403);
  const tooBig = await fetch(`${gatewayUrl}/api/properties/add`, { method: 'POST', headers: { 'Content-Length': String(60 * 1024 * 1024), 'Content-Type': 'application/json' }, body: 'x'.repeat(10) }).catch(() => null);
  if (tooBig) assert.equal(tooBig.status, 413);
});

test('in-process event bus delivers only to matching subscribers', async () => {
  const bus = require('../messaging');
  const received = [];
  await bus.subscribe('test.queue', ['booking.*'], message => { received.push(message.event); });
  await bus.publish(bus.events.BOOKING_CANCELLED, { bookingId: null });
  await bus.publish(bus.events.VILLA_DELETED, { villaId: null });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(received, ['booking.cancelled']);
});
