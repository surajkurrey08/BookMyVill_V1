process.env.NODE_ENV = 'test'; // demo OTP is returned in the response under test

const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api } = require('./helpers');
const PhoneOtp = require('../models/PhoneOtp');
const User = require('../models/User');

test.before(start);
test.after(stop);

const phone = '9123456780';

test('new guest: send OTP, verify it, then create a password and get a session', async () => {
  const sent = await api('POST', '/api/auth/phone/send-otp', { body: { phone } });
  assert.equal(sent.status, 200);
  assert.match(sent.data.otp, /^\d{6}$/);

  const wrong = await api('POST', '/api/auth/phone/verify-otp', { body: { phone, otp: sent.data.otp === '111111' ? '222222' : '111111' } });
  assert.equal(wrong.status, 400);

  const verified = await api('POST', '/api/auth/phone/verify-otp', { body: { phone, otp: sent.data.otp } });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.verified, true);

  const created = await api('POST', '/api/auth/phone/register', { body: { phone, otp: sent.data.otp, name: 'Asha Patil', password: 'secret12' } });
  assert.equal(created.status, 201);
  assert.ok(created.data.token);
  assert.equal(created.data.user.phone, phone);
  assert.equal(await PhoneOtp.countDocuments({ phone, purpose: 'register' }), 0);

  const again = await api('POST', '/api/auth/phone/send-otp', { body: { phone } });
  assert.equal(again.status, 409);
});

test('returning guest can log in with password or with OTP', async () => {
  const byPassword = await api('POST', '/api/auth/phone/login', { body: { phone, password: 'secret12' } });
  assert.equal(byPassword.status, 200);
  assert.ok(byPassword.data.token);

  const sent = await api('POST', '/api/auth/phone/send-otp', { body: { phone, purpose: 'login' } });
  assert.equal(sent.status, 200);
  const byOtp = await api('POST', '/api/auth/phone/login-otp', { body: { phone, otp: sent.data.otp } });
  assert.equal(byOtp.status, 200);
  assert.equal(byOtp.data.user.name, 'Asha Patil');

  const reused = await api('POST', '/api/auth/phone/login-otp', { body: { phone, otp: sent.data.otp } });
  assert.equal(reused.status, 400, 'an OTP works only once');
});

test('OTP login is refused for unknown numbers, after too many wrong guesses, and for suspended accounts', async () => {
  const unknown = await api('POST', '/api/auth/phone/send-otp', { body: { phone: '9000000001', purpose: 'login' } });
  assert.equal(unknown.status, 404);

  await PhoneOtp.deleteMany({ phone });
  const sent = await api('POST', '/api/auth/phone/send-otp', { body: { phone, purpose: 'login' } });
  const bad = sent.data.otp === '000000' ? '999999' : '000000';
  for (let i = 0; i < 5; i += 1) {
    const res = await api('POST', '/api/auth/phone/login-otp', { body: { phone, otp: bad } });
    assert.equal(res.status, 400);
  }
  const locked = await api('POST', '/api/auth/phone/login-otp', { body: { phone, otp: sent.data.otp } });
  assert.equal(locked.status, 400);
  assert.match(locked.data.msg, /Too many wrong attempts/);

  const tooSoon = await api('POST', '/api/auth/phone/send-otp', { body: { phone, purpose: 'login' } });
  assert.equal(tooSoon.status, 429);

  await User.updateOne({ phone }, { status: 'suspended' });
  const suspended = await api('POST', '/api/auth/phone/login', { body: { phone, password: 'secret12' } });
  assert.equal(suspended.status, 403);
});
