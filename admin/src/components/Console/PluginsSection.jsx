import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from './api';
import { Alert, Icon } from './ui';
import './PluginsSection.css';

const fields = [
  { key: 'frontendUrl', label: 'Frontend URL', placeholder: 'https://your-omniflow-frontend' },
  { key: 'backendUrl', label: 'Backend URL', hint: 'Without /api/v1.', placeholder: 'https://your-omniflow-backend' },
  { key: 'widgetKey', label: 'Public widget key', placeholder: 'wc_…' },
];

function fieldErrors(settings, requireConnection = false) {
  const errors = {};
  for (const { key } of fields) {
    const value = settings[key].trim();
    if ((settings.enabled || requireConnection) && !value) errors[key] = 'This field is required.';
    if (!value) continue;
    if (key === 'widgetKey') {
      if (!/^wc_[A-Za-z0-9_-]{16,256}$/.test(value)) errors[key] = 'Use the public widget key starting with wc_, not a login token.';
      continue;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
      if (key === 'backendUrl' && /\/api\/v1\/*$/i.test(url.pathname)) errors[key] = 'Remove /api/v1 from the backend base URL.';
      if (key === 'frontendUrl' && /\/omniflow-webchat\.js$/i.test(url.pathname)) errors[key] = 'Remove /omniflow-webchat.js from the frontend base URL.';
    } catch { errors[key] = 'Enter a full HTTP(S) base URL without credentials, query or fragment.'; }
  }
  return errors;
}

export default function PluginsSection({ onDirtyChange }) {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [connection, setConnection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const savingRef = useRef(false);
  const dirty = Boolean(saved && form && ['enabled', 'frontendUrl', 'backendUrl', 'widgetKey'].some(key => form[key] !== saved[key]));

  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const load = useCallback(async (signal) => {
    setLoading(true); setLoadError('');
    try {
      const data = await adminApi('/plugins/omniflow', { signal });
      if (signal?.aborted) return;
      setForm(data.settings); setSaved(data.settings);
      setErrors({}); setNotice(null); setConnection(null);
    } catch (error) { if (!signal?.aborted) setLoadError(error.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
    setNotice(null); setConnection(null);
  }

  function validate(requireConnection = false) {
    const next = fieldErrors(form, requireConnection);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) { document.getElementById(`plugin-${first}`)?.focus(); return false; }
    return true;
  }

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !validate()) return;
    savingRef.current = true; setSaving(true); setNotice(null);
    try {
      const data = await adminApi('/plugins/omniflow', { method: 'PUT', body: form });
      setSaved(data.settings); setForm(data.settings);
      setNotice({ kind: 'success', message: `Chat ${data.settings.enabled ? 'enabled' : 'disabled'}. Refresh the website.` });
    } catch (error) {
      setErrors(error.data?.errors || {});
      const first = Object.keys(error.data?.errors || {})[0];
      if (first) requestAnimationFrame(() => document.getElementById(`plugin-${first}`)?.focus());
      setNotice({ kind: 'error', message: error.message, conflict: error.status === 409 });
    } finally { savingRef.current = false; setSaving(false); }
  }

  async function testConnection() {
    if (!validate(true)) return;
    setTesting(true); setConnection(null);
    try {
      const options = { mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) };
      // Browser-side probes only: never send admin authorization to Omniflow,
      // execute its script inside admin, or fetch arbitrary URLs on our server.
      const [scriptResult, backendResult] = await Promise.allSettled([
        fetch(`${form.frontendUrl.trim().replace(/\/+$/, '')}/omniflow-webchat.js`, options),
        fetch(`${form.backendUrl.trim().replace(/\/+$/, '')}/api/v1/web-chat/${encodeURIComponent(form.widgetKey.trim())}/config`, options),
      ]);
      if (backendResult.status === 'rejected') throw backendResult.reason;
      const backend = backendResult.value;
      if (!backend.ok) throw new Error(`Omniflow did not accept the widget configuration (HTTP ${backend.status}). Check the public key and channel status.`);
      await backend.json();
      if (scriptResult.status === 'rejected') {
        setConnection({ kind: 'warn', message: 'Key verified; widget script could not be checked. Check the website.' });
        return;
      }
      const script = scriptResult.value;
      if (!script.ok || !/javascript|ecmascript/i.test(script.headers.get('content-type') || '')) throw new Error('The frontend URL did not return the widget JavaScript. Check the frontend base URL.');
      setConnection({ kind: 'success', message: 'Connection verified.' });
    } catch (error) {
      setConnection({ kind: 'error', message: error.name === 'TypeError' || error.name === 'TimeoutError'
        ? 'Could not connect. Check the URLs and Omniflow access settings.' : error.message });
    } finally { setTesting(false); }
  }

  if (loading) return <div className="ac-stack"><p className="ac-muted" role="status">Loading plugin settings…</p></div>;
  if (loadError) return <div className="ac-stack"><Alert>{loadError}</Alert><div><button className="ac-btn ghost" type="button" onClick={() => load()}>Retry loading</button></div></div>;
  if (!form) return null;

  return <div className="ac-stack ac-plugins">
    <section className="ac-card ac-plugin-card" aria-labelledby="omniflow-heading">
      <div className="ac-card-head"><div className="ac-plugin-heading"><span className="ac-plugin-icon"><Icon name="fa-comments" /></span><h3 id="omniflow-heading">Omniflow Web Chat</h3></div><span className={`ac-badge ${saved.enabled ? 'good' : 'neutral'}`}>{saved.enabled ? 'Enabled' : 'Disabled'}</span></div>
      <form noValidate onSubmit={save} aria-busy={saving || testing}>
        <fieldset disabled={saving || testing} className="ac-plugin-fields">
          <legend className="ac-plugin-legend">Connection settings</legend>
          <label className="ac-plugin-toggle"><input type="checkbox" checked={form.enabled} onChange={event => update('enabled', event.target.checked)} /><strong>Enable website chat</strong></label>
          {fields.map(field => <div className="ac-plugin-field" key={field.key}>
            <label htmlFor={`plugin-${field.key}`}>{field.label}</label>
            <div className="ac-plugin-input"><input id={`plugin-${field.key}`} type={field.key === 'widgetKey' ? (showKey ? 'text' : 'password') : 'url'} value={form[field.key]} onChange={event => update(field.key, event.target.value)} placeholder={field.placeholder} autoComplete="off" spellCheck="false" maxLength={field.key === 'widgetKey' ? 260 : 2048} aria-invalid={Boolean(errors[field.key])} aria-describedby={[field.hint && `plugin-${field.key}-hint`, errors[field.key] && `plugin-${field.key}-error`].filter(Boolean).join(' ') || undefined} />{field.key === 'widgetKey' && <button type="button" className="ac-btn ghost sm" onClick={() => setShowKey(value => !value)} aria-label={showKey ? 'Hide public widget key' : 'Show public widget key'}>{showKey ? 'Hide' : 'Show'}</button>}</div>
            {field.hint && <small id={`plugin-${field.key}-hint`} className="ac-muted">{field.hint}</small>}
            {errors[field.key] && <p className="ac-plugin-error" id={`plugin-${field.key}-error`}>{errors[field.key]}</p>}
          </div>)}
        </fieldset>
        {connection && <Alert kind={connection.kind}>{connection.message}</Alert>}
        {notice && <Alert kind={notice.kind}>{notice.message}{notice.conflict && <div><button type="button" className="ac-btn ghost sm" onClick={() => load()}>Discard changes and reload</button></div>}</Alert>}
        <div className="ac-plugin-actions"><button type="button" className="ac-btn ghost" disabled={saving || testing} onClick={testConnection}>{testing ? 'Checking connection…' : 'Test connection'}</button><button type="submit" className="ac-btn primary" disabled={!dirty || saving || testing}>{saving ? 'Saving settings…' : 'Save settings'}</button><span className="ac-muted" role="status">{dirty ? 'Unsaved changes' : 'Settings saved'}</span></div>
      </form>
    </section>
  </div>;
}
