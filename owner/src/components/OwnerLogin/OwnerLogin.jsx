import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OwnerLogin.css';

const OwnerLogin = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const validateField = (fieldName, value, registering = isRegistering) => {
    let err = '';
    const trimmed = (value || '').trim();

    if (fieldName === 'name' && registering) {
      if (!trimmed) {
        err = 'Full Name is required.';
      } else if (trimmed.length < 2) {
        err = 'Full Name must be at least 2 characters long.';
      } else if (/\d/.test(trimmed) || !/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
        err = 'Full Name cannot contain numbers. Please enter letters only.';
      }
    }

    if (fieldName === 'email') {
      if (!trimmed) {
        err = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        err = 'Please enter a valid email address (e.g. owner@example.com).';
      }
    }

    if (fieldName === 'phone' && registering) {
      const cleanPhone = trimmed.replace(/\D/g, '');
      if (!cleanPhone) {
        err = 'Phone number is required.';
      } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        err = 'Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
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

  const handleToggleMode = (newRegisteringState) => {
    setIsRegistering(newRegisteringState);
    setError('');
    setFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate all relevant fields on submit
    const fieldsToValidate = isRegistering 
      ? ['name', 'email', 'phone', 'password'] 
      : ['email', 'password'];

    const newErrors = {};
    fieldsToValidate.forEach(field => {
      const err = validateField(field, formData[field], isRegistering);
      if (err) newErrors[field] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError('Please resolve all highlighted validation errors below.');
      setLoading(false);
      return;
    }

    const endpoint = isRegistering ? `${API_BASE_URL}/auth/register` : `${API_BASE_URL}/auth/login`;
    const payload = isRegistering 
      ? { ...formData, role: 'owner' } 
      : { email: formData.email, password: formData.password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
          <h1>{isRegistering ? 'Become a Property Partner' : 'Owner Portal Sign In'}</h1>
          <p>
            {isRegistering 
              ? 'List your luxury villa or resort in Mahabaleshwar and connect with guests.'
              : 'Manage your listings, guest bookings, payouts & property analytics.'}
          </p>
        </div>

        {error && <div className="login-error-alert"><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {isRegistering && (
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <i className="fa-solid fa-user"></i>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  onBlur={handleBlur}
                  className={fieldErrors.name ? 'field-invalid' : ''}
                  placeholder="e.g. Vikramaditya Patil" 
                  required 
                />
              </div>
              {fieldErrors.name && (
                <span className="form-error-msg">
                  <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.name}
                </span>
              )}
            </div>
          )}

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

          {isRegistering && (
            <div className="form-group">
              <label>Phone Number</label>
              <div className="input-with-icon">
                <i className="fa-solid fa-phone"></i>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  onBlur={handleBlur}
                  className={fieldErrors.phone ? 'field-invalid' : ''}
                  placeholder="+91 98765 43210" 
                  required 
                />
              </div>
              {fieldErrors.phone && (
                <span className="form-error-msg">
                  <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.phone}
                </span>
              )}
            </div>
          )}

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
              <span>{isRegistering ? 'Register Property Host Account' : 'Access Owner Dashboard'} <i className="fa-solid fa-arrow-right"></i></span>
            )}
          </button>
        </form>

        <div className="login-footer-toggle">
          {isRegistering ? (
            <p>Already have an owner account? <button type="button" onClick={() => handleToggleMode(false)}>Sign In Here</button></p>
          ) : (
            <p>New Villa Host or Resort Owner? <button type="button" onClick={() => handleToggleMode(true)}>Register Host Account</button></p>
          )}
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
