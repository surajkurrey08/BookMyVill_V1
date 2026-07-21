import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './UserDashboard.css';
import bgImage from '../../assets/hillstationhome (1).jpg';
import { API_BASE_URL } from '../../config';

const UserDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('personal');
  const [activeReceiptBooking, setActiveReceiptBooking] = useState(null);
  const [caretakerApps, setCaretakerApps] = useState([]);
  const [showCaretakerModal, setShowCaretakerModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: ''
  });
  const [caretakerForm, setCaretakerForm] = useState({
    propertyName: '',
    phone: '',
    experience: '3+ Years',
    services: ['Guest Check-in', 'Maintenance', 'Housekeeping'],
    govtId: '',
    bio: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      navigate('/signin');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setProfileForm({
      name: parsedUser.name || '',
      email: parsedUser.email || '',
      phone: parsedUser.phone || '',
      bio: parsedUser.bio || 'Luxury Villa Host & Property Manager'
    });

    if (parsedUser.role === 'owner') {
      fetchOwnerProperties(token);
      fetchCaretakerApps(token);
    } else {
      fetchBookings('personal', token);
    }
  }, [navigate]);

  const handleAuthError = (resData, status) => {
    if (status === 401 || resData?.msg?.includes('token') || resData?.msg?.includes('authorization')) {
      alert('Session expired. Please sign in again.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/signin');
      return true;
    }
    return false;
  };

  const fetchCaretakerApps = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/my-applications`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok) {
        setCaretakerApps(data);
      } else {
        handleAuthError(data, res.status);
      }
    } catch (err) {
      console.error('Error fetching caretaker applications:', err);
    }
  };

  const fetchOwnerProperties = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/properties/my-properties`, {
        headers: { 'x-auth-token': token }
      });
      const data = await response.json();
      if (response.ok) {
        setProperties(data);
        if (data.length > 0) {
          setSelectedPropertyId(data[0]._id);
          fetchBookings(data[0]._id, token);
        } else {
          setSelectedPropertyId('personal');
          fetchBookings('personal', token);
        }
      } else {
        fetchBookings('personal', token);
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
      fetchBookings('personal', token);
    }
  };

  const fetchBookings = async (target, token) => {
    setLoading(true);
    const apiToken = token || localStorage.getItem('token');
    if (!apiToken) return;

    let url = `${API_BASE_URL}/api/bookings/my-bookings`;
    if (target !== 'personal') {
      url = `${API_BASE_URL}/api/bookings/property/${target}`;
    }

    try {
      const response = await fetch(url, {
        headers: { 'x-auth-token': apiToken }
      });
      const data = await response.json();
      if (response.ok) {
        setBookings(data);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/signin');
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/cancel/${bookingId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        alert('Booking cancelled successfully.');
        fetchBookings(selectedPropertyId, token);
      } else {
        alert(data.msg || 'Cancellation failed.');
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      alert('Network error. Please try again.');
    }
  };

  const handleCaretakerSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/caretaker/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(caretakerForm)
      });

      const data = await response.json();
      if (response.ok) {
        alert('Caretaker Application Submitted Successfully! Status: Certified Property Caretaker');
        setShowCaretakerModal(false);
        fetchCaretakerApps(token);
      } else {
        alert(data.msg || 'Application failed');
      }
    } catch (err) {
      alert('Network Error: Could not submit caretaker application');
    }
  };

  const validateProfileForm = (formData) => {
    const errors = {};
    if (!formData.name || formData.name.trim().length < 3) {
      errors.name = 'Full Name must be at least 3 characters.';
    }
    const digits = (formData.phone || '').replace(/\D/g, '');
    if (digits && (digits.length < 10 || digits.length > 12)) {
      errors.phone = 'Please enter a valid 10-digit phone number.';
    }
    if (formData.bio && formData.bio.length > 300) {
      errors.bio = 'Bio description cannot exceed 300 characters.';
    }
    return errors;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const errors = validateProfileForm(profileForm);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setIsSavingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
          bio: profileForm.bio.trim()
        })
      });

      const data = await response.json();
      if (response.ok) {
        const updatedUser = { ...user, name: data.name, phone: data.phone, bio: data.bio };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        alert('Profile details updated successfully!');
        setShowEditProfileModal(false);
      } else {
        alert(data.msg || 'Failed to update profile');
      }
    } catch (err) {
      alert('Network Error: Could not update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || 'Luxury Villa Host & Property Manager'
    });
    setProfileErrors({});
    setShowEditProfileModal(false);
  };

  const activeBookings = bookings.filter(
    (b) => b.status !== 'cancelled' && new Date(b.checkOut) >= new Date()
  );
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
  const bookingHistory = bookings.filter(
    (b) => b.status !== 'cancelled' && new Date(b.checkOut) < new Date()
  );

  const renderBookingList = (bookingsList, emptyMessage, isHistoryOrCancelled = false) => {
    if (bookingsList.length === 0) {
      return (
        <div className="compact-empty-state glass-morphism">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="bookings-list">
        {bookingsList.map((booking) => {
          const propertyImg = (booking.property?.photos && booking.property.photos.length > 0)
            ? (booking.property.photos[0].startsWith('http') || booking.property.photos[0].startsWith('data:') ? booking.property.photos[0] : "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800")
            : (booking.property?.image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80');
          
          return (
            <div key={booking._id} className="booking-list-item glass-morphism">
              <div className="booking-list-image">
                <img src={propertyImg} alt={booking.property?.name} />
                <div className={`booking-status-badge ${booking.status}`}>
                  {booking.status}
                </div>
              </div>
              
              <div className="booking-list-details">
                <div className="booking-list-header">
                  <h2>{booking.property?.name || 'Luxury Stay'}</h2>
                  <p className="location"><i className="fas fa-map-marker-alt"></i> {booking.property?.location || 'Mahabaleshwar'}</p>
                  {selectedPropertyId !== 'personal' && booking.user && (
                    <div className="guest-info">
                      <span className="guest-label">Guest:</span> {booking.user.name} ({booking.user.email})
                    </div>
                  )}
                </div>
                
                <div className="booking-list-dates">
                  <div className="date-item">
                    <span>Check In</span>
                    <strong>{new Date(booking.checkIn).toLocaleDateString()}</strong>
                  </div>
                  <div className="date-divider"></div>
                  <div className="date-item">
                    <span>Check Out</span>
                    <strong>{new Date(booking.checkOut).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>

              <div className="booking-list-right">
                <div className="total-price">
                  <span>Total Price</span>
                  <strong>₹{booking.totalPrice}</strong>
                </div>
                <div className="action-buttons">
                  <button 
                    className="view-details-btn"
                    onClick={() => setActiveReceiptBooking(booking)}
                  >
                    <i className="fa-solid fa-file-invoice" style={{ marginRight: '6px' }}></i>
                    View Receipt
                  </button>
                  {selectedPropertyId === 'personal' && !isHistoryOrCancelled && booking.status !== 'cancelled' && (
                    (() => {
                      const diffHours = Math.abs(new Date() - new Date(booking.createdAt)) / 36e5;
                      return diffHours <= 24 ? (
                        <button 
                          onClick={() => handleCancelBooking(booking._id)} 
                          className="cancel-booking-btn"
                        >
                          Cancel Stay
                        </button>
                      ) : (
                        <span className="policy-expired">Policy Expired</span>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <div className="loading">Loading your dashboard...</div>;

  return (
    <div className="user-dashboard">
      <div className="dashboard-bg">
        <img src={bgImage} alt="Background" />
        <div className="dashboard-overlay"></div>
      </div>
      
      <nav className="dashboard-nav">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <h3>
              {user?.name}
              {user?.role === 'owner' && <span className="owner-label">Owner</span>}
            </h3>
            {user?.role !== 'owner' && <p>{user?.email}</p>}
          </div>
        </div>
        <button 
          onDoubleClick={handleLogout} 
          className="logout-btn"
        >
          Logout
        </button>
      </nav>

      <div className="dashboard-content">
        <header className="content-header">
          <h1>Your Luxury Dashboard</h1>
          <p>Manage your bookings, view receipts, and track history</p>
        </header>

        {user?.role === 'owner' && (
          <div className="provider-profile-card glass-morphism" style={{
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '30px',
            marginBottom: '30px',
            border: '1px solid rgba(212, 175, 55, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="provider-avatar" style={{
                  width: '75px',
                  height: '75px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #d4af37 0%, #1b4332 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  boxShadow: '0 6px 20px rgba(212, 175, 55, 0.3)',
                  border: '2.5px solid #d4af37'
                }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: '#ffffff' }}>
                      {user?.name}
                    </h2>
                    <span className="owner-label" style={{ background: '#d4af37', color: '#1a1a1a', padding: '4px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.75rem' }}>
                      Verified Luxury Host
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.95rem' }}>
                    <i className="fa-solid fa-envelope" style={{ marginRight: '6px', color: '#d4af37' }}></i> {user?.email}
                  </p>

                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => setShowEditProfileModal(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        padding: '6px 16px',
                        borderRadius: '30px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-user-pen"></i> Edit Profile
                    </button>
                    {caretakerApps.length > 0 ? (
                      <span style={{
                        background: 'rgba(82, 183, 136, 0.2)',
                        color: '#52b788',
                        border: '1px solid #52b788',
                        padding: '5px 14px',
                        borderRadius: '30px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <i className="fa-solid fa-shield-check"></i> Certified Property Caretaker
                      </span>
                    ) : (
                      <button 
                        onClick={() => setShowCaretakerModal(true)}
                        style={{
                          background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)',
                          color: '#1a1a1a',
                          border: 'none',
                          padding: '7px 18px',
                          borderRadius: '30px',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-user-gear"></i> Apply as Property Caretaker
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '25px', background: 'rgba(255, 255, 255, 0.05)', padding: '15px 25px', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '1px' }}>Listed Stays</span>
                  <strong style={{ fontSize: '1.5rem', color: '#d4af37' }}>{properties.length}</strong>
                </div>
                <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '1px' }}>Total Bookings</span>
                  <strong style={{ fontSize: '1.5rem', color: '#52b788' }}>{bookings.length}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'owner' && (
          <div className="property-selector-container glass-morphism">
            <span className="property-selector-label">
              <i className="fas fa-hotel"></i> Dashboard Mode:
            </span>
            <select
              value={selectedPropertyId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPropertyId(val);
                fetchBookings(val);
              }}
              className="property-dropdown"
            >
              <option value="personal">My Personal Bookings</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>
                  Manage: {p.name}
                </option>
              ))}
            </select>

            <Link 
              to="/register-property" 
              className="btn-primary"
              style={{
                padding: '8px 20px',
                borderRadius: '50px',
                background: '#d4af37',
                color: '#1a1a1a',
                fontWeight: '700',
                textDecoration: 'none',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Add New Property
            </Link>
          </div>
        )}

        <div className="dashboard-tabs-nav">
          <a href="#active" className="tab-nav-link">
            <i className="fa-solid fa-calendar-check nav-icon"></i>
            Active Bookings ({activeBookings.length})
          </a>
          <a href="#history" className="tab-nav-link">
            <i className="fa-solid fa-clock-rotate-left nav-icon"></i>
            Booking History ({bookingHistory.length})
          </a>
          <a href="#cancelled" className="tab-nav-link">
            <i className="fa-solid fa-ban nav-icon"></i>
            Cancelled ({cancelledBookings.length})
          </a>
        </div>

        <section id="active" className="dashboard-section">
          <div className="section-title-container">
            <h2>Active Bookings</h2>
            <span className="section-badge active-badge">{activeBookings.length} Active</span>
          </div>
          {renderBookingList(activeBookings, "No active bookings found. Ready for your next getaway?", false)}
        </section>

        <section id="history" className="dashboard-section">
          <div className="section-title-container">
            <h2>Booking History</h2>
            <span className="section-badge history-badge">{bookingHistory.length} Past</span>
          </div>
          {renderBookingList(bookingHistory, "No past booking history available.", true)}
        </section>

        <section id="cancelled" className="dashboard-section">
          <div className="section-title-container">
            <h2>Cancelled Stays</h2>
            <span className="section-badge cancelled-badge">{cancelledBookings.length} Cancelled</span>
          </div>
          {renderBookingList(cancelledBookings, "No cancelled bookings.", true)}
        </section>
      </div>

      {/* Printable Luxury Booking Receipt Modal */}
      {activeReceiptBooking && (
        <div className="receipt-modal-overlay">
          <div className="receipt-modal-card">
            <div className="receipt-modal-header">
              <h2>Mahabaleshwar Luxury Stays</h2>
              <button onClick={() => setActiveReceiptBooking(null)} className="receipt-close-btn">×</button>
            </div>
            <div className="receipt-modal-body">
              <div className="receipt-number-badge">
                <span>Official Booking Receipt</span>
                <strong>#MS-REC-{String(activeReceiptBooking._id).slice(-6).toUpperCase()}</strong>
              </div>

              <div className="receipt-details-grid">
                <div className="receipt-detail-item">
                  <label>Property</label>
                  <strong>{activeReceiptBooking.property?.name || 'Luxury Stay'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Location</label>
                  <strong>{activeReceiptBooking.property?.location || 'Mahabaleshwar'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Guest Name</label>
                  <strong>{activeReceiptBooking.user?.name || user?.name || 'Guest User'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Guest Email</label>
                  <strong>{activeReceiptBooking.user?.email || user?.email || 'guest@example.com'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Check In</label>
                  <strong>{new Date(activeReceiptBooking.checkIn).toLocaleDateString()}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Check Out</label>
                  <strong>{new Date(activeReceiptBooking.checkOut).toLocaleDateString()}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Booking Status</label>
                  <strong style={{ color: '#2d6a4f', textTransform: 'capitalize' }}>
                    {activeReceiptBooking.status} ({activeReceiptBooking.paymentStatus || 'paid'})
                  </strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Transaction ID</label>
                  <strong>{activeReceiptBooking.razorpayOrderId || `TXN_${String(activeReceiptBooking._id).slice(-8)}`}</strong>
                </div>
              </div>

              <div className="receipt-amount-box">
                <span>Total Paid Amount</span>
                <strong>₹{activeReceiptBooking.totalPrice}</strong>
              </div>

              <div className="receipt-actions">
                <button onClick={() => window.print()} className="print-receipt-btn">
                  <i className="fa-solid fa-print"></i> Print / Download Receipt
                </button>
                <button 
                  onClick={() => setActiveReceiptBooking(null)} 
                  className="btn-outline" 
                  style={{ borderRadius: '12px', padding: '12px 20px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Caretaker Application Modal */}
      {showCaretakerModal && (
        <div className="view-all-modal-overlay">
          <div className="view-all-modal-content" style={{ maxWidth: '650px', padding: '30px' }}>
            <div className="view-all-modal-header">
              <div>
                <h2>Apply for Property Caretaker Role</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.9rem' }}>Manage & caretake luxury properties on Mahabaleshwar Stays</p>
              </div>
              <button onClick={() => setShowCaretakerModal(false)} className="modal-close-btn">×</button>
            </div>

            <form onSubmit={handleCaretakerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Select Property to Caretake</label>
                <select 
                  value={caretakerForm.propertyName} 
                  onChange={(e) => setCaretakerForm({ ...caretakerForm, propertyName: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  required
                >
                  <option value="">Choose a Property...</option>
                  <option value="All Managed Stays">All My Managed Stays</option>
                  {properties.map(p => (
                    <option key={p._id} value={p.name}>{p.name} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Contact Phone Number</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="+91 9876543210"
                    value={caretakerForm.phone}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Experience Years</label>
                  <select 
                    value={caretakerForm.experience}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, experience: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  >
                    <option value="1-3 Years">1 - 3 Years</option>
                    <option value="3-5 Years">3 - 5 Years</option>
                    <option value="5+ Years">5+ Years (Senior Caretaker)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Government ID / License No.</label>
                <input 
                  type="text" 
                  placeholder="Aadhaar / Driving License / PAN No."
                  value={caretakerForm.govtId}
                  onChange={(e) => setCaretakerForm({ ...caretakerForm, govtId: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Caretaker Proposal / Bio Statement</label>
                <textarea 
                  rows="3"
                  placeholder="Describe your caretaking services, availability, and property maintenance experience..."
                  value={caretakerForm.bio}
                  onChange={(e) => setCaretakerForm({ ...caretakerForm, bio: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem', fontFamily: 'inherit' }}
                  required
                ></textarea>
              </div>

              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '14px', borderRadius: '50px', fontSize: '1rem', fontWeight: '700', border: 'none', cursor: 'pointer', marginTop: '10px' }}
              >
                Submit Caretaker Application
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Provider Profile Modal */}
      {showEditProfileModal && (
        <div className="view-all-modal-overlay">
          <div className="view-all-modal-content" style={{ maxWidth: '580px', padding: '32px', borderRadius: '24px' }}>
            <div className="view-all-modal-header" style={{ borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #d4af37 0%, #1b4332 100%)',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
                }}>
                  {profileForm.name ? profileForm.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1a1a1a' }}>Edit User Profile</h2>
                  <p style={{ margin: '3px 0 0 0', color: '#666', fontSize: '0.88rem' }}>Update your personal host details & contact info</p>
                </div>
              </div>
              <button onClick={handleCancelProfileEdit} className="modal-close-btn" aria-label="Close Profile Modal">×</button>
            </div>

            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '20px' }}>
              {/* Host Name Field */}
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a', fontSize: '0.92rem' }}>
                  <span><i className="fa-solid fa-user" style={{ color: '#d4af37', marginRight: '6px' }}></i> Full Name</span>
                  {profileErrors.name && <span style={{ color: '#d62828', fontSize: '0.8rem', fontWeight: '600' }}>{profileErrors.name}</span>}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter your full name"
                  value={profileForm.name}
                  onChange={(e) => {
                    setProfileForm({ ...profileForm, name: e.target.value });
                    if (profileErrors.name) setProfileErrors({ ...profileErrors, name: null });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${profileErrors.name ? '#d62828' : '#ccc'}`,
                    fontSize: '0.95rem',
                    color: '#1a1a1a',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
              </div>

              {/* Email Address Field */}
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a', fontSize: '0.92rem' }}>
                  <i className="fa-solid fa-envelope" style={{ color: '#d4af37', marginRight: '6px' }}></i> Email Address (Read-only)
                </label>
                <input 
                  type="email" 
                  disabled
                  value={profileForm.email}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                    background: '#f8f9fa',
                    color: '#6c757d',
                    fontSize: '0.95rem',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Phone Number Field */}
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a', fontSize: '0.92rem' }}>
                  <span><i className="fa-solid fa-phone" style={{ color: '#d4af37', marginRight: '6px' }}></i> Contact Phone Number</span>
                  {profileErrors.phone && <span style={{ color: '#d62828', fontSize: '0.8rem', fontWeight: '600' }}>{profileErrors.phone}</span>}
                </label>
                <input 
                  type="tel" 
                  placeholder="+91 9876543210"
                  value={profileForm.phone}
                  onChange={(e) => {
                    setProfileForm({ ...profileForm, phone: e.target.value });
                    if (profileErrors.phone) setProfileErrors({ ...profileErrors, phone: null });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${profileErrors.phone ? '#d62828' : '#ccc'}`,
                    fontSize: '0.95rem',
                    color: '#1a1a1a',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
              </div>

              {/* Bio Field */}
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a', fontSize: '0.92rem' }}>
                  <span><i className="fa-solid fa-align-left" style={{ color: '#d4af37', marginRight: '6px' }}></i> Host Bio / Description</span>
                  <span style={{ fontSize: '0.78rem', color: profileForm.bio?.length > 300 ? '#d62828' : '#888' }}>
                    {profileForm.bio?.length || 0}/300
                  </span>
                </label>
                <textarea 
                  rows="3"
                  placeholder="Tell guests about your hospitality experience and managed stays..."
                  value={profileForm.bio}
                  onChange={(e) => {
                    setProfileForm({ ...profileForm, bio: e.target.value });
                    if (profileErrors.bio) setProfileErrors({ ...profileErrors, bio: null });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${profileErrors.bio ? '#d62828' : '#ccc'}`,
                    fontSize: '0.95rem',
                    color: '#1a1a1a',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                ></textarea>
                {profileErrors.bio && <span style={{ color: '#d62828', fontSize: '0.8rem', fontWeight: '600', marginTop: '4px', display: 'block' }}>{profileErrors.bio}</span>}
              </div>

              {/* Accessible Action Buttons */}
              <div style={{ display: 'flex', gap: '14px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={handleCancelProfileEdit}
                  style={{
                    background: 'transparent',
                    color: '#495057',
                    border: '1.5px solid #ced4da',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingProfile}
                  style={{
                    background: isSavingProfile ? '#cccccc' : 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)',
                    color: '#1a1a1a',
                    border: 'none',
                    padding: '12px 28px',
                    borderRadius: '50px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    cursor: isSavingProfile ? 'not-allowed' : 'pointer',
                    boxShadow: isSavingProfile ? 'none' : '0 4px 15px rgba(212, 175, 55, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <i className="fa-solid fa-check"></i> {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
