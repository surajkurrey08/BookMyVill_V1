import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OwnerDashboard.css';

const OwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modals & Forms state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const PRESET_AMENITIES = [
    'Private Swimming Pool',
    'Free High-Speed Wi-Fi',
    'Mountain & Valley View',
    'Complimentary Breakfast',
    'Air Conditioning (AC)',
    'Free Private Parking',
    'BBQ & Grilling Setup',
    'Lawn & Private Garden',
    '24/7 Power Backup',
    'Night Bonfire & Campfire',
    'Personal Chef / Caretaker',
    'Equipped Kitchen',
    '24/7 Hot Water',
    'Pet Friendly Stay',
    'Indoor Games & Carrom',
    'CCTV Security'
  ];

  const [customAmenityInput, setCustomAmenityInput] = useState('');

  const [propertyForm, setPropertyForm] = useState({
    name: '',
    type: 'Villa',
    location: 'Mahabaleshwar',
    price: 15000,
    mapLink: '',
    amenities: [],
    photos: [],
    videos: ''
  });

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    bio: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Search & Filter States
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [propertyFilterType, setPropertyFilterType] = useState('All');
  const [bookingFilterStatus, setBookingFilterStatus] = useState('All');

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userStr || !token) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(userStr);
    setUser(parsedUser);
    setProfileForm({
      name: parsedUser.name || '',
      phone: parsedUser.phone || '',
      bio: parsedUser.bio || ''
    });

    fetchOwnerData(token);
  }, [navigate]);

  // Caretaker Application State
  const [showCaretakerModal, setShowCaretakerModal] = useState(false);
  const [caretakerApps, setCaretakerApps] = useState([]);
  const [submittingCaretaker, setSubmittingCaretaker] = useState(false);
  const [caretakerForm, setCaretakerForm] = useState({
    propertyId: '',
    propertyName: '',
    phone: '',
    experience: '3+ Years',
    services: ['Guest Check-in', 'Maintenance', 'Housekeeping', '24/7 Security'],
    govtId: '',
    bio: ''
  });

  const fetchOwnerData = async (token) => {
    setLoading(true);
    setError('');
    const authToken = token || localStorage.getItem('token');

    try {
      // 1. Fetch Owner Properties
      const propRes = await fetch(`${API_BASE_URL}/properties/my-properties`, {
        headers: { 'x-auth-token': authToken }
      });
      const propData = await propRes.json();
      if (Array.isArray(propData)) {
        setProperties(propData);
      }

      // 2. Fetch Owner Bookings
      const bookRes = await fetch(`${API_BASE_URL}/bookings/owner`, {
        headers: { 'x-auth-token': authToken }
      });
      const bookData = await bookRes.json();
      if (Array.isArray(bookData)) {
        setBookings(bookData);
      }

      // 3. Fetch Caretaker Applications
      const caretakerRes = await fetch(`${API_BASE_URL}/caretaker/my-applications`, {
        headers: { 'x-auth-token': authToken }
      });
      if (caretakerRes.ok) {
        const appsData = await caretakerRes.json();
        if (Array.isArray(appsData)) {
          setCaretakerApps(appsData);
        }
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
      setError('Failed to load dashboard data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaretakerSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setError('');
    setActionSuccess('');

    // Strict 10-digit Indian Mobile Validation
    const cleanPhone = (caretakerForm.phone || '').trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Contact Phone Number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    // Govt ID Validation based on type
    const govtType = caretakerForm.govtIdType || 'Aadhaar Card';
    const cleanGovtId = (caretakerForm.govtId || '').trim();

    if (!cleanGovtId) {
      setError(`${govtType} number/details are required.`);
      return;
    }

    if (govtType === 'Aadhaar Card') {
      const cleanAadhaar = cleanGovtId.replace(/\D/g, '');
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setError('Aadhaar Card number must be exactly 12 digits (e.g. 123456789012).');
        return;
      }
    } else if (govtType === 'PAN Card') {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanGovtId.toUpperCase())) {
        setError('PAN Card must be 10 characters formatted as 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).');
        return;
      }
    } else if (govtType === 'Driving License') {
      if (!/^[A-Z0-9]{10,16}$/i.test(cleanGovtId)) {
        setError('Driving License number must be 10 to 16 alphanumeric characters (e.g. MH1220230012345).');
        return;
      }
    } else if (govtType === 'Voter ID Card') {
      if (!/^[A-Z]{3}[0-9]{7}$/i.test(cleanGovtId)) {
        setError('Voter ID Card format must be 3 letters followed by 7 digits (e.g. ABC1234567).');
        return;
      }
    }

    setSubmittingCaretaker(true);

    try {
      const payload = {
        ...caretakerForm,
        phone: cleanPhone,
        govtId: `${govtType}: ${cleanGovtId.toUpperCase()}`
      };

      const response = await fetch(`${API_BASE_URL}/caretaker/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setActionSuccess(`Caretaker application submitted for "${caretakerForm.propertyName || 'Property'}"! Admin will assign and verify caretaker.`);
        setShowCaretakerModal(false);
        setCaretakerForm({
          propertyId: '',
          propertyName: '',
          phone: '',
          experience: '3+ Years',
          services: ['Guest Check-in', 'Maintenance', 'Housekeeping', '24/7 Security'],
          govtIdType: 'Aadhaar Card',
          govtId: '',
          bio: ''
        });

        const updatedRes = await fetch(`${API_BASE_URL}/caretaker/my-applications`, {
          headers: { 'x-auth-token': token }
        });
        if (updatedRes.ok) {
          const updatedApps = await updatedRes.json();
          if (Array.isArray(updatedApps)) setCaretakerApps(updatedApps);
        }
      } else {
        setError(data.msg || 'Failed to submit caretaker application.');
      }
    } catch (err) {
      setError('Network Error: Could not reach backend server for caretaker request.');
    } finally {
      setSubmittingCaretaker(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
    window.location.href = '/login';
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handlePhotoFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    try {
      const base64Images = await Promise.all(files.map(f => convertFileToBase64(f)));
      setPropertyForm(prev => ({
        ...prev,
        photos: [...(Array.isArray(prev.photos) ? prev.photos : []), ...base64Images]
      }));
    } catch (err) {
      console.error('Error reading image files:', err);
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPropertyForm(prev => ({
      ...prev,
      photos: Array.isArray(prev.photos) ? prev.photos.filter((_, idx) => idx !== indexToRemove) : []
    }));
  };

  const handleVideoFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    try {
      const base64Videos = await Promise.all(files.map(f => convertFileToBase64(f)));
      setPropertyForm(prev => ({
        ...prev,
        videos: [...(Array.isArray(prev.videos) ? prev.videos : []), ...base64Videos]
      }));
    } catch (err) {
      console.error('Error reading video files:', err);
    }
  };

  const handleRemoveVideo = (indexToRemove) => {
    setPropertyForm(prev => ({
      ...prev,
      videos: Array.isArray(prev.videos) ? prev.videos.filter((_, idx) => idx !== indexToRemove) : []
    }));
  };

  const handleToggleAmenity = (amenityName) => {
    setPropertyForm(prev => {
      const current = prev.amenities || [];
      const exists = current.includes(amenityName);
      const updated = exists 
        ? current.filter(a => a !== amenityName)
        : [...current, amenityName];
      return { ...prev, amenities: updated };
    });
  };

  const handleAddCustomAmenity = (e) => {
    e.preventDefault();
    if (!customAmenityInput.trim()) return;
    const trimmed = customAmenityInput.trim();
    if (!propertyForm.amenities?.includes(trimmed)) {
      setPropertyForm(prev => ({
        ...prev,
        amenities: [...(prev.amenities || []), trimmed]
      }));
    }
    setCustomAmenityInput('');
  };

  // Add / Edit Property Submission
  const handleSaveProperty = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setError('');
    setActionSuccess('');

    const payload = {
      name: propertyForm.name,
      type: propertyForm.type,
      location: propertyForm.location,
      price: Math.max(1, Math.abs(parseInt(propertyForm.price) || 10000)),
      mapLink: propertyForm.mapLink || '',
      amenities: propertyForm.amenities || [],
      photos: Array.isArray(propertyForm.photos) ? propertyForm.photos : (propertyForm.photos ? propertyForm.photos.split(',').map(s => s.trim()).filter(Boolean) : []),
      videos: propertyForm.videos ? (Array.isArray(propertyForm.videos) ? propertyForm.videos : propertyForm.videos.split(',').map(s => s.trim()).filter(Boolean)) : []
    };

    try {
      let url = `${API_BASE_URL}/properties/add`;
      let method = 'POST';

      if (editingProperty) {
        url = `${API_BASE_URL}/properties/${editingProperty._id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to save property');

      setActionSuccess(editingProperty ? 'Property details updated successfully!' : 'Property added successfully! Your new listing is pending Admin Approval before appearing on the public website.');
      setShowAddModal(false);
      setEditingProperty(null);
      setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', amenities: [], photos: [], videos: [] });
      fetchOwnerData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditClick = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name || '',
      type: prop.type || 'Villa',
      location: prop.location || 'Mahabaleshwar',
      price: prop.price || 15000,
      mapLink: prop.mapLink || '',
      amenities: prop.amenities || [],
      photos: prop.photos || [],
      videos: prop.videos || []
    });
    setShowAddModal(true);
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm('Are you sure you want to remove this property listing?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/properties/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        setActionSuccess('Property removed successfully');
        fetchOwnerData(token);
      } else {
        const data = await res.json();
        setError(data.msg || 'Failed to delete property');
      }
    } catch (err) {
      setError('Server error deleting property');
    }
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    const token = localStorage.getItem('token');
    let cancelReason = '';

    if (newStatus === 'cancelled') {
      const input = prompt('Please enter the cancellation reason for the guest:');
      if (input === null) return; // Owner pressed cancel on prompt
      cancelReason = input.trim() || 'Cancelled by property owner';
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/status/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status: newStatus, reason: cancelReason })
      });

      if (res.ok) {
        setActionSuccess(`Booking status updated to ${newStatus}`);
        fetchOwnerData(token);
      } else {
        const data = await res.json();
        setError(data.msg || 'Failed to update booking status');
      }
    } catch (err) {
      setError('Error updating booking status');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setError('');
    setActionSuccess('');

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(profileForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to update profile');

      const updatedUser = { ...user, name: data.name, phone: data.phone, bio: data.bio };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setActionSuccess('Host profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Stats Calculations
  const totalProperties = properties.length;
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => b.paymentStatus === 'paid' ? sum + (b.totalPrice || 0) : sum, 0);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;

  return (
    <div className="owner-dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="owner-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <i className="fa-solid fa-house-user"></i>
          </div>
          <div className="brand-text">
            <h2>Mahabaleshwar</h2>
            <span>Property Owner Portal</span>
          </div>
        </div>

        <div className="user-profile-badge">
          <div className="avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'H'}</div>
          <div className="user-info">
            <h4>{user?.name || 'Property Host'}</h4>
            <span className="role-tag"><i className="fa-solid fa-shield-halved"></i> Verified Host</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="fa-solid fa-chart-line"></i> Dashboard Overview
          </button>
          <button 
            className={`nav-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            <i className="fa-solid fa-building-user"></i> My Properties ({totalProperties})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <i className="fa-solid fa-calendar-check"></i> Guest Bookings ({totalBookings})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="fa-solid fa-wallet"></i> Earnings & Financials
          </button>
          <button 
            className={`nav-btn ${activeTab === 'caretakers' ? 'active' : ''}`}
            onClick={() => setActiveTab('caretakers')}
          >
            <i className="fa-solid fa-user-shield"></i> Caretaker Requests ({caretakerApps.length})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <i className="fa-solid fa-user-gear"></i> Host Profile Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <a href="http://localhost:5173" className="main-site-btn" target="_blank" rel="noreferrer">
            <i className="fa-solid fa-globe"></i> View Main Site
          </a>
          <button className="logout-btn" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="owner-main-content">
        <header className="content-header">
          <div className="header-titles">
            <h1>
              {activeTab === 'overview' && <><i className="fa-solid fa-gauge-high" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Host Command Center</>}
              {activeTab === 'properties' && <><i className="fa-solid fa-hotel" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Property Portfolio ({properties.length})</>}
              {activeTab === 'bookings' && <><i className="fa-solid fa-calendar-check" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Guest Reservations ({bookings.length})</>}
              {activeTab === 'caretakers' && <><i className="fa-solid fa-user-shield" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Property Caretaker Applications ({caretakerApps.length})</>}
              {activeTab === 'analytics' && <><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Financial Earnings & Analytics</>}
              {activeTab === 'profile' && <><i className="fa-solid fa-user-gear" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Host Account Settings</>}
            </h1>
            <p>
              {activeTab === 'overview' && `Welcome back, ${user?.name || 'Owner'}! Track stay performance, guest check-ins & payouts.`}
              {activeTab === 'properties' && `Manage your luxury stay listings, update direct photos, prices and live GPS links.`}
              {activeTab === 'bookings' && `Track check-ins, guest contacts, stay payments, and confirm or reject reservations.`}
              {activeTab === 'caretakers' && `Apply and assign caretakers for your properties, manage guest check-in staff & maintenance.`}
              {activeTab === 'analytics' && `Track direct stay earnings, average reservation value, and monthly host payouts.`}
              {activeTab === 'profile' && `Manage your owner identity, contact details and stay policies displayed to travelers.`}
            </p>
          </div>

          <div className="header-actions">
            {activeTab === 'properties' && (
              <button className="btn-primary-gold" onClick={() => {
                setEditingProperty(null);
                setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', photos: [], videos: '' });
                setShowAddModal(true);
              }}>
                <i className="fa-solid fa-plus"></i> Add New Property
              </button>
            )}
            {activeTab === 'caretakers' && (
              <button className="btn-primary-gold" onClick={() => setShowCaretakerModal(true)}>
                <i className="fa-solid fa-user-plus"></i> Apply for Caretaker
              </button>
            )}
          </div>
        </header>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="alert-box success">
            <i className="fa-solid fa-circle-check"></i> {actionSuccess}
            <button onClick={() => setActionSuccess('')}><i className="fa-solid fa-xmark"></i></button>
          </div>
        )}

        {error && (
          <div className="alert-box error">
            <i className="fa-solid fa-circle-exclamation"></i> {error}
            <button onClick={() => setError('')}><i className="fa-solid fa-xmark"></i></button>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner-container">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            <p>Syncing property records & reservations...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="tab-overview">
                {/* Stats Cards Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon gold"><i className="fa-solid fa-vihara"></i></div>
                    <div className="stat-info">
                      <span className="stat-label">Listed Properties</span>
                      <h3 className="stat-value">{totalProperties}</h3>
                      <span className="stat-sub font-green">Active in Mahabaleshwar</span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon emerald"><i className="fa-solid fa-calendar-days"></i></div>
                    <div className="stat-info">
                      <span className="stat-label">Total Reservations</span>
                      <h3 className="stat-value">{totalBookings}</h3>
                      <span className="stat-sub">{pendingBookings} pending confirmation</span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon yellow"><i className="fa-solid fa-indian-rupee-sign"></i></div>
                    <div className="stat-info">
                      <span className="stat-label">Gross Revenue</span>
                      <h3 className="stat-value">₹{totalRevenue.toLocaleString('en-IN')}</h3>
                      <span className="stat-sub font-green">Verified Paid Stays</span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon blue"><i className="fa-solid fa-user-check"></i></div>
                    <div className="stat-info">
                      <span className="stat-label">Host Status</span>
                      <h3 className="stat-value font-gold">Verified</h3>
                      <span className="stat-sub">Superhost Badge Active</span>
                    </div>
                  </div>
                </div>

                {/* Quick Content Section */}
                <div className="overview-sections-grid">
                  {/* Recent Properties Preview */}
                  <div className="dashboard-card">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-city"></i> Your Top Properties</h3>
                      <button className="text-btn" onClick={() => setActiveTab('properties')}>View All ({properties.length})</button>
                    </div>

                    {properties.length === 0 ? (
                      <div className="empty-state">
                        <i className="fa-solid fa-house-chimney-medical"></i>
                        <p>No properties listed yet.</p>
                        <button className="btn-secondary-sm" onClick={() => setShowAddModal(true)}>Add Your First Villa</button>
                      </div>
                    ) : (
                      <div className="properties-preview-list">
                        {properties.slice(0, 3).map(prop => (
                          <div key={prop._id} className="preview-prop-item">
                            <div className="prop-thumb">
                              {prop.photos && prop.photos.length > 0 ? (
                                <img src={prop.photos[0]} alt={prop.name} />
                              ) : (
                                <div className="no-img"><i className="fa-solid fa-image"></i></div>
                              )}
                            </div>
                            <div className="prop-details">
                              <h4>{prop.name}</h4>
                              <p><i className="fa-solid fa-location-dot"></i> {prop.location} • <span className="type-tag">{prop.type}</span></p>
                              <span className="price-tag">₹{prop.price?.toLocaleString('en-IN')} / night</span>
                            </div>
                            <div className="prop-status">
                              <span className={`status-badge ${prop.status}`}>{prop.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Bookings Preview */}
                  <div className="dashboard-card">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-clock-rotate-left"></i> Recent Guest Bookings</h3>
                      <button className="text-btn" onClick={() => setActiveTab('bookings')}>Manage Bookings ({bookings.length})</button>
                    </div>

                    {bookings.length === 0 ? (
                      <div className="empty-state">
                        <i className="fa-solid fa-calendar-xmark"></i>
                        <p>No guest bookings received yet.</p>
                      </div>
                    ) : (
                      <div className="bookings-preview-list">
                        {bookings.slice(0, 4).map(b => (
                          <div key={b._id} className="preview-booking-item">
                            <div className="guest-avatar">
                              {b.user?.name ? b.user.name.charAt(0).toUpperCase() : 'G'}
                            </div>
                            <div className="booking-info">
                              <h4>{b.user?.name || 'Guest User'}</h4>
                              <p className="property-title">{b.property?.name || 'Mahabaleshwar Stay'}</p>
                              <span className="dates">
                                {new Date(b.checkIn).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(b.checkOut).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <div className="booking-right">
                              <span className="price">₹{b.totalPrice?.toLocaleString('en-IN')}</span>
                              <span className={`status-pill ${b.status}`}>{b.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MY PROPERTIES */}
            {activeTab === 'properties' && (
              <div className="tab-properties">
                {/* Filter & Search Bar */}
                <div className="portfolio-filter-bar">
                  <div className="search-box-wrap">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input 
                      type="text" 
                      placeholder="Search property by name or location..." 
                      value={propertySearchQuery}
                      onChange={(e) => setPropertySearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="type-filter-pills">
                    {['All', 'Villa', 'Hotel', 'Resort', 'Cabin'].map(t => (
                      <button 
                        key={t}
                        className={`filter-pill-btn ${propertyFilterType === t ? 'active' : ''}`}
                        onClick={() => setPropertyFilterType(t)}
                      >
                        {t === 'All' ? 'All Types' : t}
                      </button>
                    ))}
                  </div>
                </div>

                {properties.length === 0 ? (
                  <div className="empty-state-card glass-morphism">
                    <i className="fa-solid fa-tree-city"></i>
                    <h3>No Properties Listed Yet</h3>
                    <p>Start listing your Mahabaleshwar luxury villas, resorts, or cottages to receive bookings.</p>
                    <button className="btn-primary-gold" onClick={() => setShowAddModal(true)}>Add Property Now</button>
                  </div>
                ) : (
                  <div className="properties-grid">
                    {properties
                      .filter(p => {
                        const matchesType = propertyFilterType === 'All' || p.type === propertyFilterType;
                        const matchesQuery = !propertySearchQuery || 
                          p.name?.toLowerCase().includes(propertySearchQuery.toLowerCase()) || 
                          p.location?.toLowerCase().includes(propertySearchQuery.toLowerCase());
                        return matchesType && matchesQuery;
                      })
                      .map(prop => (
                        <div key={prop._id} className="property-card glass-morphism">
                          <div className="card-image-wrap">
                            {prop.photos && prop.photos.length > 0 ? (
                              <img src={prop.photos[0]} alt={prop.name} />
                            ) : (
                              <div className="image-placeholder">
                                <i className="fa-solid fa-image"></i> No Photos Uploaded
                              </div>
                            )}
                            <span className={`status-badge ${prop.status}`}>
                              <i className="fa-solid fa-circle"></i> {prop.status === 'approved' ? 'Approved & Live' : 'Pending Admin Approval'}
                            </span>
                            <span className="property-type-overlay">{prop.type}</span>
                          </div>

                          <div className="card-body">
                            <h3>{prop.name}</h3>
                            <p className="location">
                              <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-gold)' }}></i> {prop.location}
                            </p>

                            <div className="media-counts">
                              <span><i className="fa-solid fa-camera"></i> {prop.photos ? prop.photos.length : 0} Photos</span>
                              <span><i className="fa-solid fa-video"></i> {prop.videos ? prop.videos.length : 0} Videos</span>
                              {prop.mapLink && (
                                <span className="gps-active-tag"><i className="fa-solid fa-map-location-dot"></i> Live Map GPS</span>
                              )}
                            </div>

                            {prop.amenities && prop.amenities.length > 0 && (
                              <div className="card-amenities-tags">
                                {prop.amenities.slice(0, 3).map((am, i) => (
                                  <span key={i} className="amenity-mini-tag"><i className="fa-solid fa-circle-check"></i> {am}</span>
                                ))}
                                {prop.amenities.length > 3 && (
                                  <span className="amenity-mini-tag count">+{prop.amenities.length - 3} more</span>
                                )}
                              </div>
                            )}

                            <div className="price-row">
                              <div className="price-amount-group">
                                <span className="amount">₹{prop.price?.toLocaleString('en-IN')}</span>
                                <span className="per-night">/ night</span>
                              </div>
                            </div>

                            <div className="card-actions">
                              <a 
                                href={`http://localhost:5173/property/${prop._id}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn-view-live"
                                title="View on traveler site"
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square"></i> Preview
                              </a>
                              <button 
                                className="btn-edit" 
                                style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}
                                onClick={() => {
                                  setCaretakerForm(prev => ({
                                    ...prev,
                                    propertyId: prop._id,
                                    propertyName: prop.name
                                  }));
                                  setShowCaretakerModal(true);
                                }}
                                title="Apply for Caretaker for this property"
                              >
                                <i className="fa-solid fa-user-shield"></i> Caretaker
                              </button>
                              <button className="btn-edit" onClick={() => handleEditClick(prop)}>
                                <i className="fa-solid fa-pen-to-square"></i> Edit
                              </button>
                              <button className="btn-delete" onClick={() => handleDeleteProperty(prop._id)}>
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BOOKINGS */}
            {activeTab === 'bookings' && (
              <div className="tab-bookings">
                {/* Booking Filter Bar */}
                <div className="portfolio-filter-bar" style={{ marginBottom: '20px' }}>
                  <div className="type-filter-pills">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '6px' }}><i className="fa-solid fa-filter" style={{ color: 'var(--accent-gold)' }}></i> Filter Reservations:</span>
                    {['All', 'pending', 'confirmed', 'cancelled'].map(st => (
                      <button 
                        key={st}
                        className={`filter-pill-btn ${bookingFilterStatus === st ? 'active' : ''}`}
                        onClick={() => setBookingFilterStatus(st)}
                      >
                        {st === 'All' ? 'All Stays' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {bookings.length === 0 ? (
                  <div className="empty-state-card glass-morphism">
                    <i className="fa-solid fa-receipt"></i>
                    <h3>No Reservations Yet</h3>
                    <p>Bookings made by travelers for your listed properties will automatically show up here.</p>
                  </div>
                ) : (
                  <div className="table-responsive glass-morphism">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Guest Details</th>
                          <th>Property & Stay Type</th>
                          <th>Stay Dates</th>
                          <th>Total Revenue</th>
                          <th>Payment Status</th>
                          <th>Booking Status</th>
                          <th>Host Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings
                          .filter(b => bookingFilterStatus === 'All' || b.status === bookingFilterStatus)
                          .map(b => {
                            const checkInDate = new Date(b.checkIn);
                            const checkOutDate = new Date(b.checkOut);
                            const nights = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
                            return (
                              <tr key={b._id}>
                                <td>
                                  <div className="guest-cell">
                                    <div className="avatar-circle">
                                      {b.user?.name ? b.user.name.charAt(0).toUpperCase() : 'G'}
                                    </div>
                                    <div className="guest-info-text">
                                      <strong>{b.user?.name || 'Guest User'}</strong>
                                      <span className="email">{b.user?.email}</span>
                                      {b.user?.phone && <span className="phone"><i className="fa-solid fa-phone"></i> {b.user.phone}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="property-stay-cell">
                                    <strong>{b.property?.name || 'Mahabaleshwar Stay'}</strong>
                                    <span className="sub-location"><i className="fa-solid fa-location-dot"></i> {b.property?.location || 'Mahabaleshwar'}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="date-cell">
                                    <span className="date-range">
                                      <i className="fa-solid fa-calendar"></i> {checkInDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} → {checkOutDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="nights-badge">{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                                  </div>
                                </td>
                                <td>
                                  <strong className="price font-gold">₹{b.totalPrice?.toLocaleString('en-IN')}</strong>
                                </td>
                                <td>
                                  <span className={`payment-pill ${b.paymentStatus || 'paid'}`}>
                                    <i className="fa-solid fa-shield-check"></i> {b.paymentStatus || 'paid'}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-pill ${b.status}`}>
                                    {b.status === 'confirmed' && <i className="fa-solid fa-circle-check"></i>}
                                    {b.status === 'pending' && <i className="fa-solid fa-clock"></i>}
                                    {b.status === 'cancelled' && <i className="fa-solid fa-circle-xmark"></i>}
                                    {b.status}
                                  </span>
                                </td>
                                <td>
                                  <div className="action-buttons-group">
                                    {b.status !== 'confirmed' && (
                                      <button className="btn-action-confirm" onClick={() => handleUpdateBookingStatus(b._id, 'confirmed')}>
                                        <i className="fa-solid fa-check"></i> Confirm
                                      </button>
                                    )}
                                    {b.status !== 'cancelled' && (
                                      <button className="btn-action-cancel" onClick={() => handleUpdateBookingStatus(b._id, 'cancelled')}>
                                        <i className="fa-solid fa-xmark"></i> Cancel
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
            {/* TAB: CARETAKERS */}
            {activeTab === 'caretakers' && (
              <div className="tab-caretakers">
                <div className="dashboard-card glass-morphism" style={{ marginBottom: '24px', padding: '24px', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.3)', background: 'linear-gradient(135deg, rgba(27, 67, 50, 0.4) 0%, rgba(10, 20, 15, 0.6) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px 0', color: '#ffd700', fontSize: '1.4rem' }}>
                        <i className="fa-solid fa-user-shield" style={{ marginRight: '10px' }}></i> Property Caretaker Management
                      </h3>
                      <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.92rem', maxWidth: '700px' }}>
                        Apply for dedicated property caretakers to handle guest check-ins, key management, villa maintenance, housekeeping, and 24/7 security for your Mahabaleshwar stays.
                      </p>
                    </div>
                    <button 
                      className="btn-primary-gold" 
                      onClick={() => setShowCaretakerModal(true)}
                      style={{ padding: '12px 24px', borderRadius: '30px', fontWeight: '800' }}
                    >
                      <i className="fa-solid fa-plus"></i> Request Caretaker Assignment
                    </button>
                  </div>
                </div>

                {caretakerApps.length === 0 ? (
                  <div className="empty-state-card glass-morphism">
                    <i className="fa-solid fa-user-shield"></i>
                    <h3>No Caretaker Applications Submitted</h3>
                    <p>Apply for a dedicated property caretaker to manage check-ins, guest support, and property maintenance.</p>
                    <button className="btn-primary-gold" onClick={() => setShowCaretakerModal(true)}>Apply for Caretaker Now</button>
                  </div>
                ) : (
                  <div className="table-responsive glass-morphism" style={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Target Property</th>
                          <th>Contact Phone</th>
                          <th>Required Experience</th>
                          <th>Requested Services</th>
                          <th>Govt ID / Verification</th>
                          <th>Application Status</th>
                          <th>Applied Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caretakerApps.map((app) => (
                          <tr key={app._id}>
                            <td>
                              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{app.propertyName || 'All Managed Properties'}</strong>
                            </td>
                            <td>
                              <span style={{ color: '#52b788', fontWeight: '700' }}><i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i>{app.phone}</span>
                            </td>
                            <td>
                              <span style={{ color: '#38bdf8', fontWeight: '600' }}>{app.experience}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {Array.isArray(app.services) && app.services.map((svc, i) => (
                                  <span key={i} style={{ background: 'rgba(212, 175, 55, 0.15)', color: '#ffd700', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{svc}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{app.govtId || 'Provided'}</span>
                            </td>
                            <td>
                              <span className={`status-pill ${app.status}`} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                {app.status === 'pending' ? '🟡 Pending Approval' : app.status === 'approved' ? '🟢 Caretaker Assigned' : app.status}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{new Date(app.appliedAt).toLocaleDateString('en-IN')}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: ANALYTICS & FINANCIALS */}
            {activeTab === 'analytics' && (
              <div className="tab-analytics">

                <div className="analytics-summary-cards">
                  <div className="financial-card glass-morphism">
                    <div className="fin-icon gold"><i className="fa-solid fa-wallet"></i></div>
                    <h4>Total Gross Earnings</h4>
                    <h2>₹{totalRevenue.toLocaleString('en-IN')}</h2>
                    <p className="trend-up"><i className="fa-solid fa-arrow-trend-up"></i> +24% vs last month</p>
                  </div>

                  <div className="financial-card glass-morphism">
                    <div className="fin-icon emerald"><i className="fa-solid fa-chart-pie"></i></div>
                    <h4>Average Stay Value</h4>
                    <h2>₹{bookings.length > 0 ? Math.round(totalRevenue / bookings.length).toLocaleString('en-IN') : 0}</h2>
                    <p><i className="fa-solid fa-circle-check"></i> Based on {totalBookings} guest stays</p>
                  </div>

                  <div className="financial-card glass-morphism">
                    <div className="fin-icon blue"><i className="fa-solid fa-building-columns"></i></div>
                    <h4>Bank Payout Status</h4>
                    <h2>₹{totalRevenue.toLocaleString('en-IN')}</h2>
                    <p className="trend-up"><i className="fa-solid fa-shield-halved"></i> Direct Bank Transfer Active</p>
                  </div>
                </div>

                {/* Property-by-Property Financial Breakdown */}
                <div className="financial-breakdown-card glass-morphism">
                  <div className="breakdown-header">
                    <h3><i className="fa-solid fa-money-bill-trend-up" style={{ color: 'var(--accent-gold)' }}></i> Payout & Property Revenue Distribution</h3>
                    <span className="payout-status-badge"><i className="fa-solid fa-circle-check"></i> Auto-settlement active</span>
                  </div>

                  <div className="payout-list">
                    {properties.length === 0 ? (
                      <p className="no-data-text">No property revenue records available.</p>
                    ) : (
                      properties.map(p => {
                        const propBookings = bookings.filter(b => b.property?._id === p._id || b.property?.name === p.name);
                        const propRevenue = propBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                        const occupancy = Math.min(100, Math.round((propBookings.length / 5) * 100));
                        return (
                          <div key={p._id} className="payout-row-fancy">
                            <div className="payout-prop-thumb">
                              {p.photos && p.photos.length > 0 ? (
                                <img src={p.photos[0]} alt={p.name} />
                              ) : (
                                <div className="no-img"><i className="fa-solid fa-building"></i></div>
                              )}
                            </div>

                            <div className="payout-prop-info">
                              <h4>{p.name}</h4>
                              <p><i className="fa-solid fa-location-dot"></i> {p.location} • <span className="type-tag">{p.type}</span></p>
                              <div className="occupancy-bar-wrap">
                                <div className="occupancy-progress" style={{ width: `${occupancy || 20}%` }}></div>
                              </div>
                            </div>

                            <div className="payout-stats-group">
                              <div className="stat-unit">
                                <span className="label">Total Stays</span>
                                <span className="val">{propBookings.length} Bookings</span>
                              </div>
                              <div className="stat-unit">
                                <span className="label">Gross Earnings</span>
                                <span className="val gold">₹{propRevenue.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PROFILE */}
            {activeTab === 'profile' && (
              <div className="tab-profile">
                <div className="profile-card">
                  <h2>Host Profile Settings</h2>
                  <p>Manage your owner identity, contact details and stay policies displayed to travelers.</p>

                  <form onSubmit={handleProfileSubmit} className="profile-form">
                    <div className="form-group">
                      <label>Host Full Name</label>
                      <input 
                        type="text" 
                        value={profileForm.name} 
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label>Email Address (Account ID)</label>
                      <input type="email" value={user?.email || ''} disabled className="disabled-input" />
                    </div>

                    <div className="form-group">
                      <label>Phone Number for Guest Contacts</label>
                      <input 
                        type="tel" 
                        value={profileForm.phone} 
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} 
                        placeholder="+91 98765 43210" 
                      />
                    </div>

                    <div className="form-group">
                      <label>Host Bio / Welcome Message for Guests</label>
                      <textarea 
                        rows="4" 
                        value={profileForm.bio} 
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} 
                        placeholder="Tell guests about your hospitality, luxury amenities and local Mahabaleshwar recommendations..."
                      ></textarea>
                    </div>

                    <button type="submit" className="btn-primary-gold" disabled={profileSaving}>
                      {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ADD / EDIT PROPERTY MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProperty ? 'Edit Property Details' : 'Register New Property Listing'}</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>

            <form onSubmit={handleSaveProperty} className="modal-form">
              <div className="form-group">
                <label>Property Name *</label>
                <input 
                  type="text" 
                  value={propertyForm.name} 
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} 
                  placeholder="e.g. Royal Strawberry Heritage Villa" 
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Property Category</label>
                  <select 
                    value={propertyForm.type} 
                    onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                  >
                    <option value="Villa">Luxury Villa</option>
                    <option value="Hotel">Boutique Hotel</option>
                    <option value="Cabin">Private Cabin</option>
                    <option value="Resort">Nature Resort</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Price per Night (₹) *</label>
                  <input 
                    type="number" 
                    min="1"
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    value={propertyForm.price} 
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, Math.abs(parseInt(e.target.value) || 1));
                      setPropertyForm({ ...propertyForm, price: val });
                    }} 
                    placeholder="15000" 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Location / Area *</label>
                <input 
                  type="text" 
                  value={propertyForm.location} 
                  onChange={(e) => setPropertyForm({ ...propertyForm, location: e.target.value })} 
                  placeholder="e.g. Panchgani Road, Mahabaleshwar" 
                  required 
                />
              </div>

              <div className="form-group">
                <label><i className="fa-solid fa-map-location-dot" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Google Maps Live Location Link</label>
                <input 
                  type="url" 
                  value={propertyForm.mapLink || ''} 
                  onChange={(e) => setPropertyForm({ ...propertyForm, mapLink: e.target.value })} 
                  placeholder="e.g. https://maps.app.goo.gl/... or https://maps.google.com/?q=..." 
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  Paste exact Google Maps URL so guests can view live GPS pin & directions on the map.
                </small>
              </div>

              {/* Provided Stay Amenities & Resources Checklist */}
              <div className="form-group">
                <label>
                  <i className="fa-solid fa-list-check" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> 
                  Stay Amenities & Provided Resources ({propertyForm.amenities?.length || 0} Selected)
                </label>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '-4px', marginBottom: '10px' }}>
                  Select all resources & amenities provided at your stay for travelers:
                </p>

                <div className="amenities-selection-grid">
                  {PRESET_AMENITIES.map((item) => {
                    const isSelected = propertyForm.amenities?.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`amenity-chip-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleAmenity(item)}
                      >
                        <i className={`fa-solid ${isSelected ? 'fa-square-check' : 'fa-square'}`}></i>
                        {item}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Resource / Amenity Add Input */}
                <div className="custom-amenity-input-wrap">
                  <input
                    type="text"
                    placeholder="Add custom resource (e.g. Jacuzzi, Strawberry Farm Tour, Bonfire Gazebo)..."
                    value={customAmenityInput}
                    onChange={(e) => setCustomAmenityInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAmenity(e); } }}
                  />
                  <button type="button" className="btn-add-custom-amenity" onClick={handleAddCustomAmenity}>
                    <i className="fa-solid fa-plus"></i> Add Resource
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label><i className="fa-solid fa-camera" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Property Photos (Upload Directly)</label>
                <div className="direct-upload-area">
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handlePhotoFileUpload} 
                    id="property-direct-photos" 
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="property-direct-photos" className="upload-dropzone">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>Select Images from Computer / Mobile</span>
                    <small>Upload PNG, JPG, WEBP • Multiple images supported</small>
                  </label>
                </div>

                {Array.isArray(propertyForm.photos) && propertyForm.photos.length > 0 && (
                  <div className="uploaded-thumbnails-grid">
                    {propertyForm.photos.map((img, idx) => (
                      <div key={idx} className="thumb-item">
                        <img src={img} alt={`Upload ${idx + 1}`} />
                        <button 
                          type="button" 
                          className="btn-remove-photo" 
                          onClick={() => handleRemovePhoto(idx)}
                          title="Remove image"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label><i className="fa-solid fa-video" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Property HD Video Tours (Upload Directly from Device)</label>
                <div className="direct-upload-area">
                  <input 
                    type="file" 
                    accept="video/*" 
                    multiple 
                    onChange={handleVideoFileUpload} 
                    id="property-direct-videos" 
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="property-direct-videos" className="upload-dropzone">
                    <i className="fa-solid fa-film" style={{ color: 'var(--accent-gold)' }}></i>
                    <span>Select Video Files from Computer / Mobile</span>
                    <small>Upload MP4, WEBM, MOV • Multiple videos supported</small>
                  </label>
                </div>

                {Array.isArray(propertyForm.videos) && propertyForm.videos.length > 0 && (
                  <div className="uploaded-thumbnails-grid" style={{ marginTop: '12px' }}>
                    {propertyForm.videos.map((vid, idx) => (
                      <div key={idx} className="thumb-item" style={{ height: '90px' }}>
                        <video src={vid} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.75)', color: '#d4af37', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
                          <i className="fa-solid fa-circle-play"></i> Video #{idx + 1}
                        </span>
                        <button 
                          type="button" 
                          className="btn-remove-photo" 
                          onClick={() => handleRemoveVideo(idx)}
                          title="Remove video"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-gold">
                  {editingProperty ? 'Update Listing' : 'Submit Property Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARETAKER APPLICATION MODAL */}
      {showCaretakerModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-morphism" style={{ maxWidth: '620px', width: '100%', padding: '28px', borderRadius: '24px', background: 'linear-gradient(145deg, #1b262c 0%, #0f171e 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif' }}>
                  <i className="fa-solid fa-user-shield" style={{ marginRight: '8px' }}></i> Apply for Property Caretaker
                </h3>
                <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.85rem' }}>Request dedicated staff & caretaker services for your Mahabaleshwar stay</p>
              </div>
              <button onClick={() => setShowCaretakerModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleCaretakerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Select Property for Caretaker Assignment</label>
                <select 
                  value={caretakerForm.propertyName}
                  onChange={(e) => {
                    const selectedProp = properties.find(p => p.name === e.target.value);
                    setCaretakerForm({
                      ...caretakerForm,
                      propertyName: e.target.value,
                      propertyId: selectedProp ? selectedProp._id : ''
                    });
                  }}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                  required
                >
                  <option value="" style={{ background: '#1b262c', color: '#fff' }}>Select a Property...</option>
                  <option value="All Managed Stays" style={{ background: '#1b262c', color: '#fff' }}>All My Managed Properties</option>
                  {properties.map(p => (
                    <option key={p._id} value={p.name} style={{ background: '#1b262c', color: '#fff' }}>{p.name} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Host Contact Phone (10 Digits)</label>
                  <input 
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={caretakerForm.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setCaretakerForm({ ...caretakerForm, phone: val });
                    }}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                  />
                  {caretakerForm.phone && caretakerForm.phone.length > 0 && caretakerForm.phone.length !== 10 && (
                    <small style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Phone number must be exactly 10 digits ({caretakerForm.phone.length}/10)
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Caretaker Experience Required</label>
                  <select 
                    value={caretakerForm.experience}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, experience: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                  >
                    <option value="1-3 Years" style={{ background: '#1b262c', color: '#fff' }}>1 - 3 Years</option>
                    <option value="3-5 Years" style={{ background: '#1b262c', color: '#fff' }}>3 - 5 Years</option>
                    <option value="5+ Years" style={{ background: '#1b262c', color: '#fff' }}>5+ Years (Senior Villa Manager)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Govt Verification ID Type</label>
                  <select 
                    value={caretakerForm.govtIdType || 'Aadhaar Card'}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, govtIdType: e.target.value, govtId: '' })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                  >
                    <option value="Aadhaar Card" style={{ background: '#1b262c', color: '#fff' }}>Aadhaar Card (12 Digits)</option>
                    <option value="PAN Card" style={{ background: '#1b262c', color: '#fff' }}>PAN Card (10 Alphanumeric)</option>
                    <option value="Driving License" style={{ background: '#1b262c', color: '#fff' }}>Driving License</option>
                    <option value="Voter ID Card" style={{ background: '#1b262c', color: '#fff' }}>Voter ID Card</option>
                    <option value="Property License" style={{ background: '#1b262c', color: '#fff' }}>Property License / Utility Bill</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                    {caretakerForm.govtIdType === 'PAN Card' ? 'PAN Number (10 Chars)' : caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType ? 'Aadhaar Number (12 Digits)' : 'ID Number / License No.'}
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder={
                      caretakerForm.govtIdType === 'PAN Card' ? 'e.g. ABCDE1234F' :
                      caretakerForm.govtIdType === 'Driving License' ? 'e.g. MH1220230012345' :
                      caretakerForm.govtIdType === 'Voter ID Card' ? 'e.g. ABC1234567' :
                      caretakerForm.govtIdType === 'Property License' ? 'e.g. LIC-987654' :
                      'e.g. 123456789012'
                    }
                    maxLength={
                      caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType ? 12 :
                      caretakerForm.govtIdType === 'PAN Card' || caretakerForm.govtIdType === 'Voter ID Card' ? 10 : 16
                    }
                    value={caretakerForm.govtId}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType) {
                        val = val.replace(/\D/g, '').slice(0, 12);
                      } else {
                        val = val.toUpperCase().slice(0, 16);
                      }
                      setCaretakerForm({ ...caretakerForm, govtId: val });
                    }}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                  />
                  {(caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType) && caretakerForm.govtId && caretakerForm.govtId.length !== 12 && (
                    <small style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Aadhaar number must be exactly 12 digits ({caretakerForm.govtId.length}/12)
                    </small>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Special Instructions & Caretaker Notes</label>
                <textarea 
                  rows="3"
                  placeholder="Mention guest check-in preferences, key handling rules, maintenance needs, or special staff requirements..."
                  value={caretakerForm.bio}
                  onChange={(e) => setCaretakerForm({ ...caretakerForm, bio: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  disabled={submittingCaretaker}
                  style={{ flex: 1, padding: '14px 20px', borderRadius: '50px', background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)', color: '#1a1a1a', border: 'none', fontWeight: '800', fontSize: '1rem', cursor: submittingCaretaker ? 'not-allowed' : 'pointer' }}
                >
                  {submittingCaretaker ? 'Submitting Application...' : 'Submit Caretaker Application'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCaretakerModal(false)}
                  style={{ padding: '14px 22px', borderRadius: '50px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
