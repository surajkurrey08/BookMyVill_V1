const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createAdmin, createOwner } = require('./helpers');
const { validatePlugin } = require('../services/sitePlugins');
const { resolveService } = require('../shared/serviceCatalog');

let adminToken, readToken, ownerToken;
let revision = 0;
const settings = { enabled: true, frontendUrl: 'https://chat.bookmyvilla.online/', backendUrl: 'https://chat-api.bookmyvilla.online/', widgetKey: 'wc_public_test_widget_key_123456' };

test.before(async () => {
  await start();
  ({ token: adminToken } = await createAdmin(null, 'plugin-super'));
  ({ token: readToken } = await createAdmin('read_only', 'plugin-read'));
  ({ token: ownerToken } = await createOwner('plugin-owner'));
});
test.after(stop);

test('plugin routes belong to user-service and a fresh installation is disabled', async () => {
  assert.equal(resolveService('GET', '/api/site-plugins/omniflow'), 'user-service');
  assert.equal(resolveService('PUT', '/api/admin-console/plugins/omniflow'), 'user-service');
  const result = await api('GET', '/api/site-plugins/omniflow');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { enabled: false, revision: 0 });
});

test('plugin management requires verified admin identity and plugins.manage permission', async () => {
  assert.equal((await api('GET', '/api/admin-console/plugins/omniflow')).status, 401);
  assert.equal((await api('GET', '/api/admin-console/plugins/omniflow', { token: ownerToken })).status, 403);
  assert.equal((await api('PUT', '/api/admin-console/plugins/omniflow', { token: readToken, body: { ...settings, revision } })).status, 403);
});

test('admin saves persisted settings and public reads expose only widget settings', async () => {
  const saved = await api('PUT', '/api/admin-console/plugins/omniflow', { token: adminToken, body: { ...settings, revision, privateToken: 'never-store-this' } });
  assert.equal(saved.status, 200);
  revision = saved.data.settings.revision;
  assert.equal(revision, 1);
  const admin = await api('GET', '/api/admin-console/plugins/omniflow', { token: adminToken });
  assert.deepEqual(admin.data.settings, saved.data.settings);
  const visible = await api('GET', '/api/site-plugins/omniflow');
  assert.deepEqual(visible.data, { ...settings, frontendUrl: settings.frontendUrl.slice(0, -1), backendUrl: settings.backendUrl.slice(0, -1), revision });
  assert.equal(JSON.stringify(visible.data).includes('privateToken'), false);
  assert.equal(JSON.stringify(visible.data).includes('updatedBy'), false);
  const record = await require('../models/SitePlugin').findOne({ key: 'omniflow' }).lean();
  assert.equal(record.privateToken, undefined);
});

test('invalid keys, scripts and API-suffixed URLs cannot overwrite saved settings', async () => {
  for (const change of [
    { widgetKey: 'eyJhbGciOiJIUzI1NiJ9.login-token' }, { frontendUrl: 'javascript:alert(1)' },
    { backendUrl: 'https://chat-api.bookmyvilla.online/api/v1/' },
    { frontendUrl: 'https://chat.bookmyvilla.online/omniflow-webchat.js' }, { enabled: 'true' },
  ]) {
    const result = await api('PUT', '/api/admin-console/plugins/omniflow', { token: adminToken, body: { ...settings, ...change, revision } });
    assert.equal(result.status, 400);
    assert.ok(result.data.errors);
  }
  assert.equal((await api('GET', '/api/site-plugins/omniflow')).data.revision, revision);
});

test('key rotation updates public settings immediately and rejects stale saves', async () => {
  const oldRevision = revision;
  const rotated = await api('PUT', '/api/admin-console/plugins/omniflow', { token: adminToken, body: { ...settings, widgetKey: 'wc_replacement_public_key_123456', revision } });
  assert.equal(rotated.status, 200);
  revision = rotated.data.settings.revision;
  assert.equal((await api('GET', '/api/site-plugins/omniflow')).data.widgetKey, 'wc_replacement_public_key_123456');
  assert.equal((await api('PUT', '/api/admin-console/plugins/omniflow', { token: adminToken, body: { ...settings, revision: oldRevision } })).status, 409);
});

test('disabling hides the public key and audit records track changes without key values', async () => {
  const disabled = await api('PUT', '/api/admin-console/plugins/omniflow', { token: adminToken, body: { ...settings, enabled: false, revision } });
  assert.equal(disabled.status, 200);
  revision = disabled.data.settings.revision;
  assert.deepEqual((await api('GET', '/api/site-plugins/omniflow')).data, { enabled: false, revision });
  const audit = await api('GET', '/api/admin-console/audit?entityType=plugin', { token: adminToken });
  assert.equal(audit.status, 200);
  assert.ok(audit.data.items.some(item => item.action === 'plugins.omniflow_updated'));
  assert.equal(JSON.stringify(audit.data).includes(settings.widgetKey), false);
  assert.equal(JSON.stringify(audit.data).includes('wc_replacement_public_key_123456'), false);
});

test('production rejects localhost/HTTP and development accepts explicit local demo bases', () => {
  for (const url of ['http://chat.bookmyvilla.online', 'https://localhost.', 'https://127.0.0.1', 'https://[::1]', 'https://192.168.1.20']) {
    assert.throws(() => validatePlugin({ ...settings, frontendUrl: url }, true));
  }
  assert.equal(validatePlugin({ ...settings, frontendUrl: 'http://localhost:3000', backendUrl: 'http://localhost:8000' }, false).frontendUrl, 'http://localhost:3000');
});
