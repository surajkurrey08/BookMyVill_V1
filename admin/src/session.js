// Read token and user from the same storage. Independent fallbacks can pair
// a tab's old token with a different account's remembered user.
export function readAdminSession() {
  for (const storage of [sessionStorage, localStorage]) {
    const token = (storage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();
    const rawUser = storage.getItem('user');
    if (!token || !rawUser) continue;
    try {
      const user = JSON.parse(rawUser);
      if (user?.role === 'admin') return { token, user };
    } catch { /* Ignore an incomplete or malformed saved session. */ }
  }
  return null;
}

export function clearAdminSession() {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem('token');
    storage.removeItem('user');
  }
}

export function saveAdminSession(token, user) {
  clearAdminSession();
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
}
