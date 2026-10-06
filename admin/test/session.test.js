import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdminSession, clearAdminSession, saveAdminSession } from '../src/session.js';

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
const admin = { id: 'admin-account', name: 'Admin', role: 'admin' };
test.beforeEach(() => { globalThis.sessionStorage = storage(); globalThis.localStorage = storage(); });

test('never combines a tab token with a remembered admin user', () => {
  sessionStorage.setItem('token', 'owner-token');
  localStorage.setItem('user', JSON.stringify(admin));
  assert.equal(readAdminSession(), null);
});

test('uses the complete remembered session instead of a partial tab session', () => {
  sessionStorage.setItem('token', 'stale-owner-token');
  localStorage.setItem('token', 'remembered-admin-token');
  localStorage.setItem('user', JSON.stringify(admin));
  assert.deepEqual(readAdminSession(), { token: 'remembered-admin-token', user: admin });
});

test('prefers the complete tab admin session and ignores malformed or non-admin sessions', () => {
  saveAdminSession('admin-token', admin);
  localStorage.setItem('token', 'other-admin-token');
  localStorage.setItem('user', JSON.stringify(admin));
  assert.equal(readAdminSession().token, 'admin-token');
  sessionStorage.setItem('user', '{broken');
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  assert.equal(readAdminSession(), null);
});

test('saving and clearing sessions removes only authentication keys from both stores', () => {
  localStorage.setItem('theme', 'dark');
  sessionStorage.setItem('unrelated', 'keep');
  localStorage.setItem('token', 'old-token');
  localStorage.setItem('user', JSON.stringify(admin));
  saveAdminSession('new-token', admin);
  assert.equal(readAdminSession().token, 'new-token');
  assert.equal(localStorage.getItem('token'), null);
  clearAdminSession();
  assert.equal(readAdminSession(), null);
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.equal(sessionStorage.getItem('unrelated'), 'keep');
});
