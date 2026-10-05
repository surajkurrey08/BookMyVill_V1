const configured = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:2001';
export const API_BASE_URL = configured.replace(/\/+$/, '').replace(/\/api$/, '');
