import { API_BASE_URL } from '../config';

const authToken = () => (sessionStorage.getItem('token') || localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();

export class StayError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Authenticated JSON call to the customer stay API. Errors carry a readable
// message and the HTTP status so the UI can react (401 → sign in, 404 → gone).
export async function stayApi(path, { method = 'GET', body } = {}) {
  const token = authToken();
  if (!token) throw new StayError('Please sign in to view your trip.', 401);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new StayError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new StayError(data.msg || (response.status >= 500 ? 'Something went wrong. Please try again.' : 'Request failed.'), response.status);
  return data;
}

export const isSignedIn = () => Boolean(authToken());
