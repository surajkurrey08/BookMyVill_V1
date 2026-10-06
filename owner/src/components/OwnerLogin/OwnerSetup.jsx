import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OwnerLogin.css';

export default function OwnerSetup() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmation) { setError('Passwords do not match. Enter the same password twice.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/owner-setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, confirmPassword: confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || 'Could not set your password. Try again.');
      window.history.replaceState(null, '', window.location.pathname);
      setPassword(''); setConfirmation(''); setEmail(data.email);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="owner-login-container"><section className="owner-login-card">
    <div className="login-header"><h1>Set your owner password</h1><p>Activate your approved owner account. Use at least 10 characters.</p></div>
    {email ? <div role="status"><p>Password saved. Sign in with {email}.</p><Link className="btn-owner-submit" to="/login">Sign in to Owner Portal</Link></div> : !token ? <p role="alert">The setup link is missing. Ask Admin to create a new link.</p> : <form className="login-form" onSubmit={submit}>
      {error && <p className="login-error-alert" role="alert">{error}</p>}
      <div className="form-group"><label htmlFor="owner-new-password">New password</label><input id="owner-new-password" type="password" autoComplete="new-password" minLength={10} required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></div>
      <div className="form-group"><label htmlFor="owner-confirm-password">Confirm password</label><input id="owner-confirm-password" type="password" autoComplete="new-password" minLength={10} required value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} /></div>
      <p>This link works once and expires after 24 hours.</p>
      <button className="btn-owner-submit" disabled={busy}>{busy ? 'Saving password…' : 'Set password'}</button>
    </form>}
  </section></main>;
}
