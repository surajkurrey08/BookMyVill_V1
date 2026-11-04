const { HttpError } = require('../utils/validate');

const emptyPlugin = () => ({ enabled: false, frontendUrl: '', backendUrl: '', widgetKey: '', revision: 0 });

function pluginSettings(record) {
  if (!record) return emptyPlugin();
  return {
    enabled: record.enabled, frontendUrl: record.frontendUrl,
    backendUrl: record.backendUrl, widgetKey: record.widgetKey, revision: record.revision,
  };
}

function validatePlugin(body, production = process.env.NODE_ENV === 'production') {
  const errors = {};
  const config = { enabled: body.enabled };
  if (typeof body.enabled !== 'boolean') errors.enabled = 'Choose whether website chat is enabled.';
  for (const field of ['frontendUrl', 'backendUrl', 'widgetKey']) {
    if (typeof body[field] !== 'string') { errors[field] = 'Enter a text value.'; config[field] = ''; }
    else config[field] = body[field].trim();
    if (config.enabled && !config[field]) errors[field] = 'This field is required when chat is enabled.';
  }
  for (const field of ['frontendUrl', 'backendUrl']) {
    if (!config[field]) continue;
    try {
      const url = new URL(config[field]);
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) || ['[::1]', '[::]', '0.0.0.0'].includes(host);
      if (config[field].length > 2048 || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
      if (production && (url.protocol !== 'https:' || local)) {
        errors[field] = 'Production requires a public HTTPS URL, not localhost or a private LAN address.';
      } else if (host === 'example.com' || host.endsWith('.example.com') || host.endsWith('.example') || host.endsWith('.invalid')) {
        errors[field] = 'Enter your real Omniflow URL.';
      }
      config[field] = url.href.replace(/\/+$/, '');
      if (field === 'backendUrl' && /\/api\/v1$/i.test(url.pathname.replace(/\/+$/, ''))) errors[field] = 'Use the backend base URL without /api/v1.';
      if (field === 'frontendUrl' && /\/omniflow-webchat\.js$/i.test(url.pathname)) errors[field] = 'Use the frontend base URL without /omniflow-webchat.js.';
    } catch { errors[field] = 'Enter a full HTTP(S) base URL without credentials, query or fragment.'; }
  }
  if (config.widgetKey && !/^wc_[A-Za-z0-9_-]{16,256}$/.test(config.widgetKey)) errors.widgetKey = 'Enter the Omniflow public widget key starting with wc_. Do not use a login token.';
  if (Object.keys(errors).length) {
    const error = new HttpError(400, 'Check the highlighted plugin settings.');
    error.errors = errors;
    throw error;
  }
  return config;
}

// Deliberately omit the public key from audit snapshots as well as credentials.
function auditSettings(record) {
  const { widgetKey, ...settings } = pluginSettings(record);
  return { ...settings, hasWidgetKey: Boolean(widgetKey) };
}

module.exports = { emptyPlugin, pluginSettings, validatePlugin, auditSettings };
