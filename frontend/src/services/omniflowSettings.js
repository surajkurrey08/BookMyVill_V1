// Database settings are authoritative. Never revive a disabled/replaced key
// from an old environment variable or browser storage after a failed request.
export async function fetchOmniflowSettings(apiBase, { fetcher = globalThis.fetch } = {}) {
  const response = await fetcher(`${apiBase}/api/site-plugins/omniflow`, {
    cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Website chat settings are unavailable.');
  const settings = await response.json();
  if (settings?.enabled !== true) return null;
  if (!['frontendUrl', 'backendUrl', 'widgetKey'].every(field => typeof settings[field] === 'string' && settings[field].trim())) {
    throw new Error('Website chat settings are incomplete.');
  }
  // Explicit public-field projection, independent of any extra server fields.
  return { frontendUrl: settings.frontendUrl, backendUrl: settings.backendUrl, widgetKey: settings.widgetKey };
}
