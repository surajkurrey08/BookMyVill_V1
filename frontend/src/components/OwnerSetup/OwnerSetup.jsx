import React, { useState } from 'react';
import { API_BASE_URL, OWNER_PORTAL_URL } from '../../config';
import './OwnerSetup.css';

const OwnerSetup = () => {
  const ownerPortalLoginUrl = `${OWNER_PORTAL_URL}/login`;
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/owner-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'Could not set your password.');
      window.history.replaceState(null, '', window.location.pathname);
      setPassword('');
      setConfirmPassword('');
      setEmail(result.email);
    } catch (err) {
      setError(err.message || 'Could not set your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin-container">
      <div className="signin-overlay" />
      <section className="signin-card glass-morphism" aria-labelledby="owner-setup-title">
        <div className="signin-header">
          <div className="logo"><span className="logo-text">BookMyVilla</span></div>
          <h1 id="owner-setup-title">Set Owner Password</h1>
          <p>Create the password for your approved Property Owner account.</p>
        </div>

        {email ? (
          <div role="status" style={{ textAlign: 'center', color: '#fff' }}>
            <p>Password set successfully.</p>
            <p>Sign in with <strong>{email}</strong> and your new password.</p>
            <a href={ownerPortalLoginUrl} className="signin-btn btn-primary" style={{ display: 'inline-block', padding: '12px 24px' }}>Go to Owner Portal</a>
          </div>
        ) : !token ? (
          <p role="alert" style={{ color: '#fca5a5', textAlign: 'center' }}>
            Setup link missing. Ask the admin to generate a new Owner Login Link.
          </p>
        ) : (
          <form className="signin-form" onSubmit={handleSubmit}>
            {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
            <div className="form-group">
              <label htmlFor="owner-password">New password</label>
              <input id="owner-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={event => setPassword(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="owner-confirm-password">Confirm password</label>
              <input id="owner-confirm-password" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>Use at least 10 characters. This link expires after 24 hours and works once.</p>
            <button className="signin-btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Setting password…' : 'Set Password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};

export default OwnerSetup;
