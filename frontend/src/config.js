const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');

export const OWNER_PORTAL_URL = import.meta.env.VITE_OWNER_PORTAL_URL ||
  (import.meta.env.DEV ? 'http://localhost:5175' : 'https://owner.bookmyvilla.online');
export const ADMIN_PORTAL_URL = import.meta.env.VITE_ADMIN_PORTAL_URL ||
  (import.meta.env.DEV ? 'http://localhost:5174' : 'https://admin.bookmyvilla.online');
export const CARETAKER_PORTAL_URL = import.meta.env.VITE_CARETAKER_PORTAL_URL || '/caretaker-dashboard';
