const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const nodeEnv = typeof process !== 'undefined' && process.env ? process.env : {};

const configuredApiUrl =
  metaEnv.VITE_API_URL ||
  metaEnv.VITE_API_BASE_URL ||
  nodeEnv.VITE_API_URL ||
  nodeEnv.VITE_API_BASE_URL ||
  'http://localhost:2001';

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');

export const OWNER_PORTAL_URL =
  metaEnv.VITE_OWNER_PORTAL_URL ||
  nodeEnv.VITE_OWNER_PORTAL_URL ||
  (metaEnv.DEV ? 'http://localhost:5175' : 'https://owner.bookmyvilla.online');

export const ADMIN_PORTAL_URL =
  metaEnv.VITE_ADMIN_PORTAL_URL ||
  nodeEnv.VITE_ADMIN_PORTAL_URL ||
  (metaEnv.DEV ? 'http://localhost:5174' : 'https://admin.bookmyvilla.online');

export const CARETAKER_PORTAL_URL =
  metaEnv.VITE_CARETAKER_PORTAL_URL ||
  nodeEnv.VITE_CARETAKER_PORTAL_URL ||
  '/caretaker-dashboard';

