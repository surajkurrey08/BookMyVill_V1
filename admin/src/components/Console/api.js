import { API_BASE_URL } from '../../config';

const authToken = () => (sessionStorage.getItem('token') || localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();

export class AdminApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

function friendly(status, data) {
  if (status === 401) return 'Your admin session has expired. Sign in again.';
  if (status === 403) return data.msg || 'Your admin role does not allow this action.';
  if (status === 409) return data.msg || 'This changed while you were working. Refresh and try again.';
  if (status >= 500) return data.msg || 'The server could not complete this action.';
  return data.msg || 'Request failed.';
}

export async function adminApi(path, { method = 'GET', body, signal } = {}) {
  const token = authToken();
  if (!token) throw new AdminApiError('Admin sign-in required.', 401);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/admin-console${path}`, {
      method, signal,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new AdminApiError('Cannot reach the server.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AdminApiError(friendly(response.status, data), response.status, data);
  return data;
}

export const query = params => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
};
