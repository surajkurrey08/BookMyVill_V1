/**
 * Location resolution and search helper for BookMyVilla Mobile
 */

/**
 * Resolves the exact landmark, address, and city location for any villa object.
 * Correctly handles string locations from MongoDB, landmark fields, and prevents 'Goa' fallback.
 */
export function formatVillaLocation(villa) {
  if (!villa) return 'Mahabaleshwar, Maharashtra';

  // 1. Check for explicit landmark or area
  const landmark = (typeof villa.landmark === 'string' && villa.landmark.trim()) ||
                   (typeof villa.location?.landmark === 'string' && villa.location.landmark.trim()) ||
                   (typeof villa.listingData?.landmark === 'string' && villa.listingData.landmark.trim()) ||
                   (typeof villa.area === 'string' && villa.area.trim()) ||
                   (typeof villa.location?.area === 'string' && villa.location.area.trim()) ||
                   '';

  // 2. Check for city / district
  const city = (typeof villa.city === 'string' && villa.city.trim()) ||
               (typeof villa.location?.city === 'string' && villa.location.city.trim()) ||
               (typeof villa.listingData?.city === 'string' && villa.listingData.city.trim()) ||
               '';

  // 3. Direct string location from backend (e.g. "Near Venna Lake, Mahabaleshwar" or "Mahabaleshwar")
  if (typeof villa.location === 'string' && villa.location.trim().length > 0) {
    const locStr = villa.location.trim();
    if (landmark && !locStr.toLowerCase().includes(landmark.toLowerCase())) {
      return `${landmark}, ${locStr}`;
    }
    return locStr;
  }

  // 4. Landmark + City combined
  if (landmark && city) {
    if (landmark.toLowerCase().includes(city.toLowerCase())) return landmark;
    return `${landmark}, ${city}`;
  }

  // 5. Address field
  const address = (typeof villa.address === 'string' && villa.address.trim()) ||
                  (typeof villa.location?.address === 'string' && villa.location.address.trim()) ||
                  (typeof villa.listingData?.address === 'string' && villa.listingData.address.trim()) ||
                  '';
  if (address) {
    if (city && !address.toLowerCase().includes(city.toLowerCase())) {
      return `${address}, ${city}`;
    }
    return address;
  }

  if (landmark) return `${landmark}, Mahabaleshwar`;
  if (city) return `${city}, Maharashtra`;

  return 'Mahabaleshwar, Maharashtra';
}

/**
 * Returns a comprehensive searchable string for filtering villas by Name, Landmark, City, State, Amenities, and Description.
 */
export function getVillaSearchableText(villa) {
  if (!villa) return '';

  const locationStr = typeof villa.location === 'string' ? villa.location : '';
  const locationObjCity = typeof villa.location === 'object' ? (villa.location?.city || '') : '';
  const locationObjLandmark = typeof villa.location === 'object' ? (villa.location?.landmark || villa.location?.address || '') : '';

  const landmark = villa.landmark || villa.listingData?.landmark || locationObjLandmark;
  const address = villa.address || villa.listingData?.address || '';
  const city = villa.city || villa.listingData?.city || locationObjCity;
  const state = villa.state || villa.listingData?.state || 'Maharashtra';
  const name = villa.name || '';
  const type = villa.type || '';
  const description = villa.description || villa.listingData?.description || '';
  const amenities = Array.isArray(villa.amenities)
    ? villa.amenities.map(a => (typeof a === 'string' ? a : a.name || '')).join(' ')
    : '';

  return [
    name,
    type,
    locationStr,
    landmark,
    address,
    city,
    state,
    description,
    amenities
  ].filter(Boolean).join(' ').toLowerCase();
}

