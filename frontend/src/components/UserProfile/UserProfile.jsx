import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './UserProfile.css';
import bgImage from '../../assets/hillstationhome (1).jpg';
import { API_BASE_URL } from '../../config';
import { updateSessionUser } from '../../lib/session';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: ''
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = sessionStorage.getItem('user') || localStorage.getItem('user');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    if (!userData || !token) {
      navigate('/signin');
      return;
    }

    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      setForm({
        name: parsed.name || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        bio: parsed.bio || (parsed.role === 'owner' ? 'Luxury Villa Host & Property Manager' : 'Guest Traveler')
      });
    } catch (e) {
      console.error('Error parsing user profile:', e);
      navigate('/signin');
    }
  }, [navigate]);

  const validateField = (name, value) => {
    let error = '';
    const trimmed = (value || '').trim();

    if (name === 'name') {
      if (!trimmed) {
        error = 'Full Name is required.';
      } else if (trimmed.length < 3) {
        error = 'Full Name must be at least 3 characters.';
      } else if (trimmed.length > 50) {
        error = 'Full Name cannot exceed 50 characters.';
      } else if (/\d/.test(trimmed)) {
        error = 'Full Name cannot contain numbers or numeric digits. Please enter alphabetic letters only.';
      } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
        error = 'Full Name can only contain letters, spaces, and hyphens/dots.';
      }
    }

    if (name === 'email') {
      if (!trimmed) {
        error = 'Email Address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        error = 'Please enter a valid email address (e.g. user@example.com).';
      }
    }

    if (name === 'phone') {
      const cleanPhone = trimmed.replace(/\D/g, '');
      if (!cleanPhone) {
        error = 'Phone Number is required.';
      } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        error = 'Please enter a valid 10-digit mobile phone number starting with 6, 7, 8, or 9.';
      }
    }

    if (name === 'bio') {
      if (!trimmed) {
        error = 'Bio / Host Description is required.';
      } else if (trimmed.length < 10) {
        error = 'Bio must be at least 10 characters long.';
      } else if (trimmed.length > 300) {
        error = 'Bio cannot exceed 300 characters.';
      }
    }

    return error;
  };

  const validateAllFields = () => {
    const newErrors = {};
    ['name', 'email', 'phone', 'bio'].forEach((field) => {
      const err = validateField(field, form[field]);
      if (err) newErrors[field] = err;
    });
    return newErrors;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const fieldErr = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: fieldErr }));
    if (saveSuccessMsg) setSaveSuccessMsg('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveSuccessMsg('');
    const formErrors = validateAllFields();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          bio: form.bio.trim()
        })
      });

      const data = await response.json();
      if (response.ok) {
        const updatedUser = { ...user, name: data.name, phone: data.phone, bio: data.bio };
        setUser(updatedUser);
        updateSessionUser(updatedUser);
        setSaveSuccessMsg('Profile details updated and saved successfully!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        setErrors(prev => ({ ...prev, general: data.msg || 'Failed to update profile' }));
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setErrors(prev => ({ ...prev, general: 'Network Error: Could not update profile' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || (user?.role === 'owner' ? 'Luxury Villa Host & Property Manager' : 'Guest Traveler')
    });
    setErrors({});
    setSaveSuccessMsg('');

    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="user-profile-page">
      <Navbar />
      
      <div className="profile-bg">
        <img src={bgImage} alt="Background" />
        <div className="profile-overlay"></div>
      </div>

      <div className="profile-container">

        {/* Profile Edit Form Card */}
        <div className="profile-form-card">
          <div className="form-title-section">
            <h2>
              <i className="fa-solid fa-id-card"></i> Manage User Profile
            </h2>
            <p>Update your public host/traveler information and contact details</p>
          </div>

          {saveSuccessMsg && (
            <div style={{
              background: 'rgba(82, 183, 136, 0.2)',
              border: '1px solid #52b788',
              color: '#52b788',
              padding: '12px 18px',
              borderRadius: '14px',
              marginBottom: '24px',
              fontWeight: '700',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fa-solid fa-circle-check"></i> {saveSuccessMsg}
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
              Please fix the errors below before saving your profile.
            </div>
          )}

          <form onSubmit={handleSaveProfile} noValidate>
            {/* Full Name */}
            <div className="profile-field-group">
              <label className="profile-label">
                <span>
                  <i className="fa-solid fa-user label-icon"></i> Full Name <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
                {errors.name && (
                  <span className="field-error">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.name}
                  </span>
                )}
              </label>
              <input
                type="text"
                className={`profile-input ${errors.name ? 'has-error' : form.name && !errors.name ? 'is-valid' : ''}`}
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            {/* Email Address */}
            <div className="profile-field-group">
              <label className="profile-label">
                <span>
                  <i className="fa-solid fa-envelope label-icon"></i> Email Address <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
                {errors.email && (
                  <span className="field-error">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.email}
                  </span>
                )}
              </label>
              <input
                type="email"
                className={`profile-input ${errors.email ? 'has-error' : form.email && !errors.email ? 'is-valid' : ''}`}
                placeholder="e.g. rahul@example.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>

            {/* Phone Number */}
            <div className="profile-field-group">
              <label className="profile-label">
                <span>
                  <i className="fa-solid fa-phone label-icon"></i> Contact Phone Number <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
                {errors.phone && (
                  <span className="field-error">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.phone}
                  </span>
                )}
              </label>
              <input
                type="tel"
                className={`profile-input ${errors.phone ? 'has-error' : form.phone && !errors.phone ? 'is-valid' : ''}`}
                placeholder="e.g. +91 9876543210"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
              />
            </div>

            {/* Bio / Description */}
            <div className="profile-field-group">
              <label className="profile-label">
                <span>
                  <i className="fa-solid fa-align-left label-icon"></i> Bio / Description <span style={{ color: '#ff6b6b' }}>*</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: form.bio?.length > 300 ? '#ff6b6b' : 'rgba(255,255,255,0.5)' }}>
                  {form.bio?.length || 0}/300
                </span>
              </label>
              <textarea
                rows="4"
                className={`profile-textarea ${errors.bio ? 'has-error' : form.bio && !errors.bio ? 'is-valid' : ''}`}
                placeholder="Share a short bio about your travel preferences or property host background (min 10 characters)..."
                value={form.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                required
              ></textarea>
              {errors.bio && (
                <span className="field-error" style={{ marginTop: '6px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i> {errors.bio}
                </span>
              )}
            </div>

            {/* Action Buttons: Save & Cancel */}
            <div className="profile-actions-bar">
              <button
                type="button"
                className="btn-cancel-profile"
                onClick={handleCancelProfile}
              >
                <i className="fa-solid fa-xmark"></i> Cancel
              </button>
              <button
                type="submit"
                className="btn-save-profile"
                disabled={isSaving}
              >
                <i className="fa-solid fa-floppy-disk"></i> {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserProfile;
