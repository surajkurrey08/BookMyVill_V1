const repo = require('../repositories/listingRepository');
const clients = require('../clients');
const { cleanText, escapeRegex, HttpError } = require('../../../../utils/validate');

// Public villa search over the search-service's own index.
const SORTS = { 'price-low': ['price', 1], 'price-high': ['price', -1], newest: ['createdAt', -1], name: ['name', 1] };

function guestCount(value) {
  const guests = Number(value || 2);
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) throw new HttpError(400, 'Choose 1–50 guests.');
  return guests;
}

async function search(query) {
  const q = cleanText(query.q || query.location || query.search || '', 80);
  if (q === null) throw new HttpError(400, 'Search text is too long.');

  if (query.lat !== undefined && query.lat !== null && query.lat !== '') {
    const lat = Number(query.lat);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new HttpError(400, 'Invalid latitude range (-90 to 90).');
  }
  if (query.lng !== undefined && query.lng !== null && query.lng !== '') {
    const lng = Number(query.lng);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new HttpError(400, 'Invalid longitude range (-180 to 180).');
  }
  if (query.placeId !== undefined && query.placeId !== null && query.placeId !== '') {
    const placeId = cleanText(query.placeId, 120);
    if (placeId === null) throw new HttpError(400, 'Invalid placeId.');
  }

  const [key, direction] = SORTS[query.sort] || SORTS.name;
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));

  let rows = await repo.all();
  if (q) { const pattern = new RegExp(escapeRegex(q), 'i'); rows = rows.filter(r => pattern.test(r.name) || pattern.test(r.type) || pattern.test(r.location)); }
  if (query.guests !== undefined) { const guests = guestCount(query.guests); rows = rows.filter(r => !r.guestCapacity || r.guestCapacity >= guests); }
  if (query.checkIn || query.checkOut) {
    const { unavailable } = await clients.unavailable({ checkIn: query.checkIn, checkOut: query.checkOut, guests: guestCount(query.guests), propertyIds: rows.map(r => r.villaId) });
    const taken = new Set(unavailable);
    rows = rows.filter(r => !taken.has(r.villaId));
  }
  rows.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction);
  return { items: rows.slice((page - 1) * limit, page * limit).map(r => r.view), total: rows.length, page, limit };
}

module.exports = { search };
