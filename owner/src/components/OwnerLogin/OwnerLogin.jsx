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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

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

        <form onSubmit={handleSubmit} className="login-form">
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
                  placeholder="e.g. Vikramaditya Patil" 
                  required 
                />
              </div>
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
                placeholder="owner@mahabaleshwarstays.com" 
                required 
              />
            </div>
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
                  placeholder="+91 98765 43210" 
                  required 
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-lock"></i>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="••••••••" 
                required 
              />
            </div>
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
            <p>Already have an owner account? <button type="button" onClick={() => setIsRegistering(false)}>Sign In Here</button></p>
          ) : (
            <p>New Villa Host or Resort Owner? <button type="button" onClick={() => setIsRegistering(true)}>Register Host Account</button></p>
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
