// Shared by the stay search bar and the pages that host it. Dates are local
// calendar days as YYYY-MM-DD strings.
export const DEFAULT_LOCATION = 'Lonavala';

export const CURATED_LOCATIONS = [
  ['Mahabaleshwar', 'Hill station & scenic valleys · Satara'],
  ['Panchgani', 'Table-land & strawberry farms · Satara'],
  ['Lonavala', 'Sahyadri getaway & waterfalls · Pune'],
  ['Khandala', 'Ghats & valley viewpoints · Pune'],
  ['Matheran', 'Peaceful hill retreat · Raigad'],
  ['Igatpuri', 'Misty peaks & lakes · Nashik'],
  ['Bhandardara', 'Arthur Lake & Randha Falls · Ahmednagar'],
  ['Alibaug', 'Coastal beach villas · Raigad'],
  ['Pune', 'City stays & weekend getaways · Maharashtra'],
  ['Goa', 'Beachside & heritage stays · Goa'],
  ['Mumbai', 'Gateway stays & coastal escapes · Maharashtra'],
];

const pad = (value) => String(value).padStart(2, '0');
export const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const fromISO = (iso) => {
  if (!iso || typeof iso !== 'string') return new Date();
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const isoDay = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
export const todayISO = () => toISO(new Date());
export const addDays = (iso, count) => {
  const date = fromISO(iso);
  date.setDate(date.getDate() + count);
  return toISO(date);
};
export const formatDate = (iso) => iso ? fromISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Add date';
// Rounded, so a daylight-saving day of 23 or 25 hours still counts as one night.
export const nightsBetween = (from, to) => from && to ? Math.max(0, Math.round((fromISO(to) - fromISO(from)) / 86400000)) : 0;

/**
 * Validates geographic coordinate values.
 */
export const isValidCoordinate = (lat, lng) => {
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    Number.isFinite(numLat) &&
    numLat >= -90 &&
    numLat <= 90 &&
    Number.isFinite(numLng) &&
    numLng >= -180 &&
    numLng <= 180
  );
};

/**
 * Validates check-in and check-out dates.
 */
export const isValidDateRange = (checkIn, checkOut) => {
  if (!checkIn) return true;
  if (checkOut && checkOut <= checkIn) return false;
  return true;
};

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates.
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Intelligently matches a property against a search term and optional coordinates.
 * Supports:
 * 1. Substring matching in property location, name, region, type.
 * 2. Multi-part address token matching (e.g. "Mahabaleshwar, Maharashtra, India" matches "Mahabaleshwar").
 * 3. Geographic proximity match if coordinates are provided (within 35km).
 */
export const matchesPropertyLocation = (property, searchTerm, searchLat, searchLng) => {
  if (!searchTerm && !isValidCoordinate(searchLat, searchLng)) return true;

  const propLoc = String(property.location || '').toLowerCase();
  const propName = String(property.name || '').toLowerCase();
  const propRegion = String(property.region || '').toLowerCase();
  const propType = String(property.type || '').toLowerCase();

  const term = String(searchTerm || '').toLowerCase().trim();

  // 1. Direct contains check (either property contains term OR term contains property location)
  if (term) {
    if (propLoc && (propLoc.includes(term) || term.includes(propLoc))) return true;
    if (propRegion && (propRegion.includes(term) || term.includes(propRegion))) return true;
    if (propName.includes(term) || propType.includes(term)) return true;

    // 2. Comma-separated address parts check (e.g. from Google Place formatted address)
    const tokens = term
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && t !== 'india');

    for (const token of tokens) {
      if (propLoc.includes(token) || token.includes(propLoc)) return true;
      if (propRegion.includes(token) || token.includes(propRegion)) return true;
      if (propName.includes(token)) return true;
    }
  }

  // 3. Proximity check if search coordinates and property coordinates exist
  if (isValidCoordinate(searchLat, searchLng)) {
    const pLat = property.lat ?? property.latitude;
    const pLng = property.lon ?? property.lng ?? property.longitude;
    if (isValidCoordinate(pLat, pLng)) {
      const distanceKm = haversineDistance(
        Number(searchLat),
        Number(searchLng),
        Number(pLat),
        Number(pLng)
      );
      // Property within 35 km of selected place
      if (distanceKm <= 35) {
        return true;
      }
    }
  }

  return false;
};
