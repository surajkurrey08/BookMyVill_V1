import { deleteCookie, getCookie, setCookie } from './cookies';

// The app reads the signed-in guest from sessionStorage ('token' / 'user').
// sessionStorage is wiped when the tab closes, so the login is also kept in a
// cookie that lives as long as the JWT (7 days on the backend). On the next
// visit restoreSession() copies it back, so the guest stays signed in until
// they log out or the token expires.

const SESSION_COOKIE = 'bmv_session';
const FALLBACK_TTL_SECONDS = 7 * 24 * 60 * 60; // backend issues 7-day tokens
export const AUTH_EVENT = 'bmv:auth-change';

// Seconds until the JWT's `exp` claim, or null if it can't be read.
const secondsUntilExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? Math.floor(payload.exp - Date.now() / 1000) : null;
  } catch {
    return null;
  }
};

const writeCookie = (token, user) => {
  const ttl = secondsUntilExpiry(token) ?? FALLBACK_TTL_SECONDS;
  if (ttl > 0) setCookie(SESSION_COOKIE, JSON.stringify({ token, user }), ttl);
};

const notify = () => window.dispatchEvent(new Event(AUTH_EVENT));

export const getSessionUser = () => {
  try {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const isSignedIn = () => Boolean(sessionStorage.getItem('token'));

export const saveSession = (token, user) => {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  writeCookie(token, user);
  notify();
};

// Keeps the remembered login in step after a profile edit.
export const updateSessionUser = (user) => {
  sessionStorage.setItem('user', JSON.stringify(user));
  const token = sessionStorage.getItem('token');
  if (token && getCookie(SESSION_COOKIE)) writeCookie(token, user);
  notify();
};

export const clearSession = () => {
  ['token', 'user'].forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  deleteCookie(SESSION_COOKIE);
  notify();
};

// Runs once before the app renders.
export const restoreSession = () => {
  if (sessionStorage.getItem('token')) return;
  const raw = getCookie(SESSION_COOKIE);
  if (!raw) return;
  try {
    const { token, user } = JSON.parse(raw);
    const ttl = token ? secondsUntilExpiry(token) : 0;
    if (!token || !user || (ttl !== null && ttl <= 0)) throw new Error('expired session');
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
  } catch {
    deleteCookie(SESSION_COOKIE);
  }
};
