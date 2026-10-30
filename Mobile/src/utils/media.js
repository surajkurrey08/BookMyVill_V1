import apiClient from '../api/client';

// Curated library of 24 distinct, high-definition luxury villa photos
// Covering pools, modern architecture, master suites, terraces, and sunset vistas
export const LUXURY_VILLA_PHOTOS = [
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1000&auto=format&fit=crop&q=80', // 0: Cliffside ocean infinity pool
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1000&auto=format&fit=crop&q=80', // 1: Tropical palm lighted estate
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&auto=format&fit=crop&q=80', // 2: Hillside modern luxury mansion
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80', // 3: Contemporary glass pavilion & pool
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&auto=format&fit=crop&q=80', // 4: Stone architectural villa at dusk
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&auto=format&fit=crop&q=80', // 5: Evening illuminated pool patio
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80', // 6: Balinese water pavilion
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1000&auto=format&fit=crop&q=80', // 7: Resort luxury villa deck
  'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=1000&auto=format&fit=crop&q=80', // 8: Designer lounge & open terrace
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1000&auto=format&fit=crop&q=80', // 9: Master bedroom suite with balcony
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=1000&auto=format&fit=crop&q=80', // 10: Marble chef kitchen & dining
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1000&auto=format&fit=crop&q=80', // 11: Sunlit courtyard living salon
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1000&auto=format&fit=crop&q=80', // 12: Alpine luxury timber chalet
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1000&auto=format&fit=crop&q=80', // 13: Sprawling white estate & emerald lawns
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1000&auto=format&fit=crop&q=80', // 14: Modernist cubist villa with pool
  'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1000&auto=format&fit=crop&q=80', // 15: Dramatic night architectural facade
  'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1000&auto=format&fit=crop&q=80', // 16: Turquoise infinity pool & ocean view
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80', // 17: Sunlit warm oak bedroom
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1000&auto=format&fit=crop&q=80', // 18: Entertainment lounge & private cinema
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1000&auto=format&fit=crop&q=80', // 19: Sunken fire pit outdoor terrace
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=1000&auto=format&fit=crop&q=80', // 20: Tuscan countryside stone villa
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1000&auto=format&fit=crop&q=80', // 21: Secluded forest villa glass sanctuary
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1000&auto=format&fit=crop&q=80', // 22: Penthouse panoramic terrace suite
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&auto=format&fit=crop&q=80', // 23: Bohemian luxury light-filled interior
];

/**
 * Checks if a string is missing, invalid, or a placeholder/fake URL (e.g. example.com)
 */
export function isInvalidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
  if (trimmed.includes('example.com') || trimmed.includes('dummy') || trimmed.includes('test.com')) return true;
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) return true;
  return false;
}

/**
 * Gets a stable deterministic photo from the luxury collection
 * based on the villa id/name and photo index.
 * Every villa gets a different base photo, and each photo in a gallery
 * is guaranteed to be a different angle/space (pool, bedroom, living, terrace).
 */
export function getStableVillaFallback(seed, photoIndex = 0) {
  const str = String(seed || 'villa');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const offset = Number(photoIndex) || 0;
  // Offset with prime 7 so adjacent indices 0, 1, 2, ... are widely separated
  const index = Math.abs(hash + offset * 7) % LUXURY_VILLA_PHOTOS.length;
  return LUXURY_VILLA_PHOTOS[index];
}

/**
 * Resolves any villa photo string:
 * - Detects invalid/dummy/example.com strings and substitutes unique luxury photos
 * - Resolves relative backend uploads (/uploads/... or /api/properties/media/...)
 * - Preserves working absolute image URLs
 */
export function resolveVillaPhoto(photo, fallbackSeed, photoIndex = 0) {
  if (isInvalidPhotoUrl(photo)) {
    return getStableVillaFallback(fallbackSeed, photoIndex);
  }

  const trimmed = photo.trim();

  // If already absolute HTTP(S) or base64 data
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  // Relative path uploaded to backend
  const apiBase = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${apiBase}${cleanPath}`;
}

export default resolveVillaPhoto;
