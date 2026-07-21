import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './RegistrationForm.css';
import { API_BASE_URL } from '../../config';

const RegistrationForm = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    propertyName: '',
    propertyType: 'Villa',
    location: '',
    price: '',
    photos: [],
    videos: []
  });

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
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
      alert('Please sign in to register your property.');
      navigate('/signin');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/properties/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          name: formData.propertyName,
          type: formData.propertyType,
          location: formData.location,
          price: formData.price ? parseInt(formData.price) : 10000,
          photos: formData.photos,
          videos: formData.videos
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Success! Property listing with images and video tour created successfully.');
        setFormData({
          name: '',
          email: '',
          propertyName: '',
          propertyType: 'Villa',
          location: '',
          price: '',
          photos: [],
          videos: []
        });
        if (onSuccess) onSuccess();
      } else {
        if (response.status === 401 || data.msg?.includes('token') || data.msg?.includes('authorization')) {
          alert('Session expired or unauthorized. Please sign in again.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/signin');
          return;
        }
        alert(data.msg || 'Failed to register property');
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('Connection to server failed');
    }
  };

  return (
    <section className="registration-section" id="register">
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
        
        <div className="registration-card glass-morphism fade-in">
          <h3>Register Your Property</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="John Doe" 
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                required 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="john@example.com" 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Property Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.propertyName}
                  onChange={(e) => setFormData({...formData, propertyName: e.target.value})}
                  placeholder="e.g. Pine View Retreat" 
                />
              </div>
              <div className="form-group">
                <label>Property Type</label>
                <select 
                  value={formData.propertyType}
                  onChange={(e) => setFormData({...formData, propertyType: e.target.value})}
                >
                  <option>Villa</option>
                  <option>Hotel</option>
                  <option>Cabin</option>
                  <option>Resort</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input 
                  type="text" 
                  required 
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="City, State" 
                />
              </div>
              <div className="form-group">
                <label>Nightly Price (₹)</label>
                <input 
                  type="number" 
                  required 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="e.g. 15000" 
                />
              </div>
            </div>

            {/* Photo Upload Field */}
            <div className="form-group">
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
            <div className="form-group">
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

            <button type="submit" className="btn-primary w-full">Submit Property Listing</button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default RegistrationForm;
