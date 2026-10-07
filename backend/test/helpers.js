// Integration-test harness: mounts the real routers on an ephemeral port and
// talks to a real MongoDB. Set TEST_MONGODB_URI to use an existing server
// (e.g. mongodb://127.0.0.1:27017); otherwise mongodb-memory-server is used.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
// No real broker/cache in tests; identities are never cached between requests.
process.env.REDIS_URL = '';
process.env.RABBITMQ_URL = '';
process.env.IDENTITY_CACHE_SECONDS = '0';
process.env.INTERNAL_SERVICE_TOKEN = '';
// Expected warnings (retries, unreachable test upstreams) stay out of test output.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mirror index.js: buffering off and every router (and so every model) loaded
// before the connection opens. Models' automatic init then fails exactly as
// it does in production, so tests catch code that relies on it.
mongoose.set('bufferCommands', false);
// Every router is mounted exactly as production wires them (shared/runService),
// so all models load before the connection opens, like index.js.
const { mountAll, startAllConsumers } = require('../shared/runService');
const quiet = { info() {}, warn() {}, error() {}, debug() {}, child() { return quiet; } };
let independent = [];

let memoryServer = null;
let server = null;
let baseUrl = '';

async function start() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  const dbName = `bmv_test_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '1mb' }));
  independent = mountAll(app);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  // Same post-connect index build as index.js.
  const { ensureModelIndexes } = require('../utils/modelIndexes');
  await Promise.all(Object.values(mongoose.models).map(model => ensureModelIndexes(model)));
  // Each independent service gets its OWN database, proving data ownership.
  for (const def of independent) await def.database.connect(quiet, { uri, dbName: `${dbName}_${def.database.key.toLowerCase()}` });
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Internal service-to-service calls reach this same app.
  for (const name of Object.keys(require('../shared/serviceCatalog').SERVICES)) process.env[`${name.replace(/-/g, '_').toUpperCase()}_URL`] = baseUrl;
  await startAllConsumers(quiet);
}

async function stop() {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const def of independent) { if (def.database.ready()) await def.database.connection.dropDatabase(); await def.database.close(); }
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}

const User = () => require('../models/User');
const Property = () => require('../models/Property');
const Room = () => require('../models/Room');

async function createOwner(label = 'owner') {
  const user = await User().create({ name: `Test ${label}`, email: `${label}-${crypto.randomBytes(4).toString('hex')}@example.com`, password: 'password-123', role: 'owner', phone: '9800000000' });
  const token = jwt.sign({ id: user._id, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

async function createProperty(owner, overrides = {}) {
  const property = await Property().create({ owner: owner._id, name: 'Valley View Villa', type: 'Villa', location: 'Mahabaleshwar', price: 12000, status: 'approved', ...overrides });
  const room = await Room().create({ property: property._id, name: 'Whole Villa', number: 'V1', type: 'Villa', capacity: 8, baseRate: 12000 });
  return { property, room };
}

// YYYY-MM-DD in India, offset by `days`.
function day(days = 0) {
  const { indiaDate, addDays } = require('../utils/validate');
  return addDays(indiaDate(), days);
}

async function createAdmin(adminRole = null, label = 'admin') {
  const user = await User().create({ name: `Admin ${label}`, email: `${label}-${crypto.randomBytes(4).toString('hex')}@example.com`, password: 'password-123', role: 'admin', adminRole });
  const token = jwt.sign({ id: user._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

async function createCustomer(label = 'guest') {
  const user = await User().create({ name: `Test ${label}`, email: `${label}-${crypto.randomBytes(4).toString('hex')}@example.com`, password: 'password-123', role: 'user', phone: '9811111111' });
  const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

const Booking = () => require('../models/Booking');

async function createBooking(customer, property, overrides = {}) {
  return Booking().create({
    user: customer._id, property: property._id, checkIn: new Date(`${day(2)}T00:00:00.000Z`), checkOut: new Date(`${day(4)}T00:00:00.000Z`),
    totalPrice: 24000, status: 'confirmed', paymentStatus: 'paid', paymentMode: 'live', paidAt: new Date(),
    securityDepositAmount: 5000, guests: 4, ...overrides
  });
}

module.exports = { start, stop, api, createOwner, createCustomer, createAdmin, createProperty, createBooking, day };
