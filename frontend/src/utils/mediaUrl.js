import { API_BASE_URL } from '../config.js';


/**
 * Normalizes and resolves a property media URL so it loads reliably
 * across local development and production environments.
 * 
 * Handles:
 * - Direct uploaded device media (/api/properties/media/<uuid>.<ext>) -> ${API_BASE_URL}/api/properties/media/<file>
 * - Legacy container hostnames (e.g. villa-service:2103) -> rewritten to active ${API_BASE_URL}
 * - Mixed content (http://api.bookmyvilla.online -> https://api.bookmyvilla.online)
 * - Insecure localhost origins when the client is on HTTPS -> rewritten to active ${API_BASE_URL}
 * - Preserves data: and blob: URLs
 * - Preserves external image CDN links (Unsplash, Google, Agoda, OpenAI, etc.)
 */
export function resolveMediaUrl(value, fallback = '') {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  // Base64 Data URLs and Object URLs
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;

  // Mixed content fix for api.bookmyvilla.online
  if (/^http:\/\/api\.bookmyvilla\.online/i.test(trimmed)) {
    return trimmed.replace(/^http:/i, 'https:');
  }

  // Rewriting internal microservice domains if any leak to the client
  if (/^https?:\/\/[a-z0-9_-]+-service(?::\d+)?/i.test(trimmed)) {
    const match = /(?:\/api\/properties\/media\/|\/uploads\/properties\/)([a-f0-9-]{36}\.(?:png|jpg|webp|mp4|webm|mov))/i.exec(trimmed);
    if (match) {
      return `${API_BASE_URL}/api/properties/media/${match[1]}`;
    }
    return trimmed.replace(/^https?:\/\/[a-z0-9_-]+-service(?::\d+)?/i, API_BASE_URL);
  }

  // Relative URLs like /api/properties/media/<file> or /uploads/...
  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  // Mixed content fix when viewing over HTTPS but image points to localhost
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && /^http:\/\/localhost(?::\d+)?/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\/localhost(?::\d+)?/i, API_BASE_URL);
  }

  return trimmed;
}

export default resolveMediaUrl;
