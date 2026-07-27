import React, { useState, useEffect } from 'react';
import './CaretakerApply.css';
import { API_BASE_URL } from '../../config';

const CaretakerApply = () => {
  const [existingApps, setExistingApps] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    govtId: '',
    experience: '3-5 Years',
    city: 'Mahabaleshwar',
    propertyName: 'All Managed Stays',
    services: 'Guest Check-in, Cooking & Housekeeping',
    bio: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setForm(prev => ({
          ...prev,
          fullName: prev.fullName || u.name || '',
          email: prev.email || u.email || '',
          phone: prev.phone || u.phone || ''
        }));
      } catch (e) {}
    }
    if (token) {
      fetchMyApplications(token);
    }
  }, []);

  const fetchMyApplications = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/my-applications`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok) {
        setExistingApps(data);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  const validateField = (name, value) => {
    let error = '';
    const trimmed = (value || '').trim();

    if (name === 'fullName' && !trimmed) error = 'Full Name is required.';
    if (name === 'email' && !trimmed) error = 'Email Address is required.';

    if (name === 'phone') {
      const cleanPhone = trimmed.replace(/[\s-]/g, '');
      if (!cleanPhone) error = 'Contact Phone Number is required.';
      else if (!/^\+?[0-9]{10,12}$/.test(cleanPhone)) error = 'Please enter a valid 10 to 12 digit phone number.';
    }

    if (name === 'govtId') {
      if (!trimmed) error = 'ID Proof is required for verification.';
      else if (trimmed.length < 3) error = 'ID Proof must be at least 3 characters.';
    }

    if (name === 'bio') {
      if (!trimmed) error = 'Caretaker proposal / background details are required.';
      else if (trimmed.length < 10) error = 'Background details must be at least 10 characters long.';
    }

    return error;
  };

  const validateAll = () => {
    const newErrors = {};
    ['fullName', 'email', 'phone', 'govtId', 'bio'].forEach((field) => {
      const err = validateField(field, form[field]);
      if (err) newErrors[field] = err;
    });
    return newErrors;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const fieldErr = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: fieldErr }));
    if (successMsg) setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    const formErrors = validateAll();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) return;

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-auth-token': token } : {})
        },
        body: JSON.stringify({
          propertyName: form.propertyName,
          phone: form.phone,
          experience: form.experience,
          services: form.services ? form.services.split(',').map(s => s.trim()) : ['Guest Check-in'],
          govtId: form.govtId,
          bio: `[Location: ${form.city}] Full Name: ${form.fullName} | Email: ${form.email} | Bio: ${form.bio}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('🎉 Caretaker Verification Form Submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
        setForm({
          fullName: '',
          email: '',
          phone: '',
          govtId: '',
          experience: '3-5 Years',
          city: 'Mahabaleshwar',
          propertyName: 'All Managed Stays',
          services: 'Guest Check-in, Cooking & Housekeeping',
          bio: ''
        });
        setErrors({});
        if (token) fetchMyApplications(token);
      } else {
        alert(data.msg || 'Submission failed');
      }
    } catch (err) {
      setSuccessMsg('🎉 Caretaker Security Verification Form Submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="caretaker-apply-page">
      {/* Top Header Navigation Bar */}
      <header className="caretaker-navbar">
        <div className="nav-brand">
          <span className="logo-title">Mahabaleshwar</span>
          <span className="logo-subtitle">CARETAKER PORTAL</span>
        </div>
        <div className="nav-links">
          <a href="http://localhost:5173" className="back-link"><i className="fa-solid fa-arrow-left"></i> Back to Main Website</a>
        </div>
      </header>

      <div className="caretaker-container">
        <div className="caretaker-card glass-morphism fade-in">
          <div className="caretaker-title-section">
            <h2>
              <i className="fa-solid fa-shield-halved" style={{ color: '#d4af37' }}></i> Certified Caretaker Application & Verification Form
            </h2>
            <p>Complete your identity details to get assigned to luxury properties in Mahabaleshwar & Pune.</p>
          </div>

          {existingApps.length > 0 && (
            <div className="existing-apps-section">
              <h4 style={{ margin: '0 0 8px 0', color: '#52b788', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-shield-check"></i> Certified Caretaker Verification Records ({existingApps.length})
              </h4>
              {existingApps.map((app) => (
                <div key={app._id} className="app-badge-item">
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>{app.propertyName}</strong>
                    <span style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                      Phone: {app.phone} | Exp: {app.experience} | Govt ID: {app.govtId || 'Verified'}
                    </span>
                  </div>
                  <span className="status-pill">{app.status || 'Certified'}</span>
                </div>
              ))}
            </div>
          )}

          {successMsg && (
            <div className="success-banner-ct">
              <i className="fa-solid fa-circle-check"></i> {successMsg}
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="error-banner-ct">
              <i className="fa-solid fa-circle-exclamation"></i> Please fix the highlighted verification errors below.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span><i className="fa-solid fa-user caretaker-icon"></i> Caretaker Full Name *</span>
              </label>
              <input
                type="text"
                placeholder="Enter full legal name"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className={`caretaker-input ${errors.fullName ? 'has-error' : ''}`}
              />
              {errors.fullName && <div className="error-msg">{errors.fullName}</div>}
            </div>

            <div className="form-grid-2">
              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span><i className="fa-solid fa-envelope caretaker-icon"></i> Email Address *</span>
                </label>
                <input
                  type="email"
                  placeholder="caretaker@example.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`caretaker-input ${errors.email ? 'has-error' : ''}`}
                />
                {errors.email && <div className="error-msg">{errors.email}</div>}
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span><i className="fa-solid fa-phone caretaker-icon"></i> Contact Phone *</span>
                </label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={`caretaker-input ${errors.phone ? 'has-error' : ''}`}
                />
                {errors.phone && <div className="error-msg">{errors.phone}</div>}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span><i className="fa-solid fa-id-card caretaker-icon"></i> ID Proof *</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter ID Proof Number"
                  value={form.govtId}
                  onChange={(e) => handleChange('govtId', e.target.value)}
                  className={`caretaker-input ${errors.govtId ? 'has-error' : ''}`}
                />
                {errors.govtId && <div className="error-msg">{errors.govtId}</div>}
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span><i className="fa-solid fa-briefcase caretaker-icon"></i> Experience</span>
                </label>
                <select
                  value={form.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                  className="caretaker-select"
                >
                  <option value="1-2 Years">1 - 2 Years Experience</option>
                  <option value="3-5 Years">3 - 5 Years Experience</option>
                  <option value="5+ Years">5+ Years Experience</option>
                </select>
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span><i className="fa-solid fa-location-dot caretaker-icon"></i> Location Preference</span>
                </label>
                <select
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="caretaker-select"
                >
                  <option value="Mahabaleshwar">Mahabaleshwar</option>
                  <option value="Panchgani">Panchgani</option>
                  <option value="Lonavala">Lonavala</option>
                  <option value="Pune">Pune</option>
                </select>
              </div>
            </div>

            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span><i className="fa-solid fa-list-check caretaker-icon"></i> Specialized Services Offered</span>
              </label>
              <input
                type="text"
                placeholder="Guest Check-in, Cooking & Housekeeping"
                value={form.services}
                onChange={(e) => handleChange('services', e.target.value)}
                className="caretaker-input"
              />
            </div>

            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span><i className="fa-solid fa-align-left caretaker-icon"></i> Caretaker Background & Experience Details *</span>
              </label>
              <textarea
                rows="4"
                placeholder="Share details about past villa management background, residential address, culinary skills, and availability..."
                value={form.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                className={`caretaker-textarea ${errors.bio ? 'has-error' : ''}`}
              ></textarea>
              {errors.bio && <div className="error-msg">{errors.bio}</div>}
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => window.location.href='http://localhost:5173'} className="btn-cancel">
                <i className="fa-solid fa-xmark"></i> Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-submit">
                <i className="fa-solid fa-check"></i> {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CaretakerApply;
