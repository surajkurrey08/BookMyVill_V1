import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOmniflowConfig, loadOmniflowWidget } from '../services/omniflowWidget.js';

// Synthetic public settings; no requests are sent to these hosts.
const settings = {
  frontendUrl: 'https://chat.bookmyvilla.online/',
  backendUrl: 'https://chat-api.bookmyvilla.online/',
  widgetKey: 'public-widget-test-key',
};

function createDocument() {
  const scripts = [];
  return {
    scripts,
    body: { appendChild: (script) => scripts.push(script) },
    querySelector: () => scripts.find((script) => script.id === 'bookmyvilla-omniflow-webchat' || script.attributes['data-omniflow-key']) || null,
    createElement: (tag) => {
      assert.equal(tag, 'script');
      return {
        attributes: {},
        listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this.listeners[name] = listener; },
      };
    },
  };
}

test('Omniflow uses the vendor snippet attributes and an async script without an API suffix', () => {
  const document = createDocument();
  const script = loadOmniflowWidget(settings, { document, production: true });
  assert.equal(document.scripts.length, 1);
  assert.equal(script.src, 'https://chat.bookmyvilla.online/omniflow-webchat.js');
  assert.equal(script.async, true);
  assert.deepEqual(script.attributes, {
    'data-omniflow-key': settings.widgetKey,
    'data-omniflow-api': 'https://chat-api.bookmyvilla.online',
  });
});

test('Omniflow retains one script across repeated mounts/navigation, even while loading', () => {
  const document = createDocument();
  const first = loadOmniflowWidget(settings, { document });
  for (let visit = 0; visit < 10; visit += 1) {
    assert.equal(loadOmniflowWidget(settings, { document }), first);
  }
  assert.equal(document.scripts.length, 1);
});

test('Omniflow recognizes an existing manual snippet', () => {
  const document = createDocument();
  const existing = { attributes: { 'data-omniflow-key': settings.widgetKey } };
  document.scripts.push(existing);
  assert.equal(loadOmniflowWidget(settings, { document }), existing);
  assert.equal(document.scripts.length, 1);
});

test('Omniflow makes no DOM changes for missing or partial settings', () => {
  for (const field of ['frontendUrl', 'backendUrl', 'widgetKey']) {
    const document = createDocument();
    assert.equal(loadOmniflowWidget({ ...settings, [field]: '  ' }, { document }), null);
    assert.equal(document.scripts.length, 0);
  }
});

test('Omniflow rejects malformed URLs, placeholders and /api/v1 without breaking the caller', () => {
  for (const override of [
    { frontendUrl: 'not-a-url' },
    { frontendUrl: 'javascript:void(0)' },
    { frontendUrl: 'https://OMNIFLOW_FRONTEND' },
    { frontendUrl: 'https://your-omniflow.example.com' },
    { backendUrl: 'https://chat-api.bookmyvilla.online/api/v1/' },
    { backendUrl: 'https://user:password@chat-api.bookmyvilla.online' },
    { backendUrl: 'https://chat-api.bookmyvilla.online?token=private' },
    { widgetKey: 'BOOKMYVILLA_PUBLIC_KEY' },
  ]) {
    const document = createDocument();
    const errors = [];
    assert.equal(loadOmniflowWidget({ ...settings, ...override }, { document, onError: (error) => errors.push(error) }), null);
    assert.equal(document.scripts.length, 0);
    assert.equal(errors.length, 1);
  }
});

test('Omniflow refuses HTTP and local endpoints in production for both bases', () => {
  for (const field of ['frontendUrl', 'backendUrl']) {
    for (const url of ['http://chat.bookmyvilla.online', 'https://localhost', 'https://localhost.', 'https://demo.localhost', 'https://127.0.0.1', 'https://[::1]', 'https://192.168.1.20', 'https://172.16.1.1']) {
      assert.throws(() => getOmniflowConfig({ ...settings, [field]: url }, { production: true }));
    }
  }
});

test('Omniflow allows explicit local demo URLs only in development', () => {
  const config = getOmniflowConfig({ ...settings, frontendUrl: 'http://localhost:3000/', backendUrl: 'http://localhost:8000/' });
  assert.equal(config.scriptUrl, 'http://localhost:3000/omniflow-webchat.js');
  assert.equal(config.backendUrl, 'http://localhost:8000');
});

test('Omniflow preserves base path prefixes', () => {
  const config = getOmniflowConfig({ ...settings, frontendUrl: `${settings.frontendUrl}chat/`, backendUrl: `${settings.backendUrl}backend/` });
  assert.equal(config.scriptUrl, 'https://chat.bookmyvilla.online/chat/omniflow-webchat.js');
  assert.equal(config.backendUrl, 'https://chat-api.bookmyvilla.online/backend');
});

test('Omniflow script failure is contained and does not create a reinjection loop', () => {
  const document = createDocument();
  const errors = [];
  const script = loadOmniflowWidget(settings, { document, onError: (error) => errors.push(error) });
  assert.doesNotThrow(() => script.listeners.error());
  assert.equal(errors.length, 1);
  assert.equal(loadOmniflowWidget(settings, { document }), script);
  assert.equal(document.scripts.length, 1);
});
