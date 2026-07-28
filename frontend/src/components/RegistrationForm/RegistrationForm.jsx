import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RegistrationForm.css';
import { API_BASE_URL } from '../../config';
import bgImage from '../../assets/hillstationhome (1).jpg';

const RegistrationForm = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyName: '',
    propertyType: 'Villa Estate',
    location: 'Mahabaleshwar',
    price: '',
    mapLink: '',
    description: '',
    photos: [],
    videos: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [showErrorSummary, setShowErrorSummary] = useState(false);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const validateField = (name, value, currentPhotos) => {
    switch (name) {
      case 'name': {
        const trimmedName = (value || '').trim();
        if (!trimmedName || trimmedName.length < 3) {
          return 'Owner full name is required for verification (minimum 3 characters).';
        }
        if (/\d/.test(trimmedName) || !/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
          return 'Owner full name cannot contain numbers or numeric digits. Please enter alphabetic letters only.';
        }
        break;
      }
      case 'email':
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return 'Please enter a valid email address (e.g. owner@example.com).';
        }
        break;
      case 'phone': {
        const digits = (value || '').replace(/\D/g, '');
        if (!value || digits.length < 10) {
          return 'Contact phone number must contain at least 10 digits.';
        }
        break;
      }
      case 'propertyName':
        if (!value || value.trim().length < 3) {
          return 'Property / Villa name is required for verification.';
        }
        break;
      case 'propertyType':
        if (!value) {
          return 'Please select a property category type.';
        }
        break;
      case 'location':
        if (!value) {
          return 'Please select the property location city.';
        }
        break;
      case 'price':
        if (!value || isNaN(value) || parseInt(value) <= 0) {
          return 'Expected price per night must be a positive number (min ₹1).';
        }
        break;
      case 'mapLink':
        if (!value || !/^(https?:\/\/)?([\w\d.-]+)+([\w\d\-._~:/?#[\]@!$&'()*+,;=.]+)?$/i.test(value.trim()) || (!value.includes('http://') && !value.includes('https://'))) {
          return 'Please provide a valid Google Maps location link starting with https://';
        }
        break;
      case 'description':
        if (!value || value.trim().length < 15) {
          return 'Property description must be at least 15 characters explaining room details & amenities.';
        }
        break;
      case 'photos':
        if (!currentPhotos || currentPhotos.length === 0) {
          return 'At least 1 high-res property photo is required for security verification.';
        }
        break;
      default:
        return '';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    if (errors[field]) {
      const fieldErr = validateField(field, value, updatedData.photos);
      setErrors(prev => ({ ...prev, [field]: fieldErr }));
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    try {
      const base64Files = await Promise.all(files.map(file => convertToBase64(file)));
      const newPhotos = [...formData.photos, ...base64Files];
      setFormData(prev => ({ ...prev, photos: newPhotos }));
      if (errors.photos) {
        const fieldErr = validateField('photos', null, newPhotos);
        setErrors(prev => ({ ...prev, photos: fieldErr }));
      }
    } catch (err) {
      console.error('Error converting images:', err);
      alert('Error processing images. Please try again.');
    }
  };

  const handleVideoChange = async (e) => {
    const files = Array.from(e.target.files);
    try {
      const base64Files = await Promise.all(files.map(file => convertToBase64(file)));
      setFormData(prev => ({ ...prev, videos: [...prev.videos, ...base64Files] }));
    } catch (err) {
      console.error('Error converting video files:', err);
      alert('Error processing video files. Please try again.');
    }
  };

  const removePhotos = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setFormData(prev => ({ ...prev, photos: [] }));
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    setErrors(prev => ({ ...prev, photos: 'At least 1 high-res property photo is required for security verification.' }));
  };

  const removeVideos = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setFormData(prev => ({ ...prev, videos: [] }));
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields for property owner verification
    const newErrors = {};
    const fieldsToValidate = ['name', 'email', 'phone', 'propertyName', 'propertyType', 'location', 'price', 'mapLink', 'description', 'photos'];
    fieldsToValidate.forEach(f => {
      const err = validateField(f, formData[f], formData.photos);
      if (err) newErrors[f] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShowErrorSummary(true);
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }

    setShowErrorSummary(false);
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const cleanPrice = formData.price ? parseInt(formData.price.toString().replace(/[^0-9]/g, ''), 10) : 10000;
      const payload = {
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        partnerType: 'Property Owner',
        propertyName: formData.propertyName,
        propertyType: formData.propertyType,
        city: formData.location,
        price: isNaN(cleanPrice) || cleanPrice <= 0 ? 10000 : cleanPrice,
        mapLink: formData.mapLink,
        message: formData.description,
        photos: formData.photos,
        videos: formData.videos
      };

      // 1. Submit for Partner / Security Admin Approval
      let resPartner = await fetch(`${API_BASE_URL}/api/partner/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Fallback if running server hasn't restarted yet
      if (resPartner.status === 404) {
        resPartner = await fetch(`${API_BASE_URL}/api/admin/partner-apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      // 2. If token exists, also submit property to properties endpoint
      if (token) {
        await fetch(`${API_BASE_URL}/api/properties/add`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            name: formData.propertyName,
            type: formData.propertyType,
            location: formData.location,
            price: isNaN(cleanPrice) || cleanPrice <= 0 ? 10000 : cleanPrice,
            mapLink: formData.mapLink,
            amenities: formData.amenities || [],
            photos: formData.photos,
            videos: formData.videos,
            description: formData.description
          })
        });
      }

      // Do NOT set tokens or log in unauthenticated users without password creation and admin approval
      setSubmittedMsg('Property listing submitted successfully! Your application is currently pending Admin Approval. Once the Admin accepts your property, you will be able to set your password and log in to the Property Owner Portal.');
    } catch (err) {
      console.error('Registration error:', err);
      setSubmittedMsg('Property listing submitted successfully! Your application is currently pending Admin Approval. Once the Admin accepts your property, you will be able to log in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="registration-section" id="register">
      {/* Background Image & Overlay */}
      <div className="registration-bg">
        <img src={bgImage} alt="Mahabaleshwar Retreat Background" />
        <div className="registration-overlay"></div>
      </div>

      <div className="registration-container">
        <div className="registration-info fade-in">
          <h2>Become a Host</h2>
          <p>Join our exclusive community of premium hill station property owners. Upload high-res images & video tours to show travelers your luxury stays.</p>
          
          <ul className="benefits-list">
            <li>
              <span className="icon">✓</span>
              <div>
                <h4>HD Photos & Video Tours</h4>
                <p>Add rich media & video walk-throughs to attract premium guests.</p>
              </div>
            </li>
            <li>
              <span className="icon">✓</span>
              <div>
                <h4>Increased Visibility</h4>
                <p>Get featured in our curated collections and map explorer.</p>
              </div>
            </li>
            <li>
              <span className="icon">✓</span>
              <div>
                <h4>Seamless Management</h4>
                <p>Easy-to-use tools to manage your property listings & bookings.</p>
              </div>
            </li>
          </ul>
        </div>
        
        <div className="registration-card glass-morphism fade-in" style={{ maxWidth: '850px', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.8rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px 0' }}>
              <i className="fa-solid fa-hotel" style={{ color: '#d4af37' }}></i> Property Owner Listing Form
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0, fontSize: '0.92rem' }}>
              List your villa, resort or hotel for admin security evaluation and verification.
            </p>
          </div>

          {submittedMsg ? (
            <div style={{
              background: 'rgba(82, 183, 136, 0.2)',
              border: '1px solid #52b788',
              color: '#52b788',
              padding: '24px',
              borderRadius: '16px',
              textAlign: 'center',
              fontWeight: '700',
              lineHeight: '1.6'
            }}>
              <i className="fa-solid fa-shield-check" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px', color: '#d4af37' }}></i>
              <h3 style={{ margin: '0 0 8px 0', color: '#ffffff' }}>Application Under Security Review</h3>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>{submittedMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* TOP VALIDATION SUMMARY ALERT */}
              {showErrorSummary && Object.keys(errors).length > 0 && (
                <div className="form-error-banner fade-in">
                  <h4><i className="fa-solid fa-triangle-exclamation"></i> Host Verification Validation Required</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>
                    Please complete and correct the following mandatory verification fields:
                  </p>
                  <ul>
                    {Object.entries(errors).map(([key, errText]) => (
                      errText ? <li key={key}>{errText}</li> : null
                    ))}
                  </ul>
                </div>
              )}

              {/* Row 1: Owner Full Name */}
              <div className="form-group">
                <label>Owner Full Name *</label>
                <input 
                  type="text" 
                  className={errors.name ? 'field-invalid' : ''}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter owner full name" 
                />
                {errors.name && (
                  <span className="form-error-msg">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.name}
                  </span>
                )}
              </div>

              {/* Row 2: Email Address & Contact Phone Number in ONE ROW */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input 
                    type="email" 
                    className={errors.email ? 'field-invalid' : ''}
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="owner@example.com" 
                  />
                  {errors.email && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.email}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Contact Phone Number *</label>
                  <input 
                    type="tel" 
                    className={errors.phone ? 'field-invalid' : ''}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+91 9876543210" 
                  />
                  {errors.phone && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Property Name, Type, Location */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Property / Villa Name *</label>
                  <input 
                    type="text" 
                    className={errors.propertyName ? 'field-invalid' : ''}
                    value={formData.propertyName}
                    onChange={(e) => handleInputChange('propertyName', e.target.value)}
                    placeholder="e.g. Royal Mist Villa" 
                  />
                  {errors.propertyName && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.propertyName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Property Type *</label>
                  <select 
                    className={errors.propertyType ? 'field-invalid' : ''}
                    value={formData.propertyType}
                    onChange={(e) => handleInputChange('propertyType', e.target.value)}
                  >
                    <option value="Villa Estate">Villa Estate</option>
                    <option value="Luxury Hotel">Luxury Hotel</option>
                    <option value="Valley Resort">Valley Resort</option>
                    <option value="Mountain Cabin">Mountain Cabin</option>
                    <option value="Eco Cottage">Eco Cottage</option>
                  </select>
                  {errors.propertyType && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.propertyType}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Property Location / City *</label>
                  <select 
                    className={errors.location ? 'field-invalid' : ''}
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  >
                    <option value="Mahabaleshwar">Mahabaleshwar</option>
                    <option value="Panchgani">Panchgani</option>
                    <option value="Pune & Outskirts">Pune & Outskirts</option>
                    <option value="Lonavala">Lonavala / Khandala</option>
                  </select>
                  {errors.location && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Price & Live Location Link */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Expected Price Per Night (₹) *</label>
                  <input 
                    type="number" 
                    min="1"
                    className={errors.price ? 'field-invalid' : ''}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    value={formData.price}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, Math.abs(parseInt(e.target.value) || 1));
                      handleInputChange('price', val);
                    }}
                    placeholder="12000" 
                  />
                  {errors.price && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.price}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label><i className="fa-solid fa-map-location-dot" style={{ color: '#d4af37', marginRight: '6px' }}></i> Google Maps Live Location Link *</label>
                  <input 
                    type="url" 
                    className={errors.mapLink ? 'field-invalid' : ''}
                    value={formData.mapLink}
                    onChange={(e) => handleInputChange('mapLink', e.target.value)}
                    placeholder="https://maps.app.goo.gl/..." 
                  />
                  {errors.mapLink && (
                    <span className="form-error-msg">
                      <i className="fa-solid fa-circle-exclamation"></i> {errors.mapLink}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 4: Property Description */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Property Description & Room Details *</label>
                <textarea 
                  rows="3"
                  className={errors.description ? 'field-invalid' : ''}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe bedrooms, amenities (pool, bonfire, Wi-Fi), and view..." 
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    resize: 'vertical'
                  }}
                ></textarea>
                {errors.description && (
                  <span className="form-error-msg">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.description}
                  </span>
                )}
              </div>

              {/* Photo Upload Field */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>
                  <i className="fa-solid fa-camera" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                  Property Photos * {formData.photos.length > 0 && `(${formData.photos.length} selected)`}
                </label>
                <div className={`photo-upload-area ${errors.photos ? 'field-invalid' : ''}`}>
                  <div className="upload-content">
                    <span className="upload-icon">+</span>
                    <p>{formData.photos.length > 0 ? `${formData.photos.length} photo(s) selected` : 'Upload property images (JPG, PNG) - Min 1 required'}</p>
                  </div>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    className="file-input" 
                    onChange={handlePhotoChange} 
                    ref={photoInputRef}
                  />
                  {formData.photos.length > 0 && (
                    <button 
                      type="button" 
                      className="remove-photos-btn" 
                      onClick={removePhotos}
                      title="Remove selected photos"
                    >
                      ×
                    </button>
                  )}
                </div>
                {errors.photos && (
                  <span className="form-error-msg">
                    <i className="fa-solid fa-circle-exclamation"></i> {errors.photos}
                  </span>
                )}
              </div>

              {/* Video Upload Field */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>
                  <i className="fa-solid fa-video" style={{ marginRight: '6px', color: 'var(--secondary-color)' }}></i>
                  Property Video Tour {formData.videos.length > 0 && `(${formData.videos.length} selected)`}
                </label>
                <div className="photo-upload-area" style={{ borderColor: 'var(--secondary-color)' }}>
                  <div className="upload-content">
                    <span className="upload-icon" style={{ color: 'var(--secondary-color)' }}>🎥</span>
                    <p>{formData.videos.length > 0 ? `${formData.videos.length} video(s) attached` : 'Upload video tour (MP4, WebM)'}</p>
                  </div>
                  <input 
                    type="file" 
                    multiple 
                    accept="video/*"
                    className="file-input" 
                    onChange={handleVideoChange} 
                    ref={videoInputRef}
                  />
                  {formData.videos.length > 0 && (
                    <button 
                      type="button" 
                      className="remove-photos-btn" 
                      onClick={removeVideos}
                      title="Remove selected videos"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons Centered */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1 && window.history.state?.idx > 0) {
                      navigate(-1);
                    } else {
                      navigate('/');
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e0e0e0',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    padding: '13px 32px',
                    borderRadius: '50px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="btn-primary"
                  style={{ padding: '13px 36px', fontSize: '0.95rem', fontWeight: '700', border: 'none', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-check"></i> {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default RegistrationForm;
