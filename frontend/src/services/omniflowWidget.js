const SCRIPT_ID = 'bookmyvilla-omniflow-webchat';

function normalizeBaseUrl(value, label, production) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an HTTP(S) base URL without credentials, query or fragment.`);
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const localHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    host === '[::1]' || host === '[::]' || host.startsWith('127.') || host.startsWith('10.') ||
    host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '0.0.0.0';
  const placeholderHost = host === 'example.com' || host.endsWith('.example.com') ||
    host.endsWith('.example') || host.endsWith('.invalid') || /^omniflow_(frontend|backend)$/.test(host);

  if (placeholderHost || (production && (url.protocol !== 'https:' || localHost))) {
    throw new Error(`${label} must use a real public HTTPS URL in production; placeholders are disabled.`);
  }

  return url.href.replace(/\/+$/, '');
}

export function getOmniflowConfig(settings, { production = false } = {}) {
  const frontendUrl = settings.frontendUrl?.trim();
  const backendUrl = settings.backendUrl?.trim();
  const widgetKey = settings.widgetKey?.trim();
  // An unconfigured installation is intentionally inert, including in production.
  if (!frontendUrl || !backendUrl || !widgetKey) return null;
  if (/^(BOOKMYVILLA_PUBLIC_KEY|your[_-].*|replace[_-].*|<.*>)$/i.test(widgetKey)) {
    throw new Error('Set the BookMyVilla channel public widget key in Admin > Plugins.');
  }

  const frontendBase = normalizeBaseUrl(frontendUrl, 'Omniflow frontend URL', production);
  const backendBase = normalizeBaseUrl(backendUrl, 'Omniflow backend URL', production);
  if (/\/api\/v1$/i.test(new URL(backendBase).pathname)) {
    throw new Error('Omniflow backend URL must exclude /api/v1; the widget appends it.');
  }

  return { scriptUrl: `${frontendBase}/omniflow-webchat.js`, backendUrl: backendBase, widgetKey };
}

export function loadOmniflowWidget(settings, {
  document = globalThis.document,
  production = false,
  onError = () => {},
} = {}) {
  try {
    const config = getOmniflowConfig(settings, { production });
    if (!config || !document) return null;

    // Also recognize an installation made with Omniflow's manual script snippet.
    const existing = document.querySelector(`script#${SCRIPT_ID}, script[data-omniflow-key]`);
    if (existing) return existing;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = config.scriptUrl;
    script.async = true;
    script.setAttribute('data-omniflow-key', config.widgetKey);
    script.setAttribute('data-omniflow-api', config.backendUrl);
    script.addEventListener('error', () => onError('Chat script could not load. The website remains available.'), { once: true });
    document.body.appendChild(script);
    return script;
  } catch (error) {
    // Chat is optional: invalid settings or a blocked script must not stop React.
    onError(error.message);
    return null;
  }
}
