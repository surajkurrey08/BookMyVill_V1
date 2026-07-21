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

    if (parsedUser.role === 'owner') {
      fetchOwnerProperties(token);
    } else {
      fetchBookings('personal', token);
    }
  }, [navigate]);

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
        <button onClick={handleLogout} className="logout-btn">Logout</button>
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
    </div>
  );
};

export default UserDashboard;
