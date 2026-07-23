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
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    type: 'Villa',
    location: 'Mahabaleshwar',
    price: 15000,
    photos: '',
    videos: ''
  });

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    bio: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

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
    } catch (err) {
      console.error('Error fetching owner data:', err);
      setError('Failed to load dashboard data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
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
      price: parseInt(propertyForm.price) || 10000,
      photos: propertyForm.photos ? propertyForm.photos.split(',').map(s => s.trim()).filter(Boolean) : [],
      videos: propertyForm.videos ? propertyForm.videos.split(',').map(s => s.trim()).filter(Boolean) : []
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

      setActionSuccess(editingProperty ? 'Property details updated successfully!' : 'Property added successfully!');
      setShowAddModal(false);
      setEditingProperty(null);
      setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, photos: '', videos: '' });
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
      photos: prop.photos ? prop.photos.join(', ') : '',
      videos: prop.videos ? prop.videos.join(', ') : ''
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
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/status/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status: newStatus })
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
              {activeTab === 'overview' && 'Host Command Center'}
              {activeTab === 'properties' && 'Property Portfolio Management'}
              {activeTab === 'bookings' && 'Guest Reservations & Stays'}
              {activeTab === 'analytics' && 'Financial Analytics & Revenue'}
              {activeTab === 'profile' && 'Host Account Settings'}
            </h1>
            <p>Welcome back, <strong>{user?.name}</strong>! Track stay performance, guest check-ins & payouts.</p>
          </div>

          <div className="header-actions">
            <button className="btn-primary-gold" onClick={() => {
              setEditingProperty(null);
              setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, photos: '', videos: '' });
              setShowAddModal(true);
            }}>
              <i className="fa-solid fa-plus"></i> Add New Property
            </button>
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
                <div className="section-toolbar">
                  <h2>Property Listings ({properties.length})</h2>
                  <button className="btn-primary-gold" onClick={() => {
                    setEditingProperty(null);
                    setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, photos: '', videos: '' });
                    setShowAddModal(true);
                  }}>
                    <i className="fa-solid fa-plus"></i> Add Property
                  </button>
                </div>

                {properties.length === 0 ? (
                  <div className="empty-state-card">
                    <i className="fa-solid fa-tree-city"></i>
                    <h3>No Properties Found</h3>
                    <p>Start listing your Mahabaleshwar luxury villas, resorts, or cottages to receive bookings.</p>
                    <button className="btn-primary-gold" onClick={() => setShowAddModal(true)}>Add Property Now</button>
                  </div>
                ) : (
                  <div className="properties-grid">
                    {properties.map(prop => (
                      <div key={prop._id} className="property-card">
                        <div className="card-image-wrap">
                          {prop.photos && prop.photos.length > 0 ? (
                            <img src={prop.photos[0]} alt={prop.name} />
                          ) : (
                            <div className="image-placeholder">
                              <i className="fa-solid fa-image"></i> No Photos Uploaded
                            </div>
                          )}
                          <span className={`status-badge ${prop.status}`}>{prop.status}</span>
                          <span className="property-type-overlay">{prop.type}</span>
                        </div>

                        <div className="card-body">
                          <h3>{prop.name}</h3>
                          <p className="location"><i className="fa-solid fa-location-dot"></i> {prop.location}</p>

                          <div className="media-counts">
                            <span><i className="fa-solid fa-camera"></i> {prop.photos ? prop.photos.length : 0} Photos</span>
                            <span><i className="fa-solid fa-video"></i> {prop.videos ? prop.videos.length : 0} Videos</span>
                          </div>

                          <div className="price-row">
                            <span className="amount">₹{prop.price?.toLocaleString('en-IN')}</span>
                            <span className="per-night">/ night</span>
                          </div>

                          <div className="card-actions">
                            <button className="btn-edit" onClick={() => handleEditClick(prop)}>
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button className="btn-delete" onClick={() => handleDeleteProperty(prop._id)}>
                              <i className="fa-solid fa-trash-can"></i> Delete
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
                <div className="section-toolbar">
                  <h2>Guest Reservations ({bookings.length})</h2>
                </div>

                {bookings.length === 0 ? (
                  <div className="empty-state-card">
                    <i className="fa-solid fa-receipt"></i>
                    <h3>No Reservations Yet</h3>
                    <p>Bookings made by guests for your listed properties will appear here automatically.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Guest Details</th>
                          <th>Property Stay</th>
                          <th>Dates</th>
                          <th>Amount</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map(b => (
                          <tr key={b._id}>
                            <td>
                              <div className="guest-cell">
                                <strong>{b.user?.name || 'Guest'}</strong>
                                <span className="email">{b.user?.email}</span>
                                {b.user?.phone && <span className="phone"><i className="fa-solid fa-phone"></i> {b.user.phone}</span>}
                              </div>
                            </td>
                            <td>
                              <strong>{b.property?.name || 'Villa Stay'}</strong>
                              <span className="sub-location">{b.property?.location || 'Mahabaleshwar'}</span>
                            </td>
                            <td>
                              <div className="date-cell">
                                <span>In: {new Date(b.checkIn).toLocaleDateString('en-IN')}</span>
                                <span>Out: {new Date(b.checkOut).toLocaleDateString('en-IN')}</span>
                              </div>
                            </td>
                            <td>
                              <strong className="price font-gold">₹{b.totalPrice?.toLocaleString('en-IN')}</strong>
                            </td>
                            <td>
                              <span className={`payment-pill ${b.paymentStatus}`}>{b.paymentStatus}</span>
                            </td>
                            <td>
                              <span className={`status-pill ${b.status}`}>{b.status}</span>
                            </td>
                            <td>
                              <div className="action-dropdown">
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
                  <div className="financial-card">
                    <h4>Total Earnings Realized</h4>
                    <h2>₹{totalRevenue.toLocaleString('en-IN')}</h2>
                    <p><i className="fa-solid fa-shield-check"></i> Direct Bank Transfer Eligible</p>
                  </div>

                  <div className="financial-card">
                    <h4>Average Booking Value</h4>
                    <h2>₹{bookings.length > 0 ? Math.round(totalRevenue / bookings.length).toLocaleString('en-IN') : 0}</h2>
                    <p><i className="fa-solid fa-arrow-trend-up"></i> Based on {totalBookings} guest stays</p>
                  </div>

                  <div className="financial-card">
                    <h4>Pending Guest Payments</h4>
                    <h2>₹{bookings.filter(b => b.paymentStatus === 'pending').reduce((acc, b) => acc + (b.totalPrice || 0), 0).toLocaleString('en-IN')}</h2>
                    <p><i className="fa-solid fa-clock"></i> Unpaid or Check-in Pending</p>
                  </div>
                </div>

                <div className="financial-breakdown-card">
                  <h3>Payout & Property Revenue Distribution</h3>
                  <div className="payout-list">
                    {properties.map(p => {
                      const propBookings = bookings.filter(b => b.property?._id === p._id && b.paymentStatus === 'paid');
                      const propRevenue = propBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                      return (
                        <div key={p._id} className="payout-row">
                          <div className="payout-prop-info">
                            <strong>{p.name}</strong>
                            <span>{p.location} ({propBookings.length} paid stays)</span>
                          </div>
                          <div className="payout-prop-revenue">
                            <strong>₹{propRevenue.toLocaleString('en-IN')}</strong>
                          </div>
                        </div>
                      );
                    })}
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
                    value={propertyForm.price} 
                    onChange={(e) => setPropertyForm({ ...propertyForm, price: e.target.value })} 
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
                <label>Photo URLs (Comma-separated URLs)</label>
                <textarea 
                  rows="3" 
                  value={propertyForm.photos} 
                  onChange={(e) => setPropertyForm({ ...propertyForm, photos: e.target.value })} 
                  placeholder="https://images.unsplash.com/photo-1..., https://..."
                ></textarea>
              </div>

              <div className="form-group">
                <label>Video Tour URLs (Comma-separated URLs)</label>
                <input 
                  type="text" 
                  value={propertyForm.videos} 
                  onChange={(e) => setPropertyForm({ ...propertyForm, videos: e.target.value })} 
                  placeholder="https://assets.mixkit.co/..." 
                />
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
    </div>
  );
};

export default OwnerDashboard;
