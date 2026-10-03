const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// VITE_API_BASE_URL is used by existing local setups and may already end in /api.
export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
