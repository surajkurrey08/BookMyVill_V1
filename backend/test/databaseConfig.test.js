const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { resolveMongoUri } = require('../services/databaseConfig');
const uri = 'mongodb+srv://testuser:encoded%40password@cluster.example.com/bookmyvilla';

test('database configuration parses explicit MongoDB URIs, quote wrappers and supported variable names', () => {
  for (const key of ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL', 'MONGODB_FALLBACK_URI']) {
    assert.equal(resolveMongoUri({ [key]: ` "${uri}" ` }), uri);
  }
  assert.equal(resolveMongoUri({ MONGODB_URI: 'mongodb://mongo:27017/bookmyvilla' }), 'mongodb://mongo:27017/bookmyvilla');
});

test('invalid database configuration stays an error and cannot silently select another database', () => {
  assert.throws(() => resolveMongoUri({}), /missing/);
  assert.throws(() => resolveMongoUri({ MONGODB_URI: 'invalid-secret-value', MONGODB_FALLBACK_URI: 'mongodb://mongo:27017/other' }), /MONGODB_URI is invalid/);
  assert.throws(() => resolveMongoUri({ MONGODB_URI: 'mongodb+srv://' }), /malformed/);
  try { resolveMongoUri({ MONGODB_URI: 'invalid-secret-value' }); } catch (error) { assert.ok(!error.message.includes('invalid-secret-value')); }
});

test('deployment validates secrets before rollout and overrides only Atlas URI and backend port', () => {
  const script = path.resolve(__dirname, '../../scripts/validate-backend-env.js');
  const validBackendEnv = 'MONGODB_URI=invalid-value\nJWT_SECRET=existing-production-signing-secret\nRAZORPAY_KEY_SECRET=existing-payment-secret\nSMS_API_URL=https://sms-provider.test/send\nSMS_USERNAME=provider-user\nSMS_PASSWORD=provider-password\nSMS_SENDER_ID=BKMYVA\nSMS_TEMPLATE_ID=1777179206833227479\nPORT=5000\n';
  const env = { ...process.env, BACKEND_ENV: validBackendEnv, ATLAS_MONGODB_URI: uri };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmv-env-'));
  const file = path.join(dir, 'backend.env');
  try {
    const valid = spawnSync(process.execPath, [script, '--write', file], { env, encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
    const saved = dotenv.parse(fs.readFileSync(file));
    assert.equal(saved.MONGODB_URI, uri); assert.equal(saved.PORT, '2001');
    assert.equal(saved.JWT_SECRET, 'existing-production-signing-secret'); assert.equal(saved.RAZORPAY_KEY_SECRET, 'existing-payment-secret');
    assert.ok(!valid.stdout.includes(uri)); assert.ok(!valid.stdout.includes(saved.JWT_SECRET));
    const invalid = spawnSync(process.execPath, [script], { env: { ...env, ATLAS_MONGODB_URI: '' }, encoding: 'utf8' });
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /MONGODB_URI is invalid/); assert.ok(!invalid.stderr.includes('invalid-value'));
    const noJwt = spawnSync(process.execPath, [script], { env: { ...env, BACKEND_ENV: `MONGODB_URI=${uri}\n` }, encoding: 'utf8' });
    assert.equal(noJwt.status, 1); assert.match(noJwt.stderr, /JWT_SECRET is missing/);
    const insecureSms = spawnSync(process.execPath, [script], { env: { ...env, BACKEND_ENV: validBackendEnv.replace('https://sms-provider.test', 'http://sms-provider.test') }, encoding: 'utf8' });
    assert.equal(insecureSms.status, 1); assert.match(insecureSms.stderr, /valid HTTPS SMS provider endpoint/);
    const noSms = spawnSync(process.execPath, [script], { env: { ...env, BACKEND_ENV: validBackendEnv.replace(/SMS_[^\n]+\n/g, '') }, encoding: 'utf8' });
    assert.equal(noSms.status, 1); assert.match(noSms.stderr, /Live OTP delivery requires/);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});
