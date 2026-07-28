import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../SignIn/SignIn.css';
import { API_BASE_URL } from '../../config';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Clear old user session credentials for fresh user creation
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = (formData.name || '').trim();
    if (/\d/.test(trimmedName) || !/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
      setErrorMsg('Full name cannot contain numbers or numeric digits. Please enter alphabetic letters only.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: formData.role
        })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        const destination = location.state?.from || '/';
        navigate(destination, { state: { property: location.state?.property } });
      } else {
        setErrorMsg(data.msg || data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg('Connection to server failed');
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-overlay"></div>
      <div className="signin-card glass-morphism fade-in" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1 && window.history.state?.idx > 0) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          title="Cancel registration"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            transition: 'all 0.25s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.color = '#ffffff';
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="signin-header">
          <div className="logo">
            <span className="logo-text">MAHABLESHWAR</span>
            <span className="logo-subtext">LUXURY RETREATS</span>
          </div>
          <h2>Join the Bliss</h2>
          <p>Create your luxury member account</p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.88rem',
            fontWeight: '700',
            textAlign: 'center'
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
            {errorMsg}
          </div>
        )}

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
              >
                <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button type="submit" className="signin-btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            CREATE ACCOUNT
          </button>
        </form>

        <div className="signin-footer">
          <p>Already have an account? <Link to="/signin">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
