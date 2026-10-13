import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  isValidDateRange,
  haversineDistance,
  matchesPropertyLocation,
  CURATED_LOCATIONS,
} from '../components/StaySearch/searchUtils.js';
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from '../services/googleMaps.js';

test('searchUtils - isValidCoordinate validates latitude and longitude ranges', () => {
  assert.equal(isValidCoordinate(17.9237, 73.6586), true); // Mahabaleshwar
  assert.equal(isValidCoordinate('18.7557', '73.4091'), true); // Lonavala
  assert.equal(isValidCoordinate(0, 0), true);
  assert.equal(isValidCoordinate(90, 180), true);
  assert.equal(isValidCoordinate(-90, -180), true);

  // Out of range
  assert.equal(isValidCoordinate(91, 73), false);
  assert.equal(isValidCoordinate(-95, 73), false);
  assert.equal(isValidCoordinate(18, 185), false);
  assert.equal(isValidCoordinate('invalid', 73), false);
  assert.equal(isValidCoordinate(null, undefined), false);
});

test('searchUtils - isValidDateRange validates date sequence', () => {
  assert.equal(isValidDateRange('2026-10-15', '2026-10-18'), true);
  assert.equal(isValidDateRange('2026-10-15', '2026-10-15'), false); // Same day not allowed
  assert.equal(isValidDateRange('2026-10-20', '2026-10-15'), false); // Checkout before checkin
  assert.equal(isValidDateRange('2026-10-15', ''), true); // Partial
});

test('searchUtils - haversineDistance computes accurate geographic distance in km', () => {
  // Mahabaleshwar [17.9237, 73.6586] to Panchgani [17.9244, 73.8016] is approx 15 km
  const distance = haversineDistance(17.9237, 73.6586, 17.9244, 73.8016);
  assert.ok(distance > 13 && distance < 18, `Distance was ${distance}`);
});

test('searchUtils - matchesPropertyLocation correctly matches various location formats', () => {
  const property = {
    name: 'Mistwood Manor Villa',
    location: 'Mahabaleshwar',
    region: 'Mahabaleshwar',
    type: 'Villa',
    lat: 17.9258,
    lon: 73.651,
  };

  // 1. Direct match
  assert.equal(matchesPropertyLocation(property, 'Mahabaleshwar'), true);
  assert.equal(matchesPropertyLocation(property, 'mahabaleshwar'), true);

  // 2. Google Places full formatted address match
  assert.equal(matchesPropertyLocation(property, 'Mahabaleshwar, Maharashtra, India'), true);

  // 3. Coordinate proximity match (within 35km radius)
  assert.equal(matchesPropertyLocation(property, '', 17.93, 73.66), true);

  // 4. Mismatched location
  assert.equal(matchesPropertyLocation(property, 'Manali, Himachal Pradesh'), false);
  assert.equal(matchesPropertyLocation(property, 'Goa'), false);

  // 5. Empty search matches all
  assert.equal(matchesPropertyLocation(property, ''), true);
});

test('searchUtils - CURATED_LOCATIONS includes primary hill stations and destinations', () => {
  const names = CURATED_LOCATIONS.map(([name]) => name);
  assert.ok(names.includes('Mahabaleshwar'));
  assert.ok(names.includes('Panchgani'));
  assert.ok(names.includes('Lonavala'));
  assert.ok(names.includes('Alibaug'));
  assert.ok(names.includes('Goa'));
});

test('googleMaps service - key detection handles placeholders securely', () => {
  // Verifies that placeholder strings are rejected as unconfigured
  const configured = isGoogleMapsConfigured();
  const apiKey = getGoogleMapsApiKey();
  // Either real key is provided or empty string returned
  assert.ok(typeof configured === 'boolean');
  assert.ok(typeof apiKey === 'string');
  assert.equal(apiKey.includes('your_google_maps_api_key'), false);
});
