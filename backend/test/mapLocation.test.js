const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { resolveMapLocation, parseCoordinateText, coordinatesInput } = require('../utils/mapLocation');

// Stand-in for fetch: share-link redirects and Places text search answers.
function fakeFetch(routes) {
  return async (url) => {
    const handler = routes[url];
    if (!handler) throw new Error(`unexpected fetch ${url}`);
    return handler();
  };
}
const redirect = location => () => ({ ok: false, status: 302, headers: new Headers({ location }) });

test('copied coordinates are understood in decimal and degree formats', () => {
  assert.deepEqual(parseCoordinateText('17.926460, 73.695895'), { lat: 17.92646, lng: 73.695895 });
  assert.deepEqual(parseCoordinateText('(18.5204 73.8567)'), { lat: 18.5204, lng: 73.8567 });
  assert.deepEqual(parseCoordinateText('17°55\'35.3"N 73°41\'45.2"E'), { lat: 17.926472, lng: 73.695889 });
  assert.equal(parseCoordinateText('Ward no. 3, 12 Main Road'), null, 'address numbers are not coordinates');
  assert.equal(parseCoordinateText('95.1, 73.2'), null, 'out of range');
});

test('full Google Maps links use the place pin before the map centre', async () => {
  const link = 'https://www.google.com/maps/place/The+Grand+Legacy/@17.9200,73.6900,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d17.9264605!4d73.6958951';
  const result = await resolveMapLocation(link, { fetchImpl: fakeFetch({}) });
  assert.deepEqual(result.coordinates, { lat: 17.926461, lng: 73.695895 });
  assert.equal(result.name, 'The Grand Legacy');
  assert.equal(result.source, 'link');
  assert.equal((await resolveMapLocation('https://maps.google.com/?q=18.7557,73.4091')).coordinates.lat, 18.7557);
  assert.equal((await resolveMapLocation('https://www.google.com/maps/@18.75,73.40,14z')).coordinates.lng, 73.4);
});

test('share links are expanded through Google redirects only', async () => {
  const fetchImpl = fakeFetch({
    'https://maps.app.goo.gl/abc123': redirect('https://www.google.com/maps/place/Villa/data=!3d17.5!4d73.25')
  });
  const result = await resolveMapLocation('https://maps.app.goo.gl/abc123', { fetchImpl });
  assert.deepEqual(result.coordinates, { lat: 17.5, lng: 73.25 });
  assert.equal(result.mapLink, 'https://maps.app.goo.gl/abc123', 'the short link is kept for guests');

  const offsite = fakeFetch({ 'https://maps.app.goo.gl/evil': redirect('https://evil.example.com/@17.5,73.25,15z') });
  await assert.rejects(resolveMapLocation('https://maps.app.goo.gl/evil', { fetchImpl: offsite }), { status: 422 });
  await assert.rejects(resolveMapLocation('https://example.com/maps/@17.5,73.25'), { status: 400 });
});

test('addresses and links without coordinates use Places text search', async () => {
  const previous = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
  try {
    const fetchImpl = fakeFetch({
      'https://places.googleapis.com/v1/places:searchText': () => ({ ok: true, json: async () => ({ places: [{ displayName: { text: 'Metgutad' }, formattedAddress: 'Metgutad, Maharashtra 412806, India', location: { latitude: 17.9244383, longitude: 73.6999731 } }] }) })
    });
    const result = await resolveMapLocation('Metgutad, Mahabaleshwar', { fetchImpl });
    assert.deepEqual(result.coordinates, { lat: 17.924438, lng: 73.699973 });
    assert.equal(result.address, 'Metgutad, Maharashtra 412806, India');
    assert.equal(result.source, 'search');
    assert.match(result.mapLink, /query=17\.924438,73\.699973$/);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY; else process.env.GOOGLE_MAPS_SERVER_API_KEY = previous;
  }
});

test('villa form coordinates are validated', () => {
  assert.equal(coordinatesInput(undefined), null);
  assert.deepEqual(coordinatesInput({ lat: '17.9', lng: 73.6 }), { lat: 17.9, lng: 73.6 });
  assert.throws(() => coordinatesInput({ lat: 200, lng: 73 }), { status: 400 });
  assert.throws(() => coordinatesInput('17.9,73.6'), { status: 400 });
});

describeRoutes();

// Route level: a manager resolves a pin, saves it on a villa, guests see it.
function describeRoutes() {
  const h = require('./helpers');
  const User = require('../models/User');
  const Property = require('../models/Property');
  let manager, villa;

  before(async () => {
    await h.start();
    const user = await User.create({ name: 'Map Manager', email: 'map-manager@example.com', password: 'password-123', role: 'villa_manager' });
    manager = jwt.sign({ id: user._id, role: 'villa_manager' }, process.env.JWT_SECRET);
    const owner = await User.create({ name: 'Map Owner', email: 'map-owner@example.com', password: 'password-123', role: 'owner' });
    villa = await Property.create({ owner: owner._id, name: 'Pin Villa', location: 'Panchgani', status: 'approved', managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: user._id, bookingMode: 'ENTIRE' });
  });
  after(() => h.stop());

  test('manager confirms a pasted location and guests receive the pin', async () => {
    const call = (method, path, body) => h.api(method, '/api/villa-manager/owner-directory' + path, { token: manager, body });
    const resolved = await call('POST', '/map-location', { input: '17.926460, 73.695895' });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.data));
    assert.deepEqual(resolved.data.coordinates, { lat: 17.92646, lng: 73.695895 });

    const saved = await call('PUT', `/villas/${villa._id}/location`, { coordinates: resolved.data.coordinates, mapLink: resolved.data.mapLink });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal((await call('PUT', `/villas/${villa._id}/location`, { coordinates: { lat: 'x', lng: 1 } })).status, 400);

    const publicView = await h.api('GET', `/api/properties/${villa._id}`);
    assert.deepEqual(publicView.data.coordinates, { lat: 17.92646, lng: 73.695895 });
    assert.match(publicView.data.mapLink, /query=17\.92646,73\.695895$/);
  });
}
