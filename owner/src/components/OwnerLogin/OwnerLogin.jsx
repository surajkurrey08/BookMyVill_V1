import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OwnerLogin.css';

const OwnerLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const validateField = (fieldName, value) => {
    let err = '';
    const trimmed = (value || '').trim();

    if (fieldName === 'email') {
      if (!trimmed) {
        err = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        err = 'Please enter a valid email address (e.g. owner@example.com).';
      }
    }


    if (fieldName === 'password') {
      if (!value) {
        err = 'Password is required.';
      } else if (value.length < 6) {
        err = 'Password must be at least 6 characters long.';
      }
    }

    return err;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);
    setError('');

    // Instant validation on typing
    const err = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: err }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const err = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate all relevant fields on submit
    const fieldsToValidate = ['email', 'password'];

    const newErrors = {};
    fieldsToValidate.forEach(field => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError('Please resolve all highlighted validation errors below.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Authentication failed');
      }

      if (data.user.role !== 'owner' && data.user.role !== 'admin') {
        throw new Error('Access denied: Account is not registered as a Property Owner host.');
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="owner-login-container">
      <div className="owner-login-card">
        <div className="login-header">
          <div className="portal-badge">
            <i className="fa-solid fa-hotel"></i> Host & Owner Portal
          </div>
          <h1>Owner Portal Sign In</h1>
          <p>Manage your listings, guest bookings, payouts & property analytics.</p>
        </div>

        {error && <div className="login-error-alert"><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-envelope"></i>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                onBlur={handleBlur}
                className={fieldErrors.email ? 'field-invalid' : ''}
                placeholder="owner@mahabaleshwarstays.com" 
                required 
              />
            </div>
            {fieldErrors.email && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-lock"></i>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                onBlur={handleBlur}
                className={fieldErrors.password ? 'field-invalid' : ''}
                placeholder="••••••••" 
                required 
              />
              <button 
                type="button" 
                className="toggle-password-btn" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {fieldErrors.password && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.password}
              </span>
            )}
          </div>

          <button type="submit" className="btn-owner-submit" disabled={loading}>
            {loading ? (
              <span><i className="fa-solid fa-circle-notch fa-spin"></i> Authenticating...</span>
            ) : (
              <span>Access Owner Dashboard <i className="fa-solid fa-arrow-right"></i></span>
            )}
          </button>
        </form>

        <div className="login-footer-toggle">
          <p>Approved owner without a password? Ask the admin for your one-time Owner Login Link.</p>
          <p>New Villa Host or Resort Owner? <a href="http://localhost:5173/register-property">Apply to list your property</a></p>
        </div>

        <div className="back-to-main">
          <a href="http://localhost:5173" className="back-link">
            <i className="fa-solid fa-arrow-left"></i> Return to Main Website
          </a>
        </div>
      </div>
    </div>
  );
};

export default OwnerLogin;
