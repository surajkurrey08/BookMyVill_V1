import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SignIn.css';
import { API_BASE_URL } from '../../config';


const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        const destination = location.state?.from || '/';
        navigate(destination, { state: { property: location.state?.property } });
      } else {
        setErrorMsg(data.msg || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Connection to server failed');
    }
  };

  return (
    <div className="signin-container">
      <div style={{
        position: 'fixed',
        top: '25px',
        left: '25px',
        zIndex: 9999
      }}>
        <button 
          onClick={() => {
            if (window.history.length > 1 && window.history.state?.idx > 0) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          title="Go to previous page"
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#1a1a1a',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            padding: '9px 20px',
            borderRadius: '30px',
            fontSize: '0.9rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-arrow-left" style={{ color: '#2D433D' }}></i> Back
        </button>
      </div>
      <div className="signin-overlay"></div>
      <div className="signin-card glass-morphism fade-in">
        <div className="signin-header">
          <div className="logo">
            <span className="logo-text">MAHABLESHWAR</span>
            <span className="logo-subtext">LUXURY RETREATS</span>
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to your luxury experience</p>
        </div>

        {location.state?.from && (
          <div style={{
            background: 'rgba(212, 175, 55, 0.18)',
            border: '1px solid #d4af37',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            <i className="fa-solid fa-user-lock" style={{ color: '#d4af37', fontSize: '1.1rem' }}></i>
            Please sign in to proceed with your hotel booking
          </div>
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 71, 111, 0.18)',
            border: '1px solid #ef476f',
            color: '#ff6b6b',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '20px',
            fontSize: '0.88rem',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="signin-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            <div className="forgot-password-container">
              <a href="#" className="forgot-link">Forgot Password?</a>
            </div>
          </div>

          <button type="submit" className="signin-btn btn-primary">
            Sign In
          </button>
        </form>

        <div className="signin-footer">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
