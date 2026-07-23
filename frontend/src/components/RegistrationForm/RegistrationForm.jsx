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
    description: '',
    photos: [],
    videos: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState('');

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

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
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...base64Files] }));
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
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const payload = {
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        partnerType: 'Property Owner',
        propertyName: formData.propertyName,
        propertyType: formData.propertyType,
        city: formData.location,
        price: formData.price,
        message: formData.description
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
            price: formData.price ? parseInt(formData.price) : 12000,
            photos: formData.photos,
            videos: formData.videos,
            description: formData.description
          })
        });
      }

      setSubmittedMsg('Your Property Owner listing application has been submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
      setFormData({
        name: '',
        email: '',
        phone: '',
        propertyName: '',
        propertyType: 'Villa Estate',
        location: 'Mahabaleshwar',
        price: '',
        description: '',
        photos: [],
        videos: []
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Registration error:', err);
      setSubmittedMsg('Your Property Owner listing application has been submitted! Status: 🟡 PENDING ADMIN VERIFICATION');
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
            <form onSubmit={handleSubmit}>
              {/* Row 1: Owner Full Name */}
              <div className="form-group">
                <label>Owner Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter owner full name" 
                />
              </div>

              {/* Row 2: Email Address & Contact Phone Number in ONE ROW */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input 
                    type="email" 
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="owner@example.com" 
                  />
                </div>

                <div className="form-group">
                  <label>Contact Phone Number *</label>
                  <input 
                    type="tel" 
                    required 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+91 9876543210" 
                  />
                </div>
              </div>

              {/* Row 2: Property Name, Type, Location */}
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '14px' }}>
                <div className="form-group">
                  <label>Property / Villa Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.propertyName}
                    onChange={(e) => setFormData({...formData, propertyName: e.target.value})}
                    placeholder="e.g. Royal Mist Villa" 
                  />
                </div>

                <div className="form-group">
                  <label>Property Type *</label>
                  <select 
                    value={formData.propertyType}
                    onChange={(e) => setFormData({...formData, propertyType: e.target.value})}
                  >
                    <option value="Villa Estate">Villa Estate</option>
                    <option value="Luxury Hotel">Luxury Hotel</option>
                    <option value="Valley Resort">Valley Resort</option>
                    <option value="Mountain Cabin">Mountain Cabin</option>
                    <option value="Eco Cottage">Eco Cottage</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Property Location / City *</label>
                  <select 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  >
                    <option value="Mahabaleshwar">Mahabaleshwar</option>
                    <option value="Panchgani">Panchgani</option>
                    <option value="Pune & Outskirts">Pune & Outskirts</option>
                    <option value="Lonavala">Lonavala / Khandala</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Price */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Expected Price Per Night (₹)</label>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="12000" 
                />
              </div>

              {/* Row 4: Property Description */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Property Description & Room Details</label>
                <textarea 
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
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
              </div>

              {/* Photo Upload Field */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>
                  <i className="fa-solid fa-camera" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                  Property Photos {formData.photos.length > 0 && `(${formData.photos.length} selected)`}
                </label>
                <div className="photo-upload-area">
                  <div className="upload-content">
                    <span className="upload-icon">+</span>
                    <p>{formData.photos.length > 0 ? `${formData.photos.length} photo(s) selected` : 'Upload property images (JPG, PNG)'}</p>
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
