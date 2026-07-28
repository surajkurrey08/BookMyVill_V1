import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './CaretakerApply.css';
import bgImage from '../../assets/hillstationhome (1).jpg';
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
  const navigate = useNavigate();

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
      } catch (err) {
        console.warn('Failed to parse user state:', err);
      }
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

    if (name === 'fullName' && !trimmed) {
      error = 'Full Name is required.';
    }

    if (name === 'email' && !trimmed) {
      error = 'Email Address is required.';
    }

    if (name === 'phone') {
      const cleanPhone = trimmed.replace(/\D/g, '');
      if (!cleanPhone) {
        error = 'Contact Phone Number is required.';
      } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        error = 'Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
      }
    }

    if (name === 'govtId') {
      const govtType = form.govtIdType || 'Aadhaar Card';
      if (!trimmed) {
        error = `${govtType} details are required for verification.`;
      } else if (govtType === 'Aadhaar Card') {
        const cleanAadhaar = trimmed.replace(/\D/g, '');
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          error = 'Aadhaar number must be exactly 12 digits (e.g. 123456789012).';
        }
      } else if (govtType === 'PAN Card') {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(trimmed.toUpperCase())) {
          error = 'PAN must be 10 characters (5 letters + 4 digits + 1 letter, e.g. ABCDE1234F).';
        }
      } else if (govtType === 'Driving License') {
        if (!/^[A-Z0-9]{10,16}$/i.test(trimmed)) {
          error = 'Driving License must be 10-16 alphanumeric characters.';
        }
      } else if (govtType === 'Voter ID Card') {
        if (!/^[A-Z]{3}[0-9]{7}$/i.test(trimmed)) {
          error = 'Voter ID must be 3 letters + 7 digits (e.g. ABC1234567).';
        }
      }
    }

    if (name === 'bio') {
      if (!trimmed) {
        error = 'Caretaker proposal / background details are required.';
      } else if (trimmed.length < 10) {
        error = 'Background details must be at least 10 characters long.';
      }
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

    const token = localStorage.getItem('token');
    setIsSubmitting(true);

    try {
      let res;
      if (token) {
        res = await fetch(`${API_BASE_URL}/api/caretaker/apply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            propertyName: form.propertyName || form.city,
            phone: form.phone.trim(),
            experience: form.experience,
            govtId: form.govtId.trim(),
            bio: form.bio.trim(),
            services: [form.services]
          })
        });
      } else {
        const caretakerPayload = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          partnerType: 'Caretaker',
          propertyName: form.propertyName || 'N/A',
          city: form.city,
          govtId: form.govtId.trim(),
          experience: form.experience,
          services: form.services,
          message: form.bio.trim()
        };

        res = await fetch(`${API_BASE_URL}/api/partner/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caretakerPayload)
        });

        if (res.status === 404) {
          res = await fetch(`${API_BASE_URL}/api/admin/partner-apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(caretakerPayload)
          });
        }
      }

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Caretaker Security Verification Form Submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
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
      console.error('Caretaker submit error:', err);
      setSuccessMsg('Caretaker Security Verification Form Submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setErrors({});
    setSuccessMsg('');
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="caretaker-page">
      <Navbar />

      <div className="caretaker-bg">
        <img src={bgImage} alt="Background" />
        <div className="caretaker-overlay"></div>
      </div>

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
                  <span style={{
                    background: '#52b788',
                    color: '#1a1a1a',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                  }}>
                    {app.status || 'Certified'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(82, 183, 136, 0.2)',
              border: '1px solid #52b788',
              color: '#52b788',
              padding: '16px 20px',
              borderRadius: '14px',
              marginBottom: '24px',
              fontWeight: '700',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '1.4rem' }}></i> {successMsg}
            </div>
          )}

          {Object.values(errors).some(Boolean) && (
            <div style={{
              background: 'rgba(239, 71, 111, 0.15)',
              border: '1px solid #ef476f',
              color: '#ff6b6b',
              padding: '12px 18px',
              borderRadius: '14px',
              marginBottom: '24px',
              fontWeight: '600',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              Please fix the highlighted errors before submitting your verification form.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Row 1: Caretaker Name */}
            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span>
                  <i className="fa-solid fa-user caretaker-icon"></i> Caretaker Full Name <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
                {errors.fullName && <span className="caretaker-field-error">{errors.fullName}</span>}
              </label>
              <input
                type="text"
                className={`caretaker-input ${errors.fullName ? 'has-error' : ''}`}
                placeholder="Enter full legal name"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                required
              />
            </div>

            {/* Row 2: Email Address & Contact Phone in ONE ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-envelope caretaker-icon"></i> Email Address <span style={{ color: '#ff6b6b' }}>*</span>
                  </span>
                  {errors.email && <span className="caretaker-field-error">{errors.email}</span>}
                </label>
                <input
                  type="email"
                  className={`caretaker-input ${errors.email ? 'has-error' : ''}`}
                  placeholder="caretaker@example.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-phone caretaker-icon"></i> Contact Phone (10 Digits) <span style={{ color: '#ff6b6b' }}>*</span>
                  </span>
                  {errors.phone && <span className="caretaker-field-error">{errors.phone}</span>}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  className={`caretaker-input ${errors.phone ? 'has-error' : ''}`}
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    handleChange('phone', val);
                  }}
                  required
                />
              </div>
            </div>

            {/* Row 3: Govt ID Type & ID Proof Number */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-id-card caretaker-icon"></i> Govt ID Type <span style={{ color: '#ff6b6b' }}>*</span>
                  </span>
                </label>
                <select
                  className="caretaker-select"
                  value={form.govtIdType || 'Aadhaar Card'}
                  onChange={(e) => {
                    setForm({ ...form, govtIdType: e.target.value, govtId: '' });
                    setErrors({ ...errors, govtId: '' });
                  }}
                >
                  <option value="Aadhaar Card">Aadhaar Card (12 Digits)</option>
                  <option value="PAN Card">PAN Card (10 Alphanumeric)</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID Card">Voter ID Card</option>
                  <option value="Property License">Property License / Utility Bill</option>
                </select>
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-fingerprint caretaker-icon"></i> 
                    {form.govtIdType === 'PAN Card' ? 'PAN Number (10 Chars)' : form.govtIdType === 'Aadhaar Card' || !form.govtIdType ? 'Aadhaar Number (12 Digits)' : 'ID Number / License No.'} 
                    <span style={{ color: '#ff6b6b' }}> *</span>
                  </span>
                  {errors.govtId && <span className="caretaker-field-error">{errors.govtId}</span>}
                </label>
                <input
                  type="text"
                  className={`caretaker-input ${errors.govtId ? 'has-error' : ''}`}
                  placeholder={
                    form.govtIdType === 'PAN Card' ? 'e.g. ABCDE1234F' :
                    form.govtIdType === 'Driving License' ? 'e.g. MH1220230012345' :
                    form.govtIdType === 'Voter ID Card' ? 'e.g. ABC1234567' :
                    form.govtIdType === 'Property License' ? 'e.g. LIC-987654' :
                    'e.g. 123456789012'
                  }
                  maxLength={
                    form.govtIdType === 'Aadhaar Card' || !form.govtIdType ? 12 :
                    form.govtIdType === 'PAN Card' || form.govtIdType === 'Voter ID Card' ? 10 : 16
                  }
                  value={form.govtId}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (form.govtIdType === 'Aadhaar Card' || !form.govtIdType) {
                      val = val.replace(/\D/g, '').slice(0, 12);
                    } else {
                      val = val.toUpperCase().slice(0, 16);
                    }
                    handleChange('govtId', val);
                  }}
                  required
                />
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-briefcase caretaker-icon"></i> Experience
                  </span>
                </label>
                <select
                  className="caretaker-select"
                  value={form.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                >
                  <option value="1-2 Years">1 - 2 Years Experience</option>
                  <option value="3-5 Years">3 - 5 Years Experience</option>
                  <option value="5+ Years">5+ Senior Years Experience</option>
                </select>
              </div>

              <div className="caretaker-field-group">
                <label className="caretaker-label">
                  <span>
                    <i className="fa-solid fa-location-dot caretaker-icon"></i> Work Location Preference
                  </span>
                </label>
                <select
                  className="caretaker-select"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                >
                  <option value="Mahabaleshwar">Mahabaleshwar</option>
                  <option value="Panchgani">Panchgani</option>
                  <option value="Pune">Pune & Outskirts</option>
                  <option value="Lonavala">Lonavala / Khandala</option>
                </select>
              </div>
            </div>

            {/* Row 3: Specialized Services */}
            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span>
                  <i className="fa-solid fa-concierge-bell caretaker-icon"></i> Specialized Services Offered
                </span>
              </label>
              <input
                type="text"
                className="caretaker-input"
                placeholder="e.g. Guest Check-in, Maharashtrian Cooking, Pool & Lawn Maintenance"
                value={form.services}
                onChange={(e) => handleChange('services', e.target.value)}
              />
            </div>

            {/* Row 4: Background Details / Proposal */}
            <div className="caretaker-field-group">
              <label className="caretaker-label">
                <span>
                  <i className="fa-solid fa-align-left caretaker-icon"></i> Caretaker Background & Experience Details <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
              </label>
              <textarea
                rows="4"
                className={`caretaker-textarea ${errors.bio ? 'has-error' : ''}`}
                placeholder="Share details about past villa management background, residential address, culinary skills, and availability..."
                value={form.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                required
              ></textarea>
              {errors.bio && <span className="caretaker-field-error">{errors.bio}</span>}
            </div>

            {/* Action Buttons */}
            <div className="caretaker-actions-bar" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-cancel-caretaker"
                onClick={handleCancel}
              >
                <i className="fa-solid fa-xmark"></i> Cancel
              </button>
              <button
                type="submit"
                className="btn-submit-caretaker"
                disabled={isSubmitting}
                style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)', color: '#1a1a1a', border: 'none' }}
              >
                <i className="fa-solid fa-check"></i> {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CaretakerApply;
