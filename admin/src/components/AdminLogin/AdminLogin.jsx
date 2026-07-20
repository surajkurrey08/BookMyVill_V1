import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';
import { API_BASE_URL } from '../../config';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'admin') {
          navigate('/dashboard');
        }
      } catch (e) {
        localStorage.clear();
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/dashboard');
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

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-envelope"></i>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mahabaleshwar.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Security Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock"></i>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={loading}
              />
            </div>
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
