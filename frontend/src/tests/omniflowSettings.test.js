import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchOmniflowSettings } from '../services/omniflowSettings.js';

test('runtime chat settings use the public endpoint without cached data or credentials', async () => {
  const config = await fetchOmniflowSettings('https://api.bookmyvilla.online', { fetcher: async (url, options) => {
    assert.equal(url, 'https://api.bookmyvilla.online/api/site-plugins/omniflow');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    return { ok: true, json: async () => ({ enabled: true, frontendUrl: 'https://chat.bookmyvilla.online', backendUrl: 'https://chat-api.bookmyvilla.online', widgetKey: 'wc_test', updatedBy: 'not-public' }) };
  } });
  assert.deepEqual(Object.keys(config), ['frontendUrl', 'backendUrl', 'widgetKey']);
});

test('admin-disabled chat remains disabled even if an old key is present', async () => {
  const config = await fetchOmniflowSettings('', { fetcher: async () => ({ ok: true, json: async () => ({ enabled: false, widgetKey: 'wc_old' }) }) });
  assert.equal(config, null);
});

test('unavailable or incomplete runtime config fails without an env fallback', async () => {
  await assert.rejects(fetchOmniflowSettings('', { fetcher: async () => ({ ok: false }) }));
  await assert.rejects(fetchOmniflowSettings('', { fetcher: async () => ({ ok: true, json: async () => ({ enabled: true }) }) }));
});
