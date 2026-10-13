const { HttpError } = require('./validate');

// Turns whatever a manager copies out of Google Maps into an exact pin:
//   • share links (maps.app.goo.gl/…, goo.gl/maps/…) — expanded server-side
//   • full links (…/place/Name/@17.92,73.69,17z/data=…!3d17.926!4d73.695…, ?q=17.92,73.69)
//   • copied coordinates ("17.926460, 73.695895" or 17°55'35.3"N 73°41'45.2"E)
//   • a place name or address — found with Places API (New) text search
//     when GOOGLE_MAPS_SERVER_API_KEY is set.

const MAX_INPUT = 2048;
const MAX_LINK = 500; // Property.mapLink limit used by the villa forms
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co', 'share.google']);
const isGoogleHost = host => /(^|\.)google\.(com|[a-z]{2})(\.[a-z]{2})?$/i.test(host);
const isMapsHost = host => SHORT_HOSTS.has(host) || isGoogleHost(host);

const decode = text => { try { return decodeURIComponent(text); } catch { return text; } };
const round = n => Math.round(n * 1e6) / 1e6;
function point(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { lat: round(a), lng: round(b) };
}

const PAIR = /^\s*\(?\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*\)?\s*$/;
const DMS = /(\d{1,2})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([EW])/i;

// Coordinates typed or copied as plain text.
function parseCoordinateText(text) {
  const pair = PAIR.exec(text);
  if (pair) return point(pair[1], pair[2]);
  const dms = DMS.exec(text);
  if (dms) {
    const deg = (d, m, s, hemi) => (Number(d) + Number(m) / 60 + Number(s) / 3600) * (/[SW]/i.test(hemi) ? -1 : 1);
    return point(deg(dms[1], dms[2], dms[3], dms[4]), deg(dms[5], dms[6], dms[7], dms[8]));
  }
  return null;
}

// Coordinates inside a Google Maps URL, most precise first: the place pin
// (!3d…!4d…), then a coordinate query (?q=, ?query=, ?destination=, ?ll=…),
// then the map viewport centre (@lat,lng).
function parseMapUrl(url) {
  const text = decode(url.href);
  const pin = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(text);
  if (pin) return point(pin[1], pin[2]);
  for (const key of ['q', 'query', 'destination', 'daddr', 'll', 'center', 'sll']) {
    const value = url.searchParams.get(key);
    const found = value && parseCoordinateText(value.replace(/^loc:/i, ''));
    if (found) return found;
  }
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(text);
  return at ? point(at[1], at[2]) : null;
}

// Place name or search text in a link without coordinates (used for text search).
function searchTextOf(url) {
  const place = /\/maps\/place\/([^/@?]+)/.exec(url.pathname);
  if (place) return decode(place[1].replace(/\+/g, ' '));
  for (const key of ['q', 'query', 'destination', 'daddr']) {
    const value = url.searchParams.get(key);
    if (value && !parseCoordinateText(value)) return value;
  }
  return '';
}

// Follows a share link's redirects (Google hosts only) to the full Maps URL.
async function expandShortLink(url, fetchImpl = fetch) {
  let current = url;
  for (let hop = 0; hop < 5 && SHORT_HOSTS.has(current.hostname); hop++) {
    const response = await fetchImpl(current.href, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const location = response.headers.get('location');
    if (!location) break;
    const next = new URL(location, current);
    if (next.protocol !== 'https:' || !isMapsHost(next.hostname)) break;
    current = next;
  }
  // Cookie-consent interstitial carries the real link in ?continue=
  const cont = current.hostname.startsWith('consent.') && current.searchParams.get('continue');
  return cont ? new URL(cont) : current;
}

async function searchPlace(textQuery, fetchImpl = fetch) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key || !textQuery) return null;
  const response = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery, regionCode: 'in', maxResultCount: 1 })
  });
  if (!response.ok) throw new HttpError(502, 'Google Maps search is unavailable right now. Paste a link or coordinates instead.');
  const place = (await response.json()).places?.[0];
  const found = place?.location && point(place.location.latitude, place.location.longitude);
  return found ? { ...found, name: place.displayName?.text || '', address: place.formattedAddress || '' } : null;
}

const canonicalLink = ({ lat, lng }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

async function resolveMapLocation(input, { fetchImpl = fetch } = {}) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) throw new HttpError(400, 'Paste a Google Maps link, coordinates or an address.');
  if (text.length > MAX_INPUT) throw new HttpError(400, 'That is too long for a map link. Copy the share link from Google Maps instead.');

  let url = null;
  if (/^https?:\/\//i.test(text)) {
    try { url = new URL(text); } catch { throw new HttpError(400, 'That link is not valid. Copy it again from Google Maps.'); }
    if (!isMapsHost(url.hostname)) throw new HttpError(400, 'Paste a Google Maps link (google.com/maps or maps.app.goo.gl).');
  }

  let result = null; let source = 'coordinates'; let searchText = text;
  if (url) {
    source = 'link';
    if (SHORT_HOSTS.has(url.hostname)) {
      try { url = await expandShortLink(url, fetchImpl); } catch { throw new HttpError(502, 'Could not open that share link. Check the link or paste the coordinates instead.'); }
    }
    result = parseMapUrl(url);
    searchText = searchTextOf(url);
  } else {
    result = parseCoordinateText(text);
  }

  let name = url ? searchText : '';
  let address = '';
  if (!result) {
    const found = await searchPlace(searchText, fetchImpl);
    if (!found) {
      throw new HttpError(422, process.env.GOOGLE_MAPS_SERVER_API_KEY
        ? 'Google Maps could not find that place. Paste the share link or the pin\'s coordinates instead.'
        : 'Paste a Google Maps link or coordinates (address search is not set up on the server).');
    }
    ({ name, address } = found);
    result = { lat: found.lat, lng: found.lng };
    source = url ? 'link' : 'search';
  }

  const mapLink = url && text.length <= MAX_LINK ? text : canonicalLink(result);
  return { coordinates: result, mapLink, name, address, source };
}

// Coordinates sent with a villa form: { lat, lng } or nothing.
function coordinatesInput(value) {
  if (value === undefined || value === null || value === '') return null;
  const result = typeof value === 'object' ? point(value.lat, value.lng) : null;
  if (!result) throw new HttpError(400, 'Map location is not valid. Find and confirm it again.');
  return result;
}

module.exports = { resolveMapLocation, coordinatesInput, parseCoordinateText, parseMapUrl, expandShortLink, canonicalLink };
