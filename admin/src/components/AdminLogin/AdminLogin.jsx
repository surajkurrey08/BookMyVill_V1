import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { readAdminSession, clearAdminSession, saveAdminSession } from '../../session';
import { adminApi } from '../Console/api';
import './AdminLogin.css';
import { API_BASE_URL } from '../../config';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.authError) setError(location.state.authError);
    // Stored role metadata can be stale; verify with the backend before
    // redirecting so rejected sessions cannot bounce back into the console.
    if (!readAdminSession()) return;
    const controller = new AbortController();
    setLoading(true);
    adminApi('/me', { signal: controller.signal }).then(() => {
      if (!controller.signal.aborted) navigate('/console', { replace: true });
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err.status === 401 || err.status === 403) clearAdminSession();
      setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [navigate, location.state]);

  const validateField = (fieldName, value) => {
    let err = '';
    const trimmed = (value || '').trim();
    if (fieldName === 'email') {
      if (!trimmed) {
        err = 'Admin email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        err = 'Please enter a valid admin email address (e.g. admin@mahabaleshwar.com).';
      }
    }
    if (fieldName === 'password') {
      if (!value) {
        err = 'Security password is required.';
      } else if (value.length < 6) {
        err = 'Security password must be at least 6 characters long.';
      }
    }
    return err;
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setError('');
    setFieldErrors(prev => ({ ...prev, email: validateField('email', val) }));
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setError('');
    setFieldErrors(prev => ({ ...prev, password: validateField('password', val) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      setError('Please correct the highlighted validation errors below.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();

      if (response.ok) {
        if (data.user && data.user.role === 'admin') {
          saveAdminSession(data.token, data.user);
          navigate('/console', { replace: true });
        } else {
          setError('Access Denied. This portal is restricted to Administrators only.');
        }
      } else {
        setError(data.msg || 'Invalid administrator credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection to security server failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="login-background-overlay"></div>
      <div className="login-card glass-morphism fade-in">
        <div className="login-header">
          <div className="logo">
            <span className="logo-text">MAHABALESHWAR</span>
            <span className="logo-subtext">ADMIN PORTAL</span>
          </div>
          <p className="login-subtitle">Management & Control Suite</p>
        </div>

        {error && (
          <div className="error-banner">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-envelope"></i>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={(e) => setFieldErrors(prev => ({ ...prev, email: validateField('email', e.target.value) }))}
                className={fieldErrors.email ? 'field-invalid' : ''}
                placeholder="admin@mahabaleshwar.com"
                required
                disabled={loading}
              />
            </div>
            {fieldErrors.email && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Security Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock"></i>
              <input
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={(e) => setFieldErrors(prev => ({ ...prev, password: validateField('password', e.target.value) }))}
                className={fieldErrors.password ? 'field-invalid' : ''}
                placeholder="••••••••••••"
                required
                disabled={loading}
              />
            </div>
            {fieldErrors.password && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.password}
              </span>
            )}
          </div>

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? (
              <span>
                <i className="fa-solid fa-spinner fa-spin"></i> Authenticating...
              </span>
            ) : (
              'Establish Secure Session'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© {new Date().getFullYear()} Mahabaleshwar Luxury Stays Ltd.</p>
          <p className="secure-badge">
            <i className="fa-solid fa-shield-halved"></i> 256-bit Encrypted Session
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
