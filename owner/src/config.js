const trimSlash = url => url.replace(/\/+$/, '');

// Production builds set VITE_API_URL (see .github/workflows/deploy.yml).
export const API_BASE_URL = `${trimSlash(import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api`;

// Guest-facing website, used for quotation links and listing previews.
function guestSiteUrl() {
  if (import.meta.env.VITE_GUEST_SITE_URL) return trimSlash(import.meta.env.VITE_GUEST_SITE_URL);
  if (typeof window !== 'undefined' && /^owner\./i.test(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname.replace(/^owner\./i, '')}`;
  }
  return 'http://localhost:5173';
}

export const GUEST_SITE_URL = guestSiteUrl();
