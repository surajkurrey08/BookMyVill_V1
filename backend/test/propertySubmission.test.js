const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
process.env.PROPERTY_MEDIA_DIR = path.join(os.tmpdir(), `bmv-property-submission-${process.pid}`);
const h = require('./helpers');
const { mediaDirectory } = require('../services/propertyMedia');
let owner, other;
test.before(async () => { await h.start(); owner = await h.createOwner('submission'); other = await h.createCustomer('submission-other'); });
test.after(async () => { await h.stop(); await fs.rm(mediaDirectory, { recursive: true, force: true }); });

test('empty owner inventory and tourist register return empty lists', async () => {
  for (const route of ['inventory', 'tourist-register']) {
    const result = await h.api('GET', `/api/${route}/owner`, { token: owner.token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, []);
  }
});

test('owner can create, retrieve and edit uploaded media, preserving stay info and approval', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  const body = { name: 'Uploaded Villa', location: 'Mahabaleshwar', photos: [`data:image/png;base64,${png.toString('base64')}`], videos: ['data:video/mp4;base64,aGVsbG8='], stayInfo: { wifiName: 'Private WiFi', wifiPassword: 'private-password', houseRules: ['Quiet after 10 PM'] } };
  assert.equal((await h.api('POST', '/api/properties/add', { token: other.token, body })).status, 403);
  const created = await h.api('POST', '/api/properties/add', { token: owner.token, body });
  assert.equal(created.status, 200);
  assert.equal(created.data.status, 'pending');
  assert.equal(created.data.bookingMode, 'ENTIRE');
  const unit = await require('../models/Room').findOne({ property: created.data._id });
  assert.equal(unit.name, 'Entire villa');
  assert.equal(unit.capacity, 2);
  assert.equal(created.data.stayInfo.wifiPassword, body.stayInfo.wifiPassword);
  assert.deepEqual(created.data.stayInfo.houseRules, body.stayInfo.houseRules);
  const photo = await fetch(created.data.photos[0]);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
  const video = await fetch(created.data.videos[0], { headers: { Range: 'bytes=0-1' } });
  assert.equal(video.status, 206);
  assert.equal(await video.text(), 'he');
  const updated = await h.api('PUT', `/api/properties/${created.data._id}`, { token: owner.token, body: { photos: created.data.photos, videos: ['data:video/webm;base64,aGVsbG8='] } });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data.photos, created.data.photos);
  assert.ok(updated.data.videos[0].endsWith('.webm'));
  const publicListings = await h.api('GET', '/api/properties/all');
  assert.equal(publicListings.data.some(p => p._id === created.data._id), false);
  const capacity = await h.api('PUT', `/api/properties/${created.data._id}`, { token: owner.token, body: { maxGuests: 6, price: 18000 } });
  assert.equal(capacity.status, 200);
  const editedUnit = await require('../models/Room').findById(unit._id);
  assert.equal(editedUnit.capacity, 6);
  assert.equal(editedUnit.baseRate, 18000);
});

test('missing required listing fields returns a JSON validation error', async () => {
  const result = await h.api('POST', '/api/properties/add', { token: owner.token, body: { name: 'Missing location' } });
  assert.equal(result.status, 400);
  assert.match(result.data.msg, /location/);
});

test('a database save failure removes new files and returns a JSON error', async t => {
  const before = await fs.readdir(mediaDirectory);
  t.mock.method(require('../models/Property').prototype, 'save', async () => { throw new Error('Simulated database save failure'); });
  t.mock.method(console, 'error', () => {});
  const result = await h.api('POST', '/api/properties/add', { token: owner.token, body: { name: 'Failed upload', location: 'Panchgani', photos: ['data:image/png;base64,aGVsbG8='] } });
  assert.equal(result.status, 500);
  assert.equal(typeof result.data.msg, 'string');
  assert.deepEqual(await fs.readdir(mediaDirectory), before);
});
