const configured = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:2001/api').replace(/\/+$/, '');
const BASE = configured.endsWith('/api') ? configured : `${configured}/api`;
const KEY = 'bookmyvilla.dataEntry.token';
export const session = { token: () => sessionStorage.getItem(KEY) || '', save: token => sessionStorage.setItem(KEY, token), clear: () => sessionStorage.removeItem(KEY) };
export class ApiError extends Error {
  constructor(message, status, data = {}) { super(message); this.status = status; this.data = data; }
}
function result(status, data) {
  if (status < 200 || status >= 300) {
    if (status === 401) { session.clear(); window.dispatchEvent(new Event('data-entry-session-expired')); }
    throw new ApiError(data.msg || 'The request failed. Please try again.', status, data);
  }
  return data;
}
export async function request(path, { method = 'GET', body, signal, onProgress } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(session.token() && { 'x-auth-token': session.token() }) };
  if (onProgress) return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open(method, `${BASE}${path}`);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new ApiError('Cannot reach BookMyVilla. Check the connection and retry your upload.', 0));
    xhr.onload = () => { try { resolve(result(xhr.status, JSON.parse(xhr.responseText))); } catch (err) { reject(err); } };
    xhr.send(JSON.stringify(body));
  });
  try {
    const response = await fetch(`${BASE}${path}`, { method, headers, signal, ...(body !== undefined && { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    return result(response.status, data);
  } catch (err) {
    if (err instanceof ApiError || err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach BookMyVilla. Check the connection and retry. Your entered data is still here.', 0);
  }
}
const prefix = '/properties/data-entry';
export const entryApi = {
  login: async body => {
    const data = await request('/auth/login', { method: 'POST', body });
    session.save(data.token);
    try { return await request(`${prefix}/session`); } catch (err) { session.clear(); throw err; }
  },
  me: signal => request(`${prefix}/session`, { signal }),
  list: (params = {}, signal) => request(`${prefix}?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined))}`, { signal }),
  get: (id, signal) => request(`${prefix}/${id}`, { signal }),
  save: (id, draft, revision, onProgress) => request(`${prefix}/${id}`, { method: 'PUT', body: { draft, revision }, onProgress }),
  submit: (id, revision) => request(`${prefix}/${id}/submit`, { method: 'POST', body: { revision } })
};
