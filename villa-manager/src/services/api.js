const configured = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const BASE = configured.endsWith('/api') ? configured : `${configured}/api`;
export const session = { get: () => sessionStorage.getItem('bmv_vm_token'), set: token => sessionStorage.setItem('bmv_vm_token', token), clear: () => sessionStorage.removeItem('bmv_vm_token') };
export async function api(path, { method = 'GET', body, signal, token = session.get() } = {}) {
  let response;
  try { response = await fetch(BASE + path, { method, signal, headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body !== undefined && { body: JSON.stringify(body) }) }); }
  catch (err) { if (err.name === 'AbortError') throw err; throw new Error('Cannot reach BookMyVilla. Check the backend connection and retry.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error(data.msg || data.message || 'This action could not be completed. Retry.'); err.status = response.status; throw err; }
  return data;
}
export const query = values => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
export const manager = (path, options) => api('/villa-manager' + path, options);
export async function login(email, password) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password, appType: 'villa-manager' }, token: null });
  const verified = await api('/villa-manager/session', { token: result.token });
  session.set(result.token); return verified;
}
export const propertyService = { list: filters => manager('/properties?' + query(filters)), owners: () => manager('/owners'), get: id => manager('/properties/' + id) };
export const bookingService = { get: id => manager('/bookings/' + id), details: (id, body) => manager(`/bookings/${id}/details`, { method: 'PATCH', body }), alternatives: id => manager(`/bookings/${id}/alternatives`), assign: (id, roomId, reason, hasRoom) => hasRoom ? manager(`/bookings/${id}/reassign`, { method: 'POST', body: { roomId, reason } }) : api(`/owner-pms/bookings/${id}/assign-room`, { method: 'POST', body: { roomId } }), stay: (id, action) => api(`/owner-ops/bookings/${id}/${action}`, { method: 'POST', body: {} }) };
export const taskService = { create: body => manager('/tasks', { method: 'POST', body }), update: (id, body) => manager('/tasks/' + id, { method: 'PATCH', body }) };
export const requestService = { update: (id, body) => api('/owner-ops/guest-request/' + id, { method: 'PATCH', body }) };
export const housekeepingService = { update: (id, body) => manager('/housekeeping/' + id, { method: 'PATCH', body }), create: body => api('/owner-ops/housekeeping/' + body.propertyId, { method: 'POST', body }) };
export const availabilityService = { calendar: (id, start, end) => manager(`/calendar/${id}?` + query({ start, end })), block: (id, body) => api(`/owner-pms/rooms/${id}/blocks`, { method: 'POST', body }), unblock: reference => api('/owner-pms/blocks/' + reference, { method: 'DELETE' }) };
