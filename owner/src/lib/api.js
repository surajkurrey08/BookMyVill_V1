import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

const authToken = () => (sessionStorage.getItem('token') || localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();

function friendlyMessage(status, data) {
  if (status === 401) return 'Your session has expired. Sign out and sign in again to continue.';
  if (status === 403) return data.msg || 'Your account does not have permission for this action.';
  if (status === 413) return data.msg || 'Selected media is too large. Use smaller files or fewer photos/videos.';
  if (status === 503) return data.msg || 'The service is temporarily unavailable. Please try again shortly.';
  if (status === 429) return data.msg || 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return data.msg || 'The server could not complete this action. Please try again.';
  return data.msg || data.message || 'Request failed.';
}

// JSON request to the backend with the owner's session. Errors carry a
// human-readable message, the HTTP status and the response body.
export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken() },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(friendlyMessage(response.status, data), response.status, data);
  return data;
}

export async function downloadFile(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'x-auth-token': authToken() } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(friendlyMessage(response.status, data), response.status, data);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const query = params => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
};
