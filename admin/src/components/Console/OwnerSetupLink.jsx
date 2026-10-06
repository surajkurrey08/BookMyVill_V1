import { useState } from 'react';
import { adminApi } from './api';
import { Alert } from './ui';

export default function OwnerSetupLink({ owner }) {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function create() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminApi(`/owners/${owner._id}/setup-link`, { method: 'POST' });
      const base = import.meta.env.VITE_OWNER_APP_URL || (import.meta.env.DEV ? 'http://localhost:5175' : window.location.origin);
      const url = new URL('/owner-setup', base);
      url.hash = `token=${encodeURIComponent(result.token)}`;
      setLink({ ...result, url: url.toString() });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link.url); setNotice('Setup link copied.'); }
    catch { setError('Could not copy automatically. Select and copy the link below.'); }
  }
  return <section className="ac-sub">
    <h4>Owner panel access</h4>
    <p className="ac-muted">Create a password setup link for {owner.name} ({owner.email}). Share it with the owner to activate their login.</p>
    <Alert>{error}</Alert>
    {notice && <Alert kind="success">{notice}</Alert>}
    <button type="button" className="ac-btn" disabled={busy} onClick={create}>{busy ? 'Creating link…' : link ? 'Generate a new setup link' : 'Create owner setup link'}</button>
    {link && <div className="ac-setup-link">
      <label>Owner password setup link<input readOnly value={link.url} onFocus={e => e.target.select()} /></label>
      <button type="button" className="ac-btn ghost" onClick={copy}>Copy link</button>
      <p className="ac-muted">Valid until {new Date(link.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Generating a new link replaces the previous one.</p>
    </div>}
  </section>;
}
