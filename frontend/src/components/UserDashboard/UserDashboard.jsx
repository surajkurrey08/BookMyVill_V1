import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
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
  const [caretakerFormError, setCaretakerFormError] = useState('');
  const [caretakerFormSuccess, setCaretakerFormSuccess] = useState('');
  const [profileFormError, setProfileFormError] = useState('');
  const [profileFormSuccess, setProfileFormSuccess] = useState('');
  const [bookingNotice, setBookingNotice] = useState('');
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
    const userData = sessionStorage.getItem('user') || localStorage.getItem('user');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

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

    if (window.location.pathname === '/profile' || window.location.search.includes('edit=true')) {
      setShowEditProfileModal(true);
    }
  }, [navigate]);

  const handleAuthError = (resData, status) => {
    if (status === 401 || resData?.msg?.includes('token') || resData?.msg?.includes('authorization')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
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
    const apiToken = token || sessionStorage.getItem('token') || localStorage.getItem('token');
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
    const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
    let isOwner = false;
    if (userStr) {
      try {
        isOwner = JSON.parse(userStr).role === 'owner';
      } catch (err) {
        console.warn('User JSON parse error:', err);
      }
    }
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (isOwner) {
      window.location.href = 'http://localhost:5175/login';
    } else {
      navigate('/signin');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
        setBookingNotice('Booking cancelled successfully.');
        setTimeout(() => setBookingNotice(''), 4000);
        fetchBookings(selectedPropertyId, token);
      } else {
        setBookingNotice(data.msg || 'Cancellation failed.');
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      setBookingNotice('Network error. Please try again.');
    }
  };

  const handleCaretakerSubmit = async (e) => {
    e.preventDefault();
    setCaretakerFormError('');
    setCaretakerFormSuccess('');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return;

    // Strict 10-digit Indian Mobile Validation
    const cleanPhone = (caretakerForm.phone || '').trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setCaretakerFormError('Contact Phone Number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    // Govt ID Validation based on type
    const govtType = caretakerForm.govtIdType || 'Aadhaar Card';
    const cleanGovtId = (caretakerForm.govtId || '').trim();

    if (!cleanGovtId) {
      setCaretakerFormError(`${govtType} number/details are required.`);
      return;
    }

    if (govtType === 'Aadhaar Card') {
      const cleanAadhaar = cleanGovtId.replace(/\D/g, '');
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setCaretakerFormError('Aadhaar Card number must be exactly 12 digits (e.g. 123456789012).');
        return;
      }
    } else if (govtType === 'PAN Card') {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanGovtId.toUpperCase())) {
        setCaretakerFormError('PAN Card must be 10 characters formatted as 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).');
        return;
      }
    } else if (govtType === 'Driving License') {
      if (!/^[A-Z0-9]{10,16}$/i.test(cleanGovtId)) {
        setCaretakerFormError('Driving License number must be 10 to 16 alphanumeric characters (e.g. MH1220230012345).');
        return;
      }
    } else if (govtType === 'Voter ID Card') {
      if (!/^[A-Z]{3}[0-9]{7}$/i.test(cleanGovtId)) {
        setCaretakerFormError('Voter ID Card format must be 3 letters followed by 7 digits (e.g. ABC1234567).');
        return;
      }
    }

    try {
      const payload = {
        ...caretakerForm,
        phone: cleanPhone,
        govtId: `${govtType}: ${cleanGovtId.toUpperCase()}`
      };

      const response = await fetch(`${API_BASE_URL}/api/caretaker/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setCaretakerFormSuccess('Caretaker Application Submitted Successfully! Status: Certified Property Caretaker');
        setTimeout(() => {
          setCaretakerFormSuccess('');
          setShowCaretakerModal(false);
        }, 2500);
        setCaretakerForm({
          propertyName: '',
          phone: '',
          experience: '3+ Years',
          services: ['Guest Check-in', 'Maintenance', 'Housekeeping'],
          govtIdType: 'Aadhaar Card',
          govtId: '',
          bio: ''
        });
        fetchCaretakerApps(token);
      } else {
        setCaretakerFormError(data.msg || 'Application failed');
      }
    } catch (err) {
      setCaretakerFormError('Network Error: Could not submit caretaker application');
    }
  };

  const validateProfileForm = (formData) => {
    const errors = {};
    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      errors.name = 'Full Name is required.';
    } else if (trimmedName.length < 3) {
      errors.name = 'Full Name must be at least 3 characters.';
    } else if (trimmedName.length > 50) {
      errors.name = 'Full Name cannot exceed 50 characters.';
    } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
      errors.name = 'Full Name can only contain letters and spaces.';
    }

    const cleanPhone = (formData.phone || '').replace(/[\s-]/g, '');
    if (!cleanPhone) {
      errors.phone = 'Phone Number is required.';
    } else if (!/^\+?[0-9]{10,12}$/.test(cleanPhone)) {
      errors.phone = 'Please enter a valid 10 to 12 digit phone number.';
    }

    const trimmedBio = (formData.bio || '').trim();
    if (!trimmedBio) {
      errors.bio = 'Bio / Host Description is required.';
    } else if (trimmedBio.length < 10) {
      errors.bio = 'Bio must be at least 10 characters long.';
    } else if (trimmedBio.length > 300) {
      errors.bio = 'Bio cannot exceed 300 characters.';
    }

    return errors;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileFormError('');
    setProfileFormSuccess('');
    const errors = validateProfileForm(profileForm);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        setProfileFormSuccess('Profile details updated successfully!');
        setTimeout(() => {
          setProfileFormSuccess('');
          setShowEditProfileModal(false);
        }, 2000);
      } else {
        setProfileFormError(data.msg || 'Failed to update profile');
      }
    } catch (err) {
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

  const handleDownloadReceiptFile = (booking) => {
    if (!booking) return;

    const receiptId = String(booking._id).slice(-6).toUpperCase();
    const propertyName = booking.property?.name || 'Luxury Stay';
    const location = booking.property?.location || 'Mahabaleshwar';
    const guestName = booking.user?.name || user?.name || 'Guest User';
    const guestEmail = booking.user?.email || user?.email || 'guest@example.com';
    const checkIn = new Date(booking.checkIn).toLocaleDateString();
    const checkOut = new Date(booking.checkOut).toLocaleDateString();
    const totalPrice = booking.totalPrice;
    const status = booking.status;
    const paymentStatus = booking.paymentStatus || 'paid';
    const txnId = booking.razorpayOrderId || `TXN_${String(booking._id).slice(-8)}`;
    const hostEmail = booking.property?.owner?.email || booking.property?.ownerEmail || 'propertysangli@gmail.com';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${receiptId} - Mahabaleshwar Luxury Stays</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1a1a1a; background: #ffffff; }
    .container { max-width: 650px; margin: 0 auto; border: 2px solid #1b4332; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%); color: #ffffff; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #ffd700; font-size: 24px; letter-spacing: 1px; }
    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
    .badge { display: inline-block; background: #e8f5e9; color: #1b4332; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .item label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
    .item strong { font-size: 15px; color: #0f172a; }
    .price-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
    .price-box span { font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold; }
    .price-box strong { font-size: 28px; color: #2d6a4f; display: block; margin-top: 4px; }
    .support-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; font-size: 13px; color: #166534; margin-bottom: 20px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px dashed #cbd5e1; paddingTop: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Mahabaleshwar Luxury Stays</h1>
      <p>Official Stay Reservation Receipt</p>
    </div>
    <div style="text-align: center;">
      <span class="badge">Receipt #${receiptId}</span>
    </div>
    <div class="grid">
      <div class="item"><label>Property Name</label><strong>${propertyName}</strong></div>
      <div class="item"><label>City Location</label><strong>${location}</strong></div>
      <div class="item"><label>Guest Name</label><strong>${guestName}</strong></div>
      <div class="item"><label>Guest Email</label><strong>${guestEmail}</strong></div>
      <div class="item"><label>Check In</label><strong>${checkIn} (12:00 PM)</strong></div>
      <div class="item"><label>Check Out</label><strong>${checkOut} (11:00 AM)</strong></div>
      <div class="item"><label>Booking Status</label><strong>${status.toUpperCase()} (${paymentStatus})</strong></div>
      <div class="item"><label>Transaction ID</label><strong>${txnId}</strong></div>
    </div>
    <div class="price-box">
      <span>Total Paid Amount</span>
      <strong>₹${totalPrice}</strong>
    </div>
    <div class="support-box">
      <strong>Property Host Contact:</strong> ${hostEmail}<br>
      <strong>24/7 Helpline:</strong> +91 1800-266-STAY | support@mahabaleshwarstays.com<br>
      <em>For any stay assistance, modifications, or emergency queries, contact your host or helpline above.</em>
    </div>
    <div class="footer">
      Official Receipt generated by Mahabaleshwar Luxury Stays. Wish you a wonderful stay!
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Booking_Receipt_${receiptId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              {/* COL 1: PROPERTY THUMBNAIL & STATUS BADGE */}
              <div className="booking-list-image">
                <img src={propertyImg} alt={booking.property?.name} />
                <div className={`booking-status-badge ${booking.status}`}>
                  {booking.status}
                </div>
                <div className="booking-type-badge">
                  {booking.property?.type || 'Luxury Stay'}
                </div>
              </div>
              
              {/* COL 2: MAIN DETAILS, HOST HELPLINE, DATES & REFUND */}
              <div className="booking-list-details">
                <div className="booking-list-header">
                  <h2>{booking.property?.name || 'Luxury Stay'}</h2>
                  <p className="location"><i className="fas fa-map-marker-alt"></i> {booking.property?.location || 'Mahabaleshwar'}</p>
                </div>

                {/* HOST CONTACT & SUPPORT DESK CARD BADGE */}
                <div className="host-contact-card-badge">
                  <span><i className="fa-solid fa-user-shield"></i> Host: <strong>{booking.property?.owner?.email || booking.property?.ownerEmail || 'propertysangli@gmail.com'}</strong></span>
                  <span className="helpline-text"><i className="fa-solid fa-headset"></i> Helpline: +91 1800-266-STAY</span>
                </div>

                {/* CHECK-IN & CHECK-OUT DATES */}
                <div className="booking-list-dates">
                  <div className="date-item">
                    <span>CHECK IN (12:00 PM)</span>
                    <strong>{new Date(booking.checkIn).toLocaleDateString()}</strong>
                  </div>
                  <div className="date-divider"></div>
                  <div className="date-item">
                    <span>CHECK OUT (11:00 AM)</span>
                    <strong>{new Date(booking.checkOut).toLocaleDateString()}</strong>
                  </div>
                </div>

                {/* CANCELLATION & REFUND BADGES */}
                {booking.status === 'cancelled' && (
                  <div className="cancellation-status-stack">
                    <div className="cancel-reason-badge">
                      <i className="fa-solid fa-circle-info"></i>
                      <span>Reason: {booking.actionHistory && booking.actionHistory.length > 0 ? (booking.actionHistory[booking.actionHistory.length - 1].reason || 'Booking cancelled') : 'Cancelled by host/user'}</span>
                    </div>
                    {booking.paymentStatus === 'paid' && (
                      <div className="refund-info-badge">
                        <i className="fa-solid fa-rotate-left"></i>
                        <span>Refund Initiated: ₹{booking.refundAmount || booking.totalPrice} to original source (3-5 days)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* COL 3: PRICE SUMMARY & FULL-WIDTH ACTION BUTTONS */}
              <div className="booking-list-right">
                <div className="total-price-box">
                  <span className="price-label">TOTAL STAY PRICE</span>
                  <strong className="price-amount">₹{booking.totalPrice}</strong>
                  <span className="payment-tag">{booking.paymentStatus === 'paid' ? 'PAID ✅' : 'PENDING 🟡'}</span>
                </div>

                <div className="action-buttons-stack">
                  <button 
                    className="view-details-btn download-btn"
                    onClick={() => setActiveReceiptBooking(booking)}
                  >
                    <i className="fa-solid fa-file-pdf"></i>
                    Download / View Receipt
                  </button>
                  <button 
                    className="view-details-btn print-btn"
                    onClick={() => {
                      setActiveReceiptBooking(booking);
                      setTimeout(() => window.print(), 350);
                    }}
                  >
                    <i className="fa-solid fa-print"></i>
                    Print Receipt
                  </button>
                  {selectedPropertyId === 'personal' && !isHistoryOrCancelled && booking.status !== 'cancelled' && (
                    (() => {
                      const diffHours = Math.abs(new Date() - new Date(booking.createdAt)) / 36e5;
                      return diffHours <= 24 ? (
                        <button 
                          onClick={() => handleCancelBooking(booking._id)} 
                          className="cancel-booking-btn"
                        >
                          <i className="fa-solid fa-ban"></i> Cancel Stay
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

  return (
    <div className="user-dashboard">
      <Navbar />

      <div className="dashboard-bg">
        <img src={bgImage} alt="Background" />
        <div className="dashboard-overlay"></div>
      </div>
      
      <div className="dashboard-content" style={{ paddingTop: '100px' }}>
        <header className="content-header">
          <h1>Your Luxury Dashboard</h1>
          <p>Manage your bookings, view receipts, and track history</p>
        </header>

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
                  <label>Property Name</label>
                  <strong>{activeReceiptBooking.property?.name || 'Luxury Stay'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Property Category</label>
                  <strong>{activeReceiptBooking.property?.type || 'Villa Estate'}</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>City Location</label>
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
                  <label>Stay Duration</label>
                  <strong>
                    {Math.max(1, Math.round((new Date(activeReceiptBooking.checkOut) - new Date(activeReceiptBooking.checkIn)) / (1000 * 60 * 60 * 24)))} Night(s)
                  </strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Check In Time</label>
                  <strong>{new Date(activeReceiptBooking.checkIn).toLocaleDateString()} (12:00 PM)</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Check Out Time</label>
                  <strong>{new Date(activeReceiptBooking.checkOut).toLocaleDateString()} (11:00 AM)</strong>
                </div>
                <div className="receipt-detail-item">
                  <label>Booking Status</label>
                  <strong style={{ color: activeReceiptBooking.status === 'confirmed' ? '#2d6a4f' : activeReceiptBooking.status === 'cancelled' ? '#d62828' : '#d4af37', textTransform: 'capitalize' }}>
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

              {/* PROPERTY OWNER & HELP SUPPORT HANDLER SECTION */}
              <div className="receipt-support-section" style={{ marginTop: '20px', padding: '16px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-headset" style={{ color: '#d4af37' }}></i> Host Contact & Support Handler
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Property Host</span>
                    <strong style={{ color: '#1e293b' }}>{activeReceiptBooking.property?.owner?.name || activeReceiptBooking.property?.ownerEmail || 'Mahabaleshwar Hospitality Host'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Host Contact Email</span>
                    <strong style={{ color: '#0284c7' }}>{activeReceiptBooking.property?.owner?.email || activeReceiptBooking.property?.ownerEmail || 'propertysangli@gmail.com'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>24/7 Helpline</span>
                    <strong style={{ color: '#16a34a' }}>+91 1800-266-STAY</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Support Desk</span>
                    <strong style={{ color: '#475569' }}>support@mahabaleshwarstays.com</strong>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                  <i className="fa-solid fa-circle-question" style={{ color: '#d4af37', marginRight: '4px' }}></i> Have questions or stay issues? Contact your property host or emergency helpline above.
                </div>
              </div>

              {/* PAYMENT REFUND DETAILS BOX */}
              {activeReceiptBooking.status === 'cancelled' && (
                <div className="receipt-refund-box" style={{ marginTop: '20px', padding: '16px 20px', background: '#f0fdf4', borderRadius: '14px', border: '1px solid #bbf7d0', textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-arrow-rotate-left"></i> Payment Refund & Settlement
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#166534', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Refund Status</span>
                      <strong style={{ color: '#16a34a' }}>{activeReceiptBooking.refundStatus === 'initiated' ? 'Initiated (Processing)' : 'Initiated'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#166534', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Refund Amount</span>
                      <strong style={{ color: '#15803d' }}>₹{activeReceiptBooking.refundAmount || activeReceiptBooking.totalPrice}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#166534', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Refund Destination</span>
                      <strong style={{ color: '#334155' }}>Original Source (UPI/Card/Bank)</strong>
                    </div>
                    <div>
                      <span style={{ color: '#166534', fontSize: '0.73rem', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Estimated Credit</span>
                      <strong style={{ color: '#334155' }}>3-5 Business Days</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION AUDIT LOG / ACTIVITY HISTORY */}
              <div className="receipt-audit-history" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #e0e0e0', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.98rem', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-list-check" style={{ color: '#d4af37' }}></i> Action Audit & Activity History
                </h4>
                {(!activeReceiptBooking.actionHistory || activeReceiptBooking.actionHistory.length === 0) ? (
                  <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', color: '#6c757d' }}>
                    <div style={{ fontWeight: '700', color: '#2b2b2b' }}>Initial Stay Reservation</div>
                    <div style={{ marginTop: '2px' }}><strong>By Whom:</strong> Traveler ({activeReceiptBooking.user?.email || 'User'})</div>
                    <div><strong>Target User:</strong> Property Host & System</div>
                    <div><strong>Why:</strong> Standard stay booking initialized</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeReceiptBooking.actionHistory.map((log, index) => (
                      <div key={index} style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: '10px', borderLeft: '4px solid #d4af37' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ color: '#1a1a1a', fontSize: '0.88rem' }}>{log.action}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#495057', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div><strong>By Whom:</strong> {log.performedBy}</div>
                          <div><strong>Target User:</strong> {log.targetUser}</div>
                          {log.reason && <div><strong>Why:</strong> {log.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="receipt-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => window.print()} className="print-receipt-btn" style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', color: '#ffffff', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-print"></i> Print Receipt
                </button>
                <button onClick={() => handleDownloadReceiptFile(activeReceiptBooking)} className="download-receipt-btn" style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)', color: '#1a1a1a', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-download"></i> Download Receipt File (.html / .pdf)
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
                  <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Contact Phone (10 Digits)</label>
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
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  />
                  {caretakerForm.phone && caretakerForm.phone.length > 0 && caretakerForm.phone.length !== 10 && (
                    <small style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Phone number must be exactly 10 digits ({caretakerForm.phone.length}/10)
                    </small>
                  )}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>Govt Verification ID Type</label>
                  <select 
                    value={caretakerForm.govtIdType || 'Aadhaar Card'}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, govtIdType: e.target.value, govtId: '' })}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  >
                    <option value="Aadhaar Card">Aadhaar Card (12 Digits)</option>
                    <option value="PAN Card">PAN Card (10 Alphanumeric)</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID Card">Voter ID Card</option>
                    <option value="Property License">Property License / Utility Bill</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>
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
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                  />
                  {(caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType) && caretakerForm.govtId && caretakerForm.govtId.length !== 12 && (
                    <small style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Aadhaar number must be exactly 12 digits ({caretakerForm.govtId.length}/12)
                    </small>
                  )}
                </div>
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

      <Footer />
    </div>
  );
};

export default UserDashboard;
