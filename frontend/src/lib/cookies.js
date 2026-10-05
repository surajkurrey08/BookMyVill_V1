export const getCookie = (name) => {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
};

export const setCookie = (name, value, maxAgeSeconds) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.floor(maxAgeSeconds)}; Path=/; SameSite=Lax${secure}`;
};

export const deleteCookie = (name) => {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
};

// ---------------------------------------------------------------------------
// Cookie consent
// ---------------------------------------------------------------------------

const CONSENT_COOKIE = 'bmv_cookie_consent';
const CONSENT_TTL_SECONDS = 365 * 24 * 60 * 60;
export const CONSENT_EVENT = 'bmv:cookie-consent';
export const COOKIE_SETTINGS_EVENT = 'bmv:cookie-settings';

// 'all' | 'necessary' | null (visitor hasn't chosen yet)
export const getCookieConsent = () => {
  const value = getCookie(CONSENT_COOKIE);
  return value === 'all' || value === 'necessary' ? value : null;
};

export const setCookieConsent = (value) => {
  setCookie(CONSENT_COOKIE, value, CONSENT_TTL_SECONDS);
  window.dispatchEvent(new Event(CONSENT_EVENT));
};

// Non-essential cookies (analytics, marketing) must check this before being set.
export const allowsOptionalCookies = () => getCookieConsent() === 'all';

export const openCookieSettings = () => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
