const trimSlash = url => url.replace(/\/+$/, '');

// VITE_API_URL is the server origin; the local VITE_API_BASE_URL includes /api.
const apiUrl = trimSlash(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:2001');
export const API_BASE_URL = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;

// Guest-facing website, used for quotation links and listing previews.
function guestSiteUrl() {
  if (import.meta.env.VITE_GUEST_SITE_URL) return trimSlash(import.meta.env.VITE_GUEST_SITE_URL);
  if (typeof window !== 'undefined' && /^owner\./i.test(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname.replace(/^owner\./i, '')}`;
  }
  return 'http://localhost:5173';
}

export const GUEST_SITE_URL = guestSiteUrl();
