import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './PropertyDetails.css';
import '../PropertyGrid/MapContainer.css';
import { properties as mockProperties } from '../../data/mockData';
import { API_BASE_URL } from '../../config';

const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingDates, setBookingDates] = useState(() => ({
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || ''
  }));
  const [guests, setGuests] = useState(() => {
    const qGuests = searchParams.get('guests');
    if (qGuests) {
      const parsed = parseInt(qGuests, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 1;
  });
  const [showFakeModal, setShowFakeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [stayType, setStayType] = useState('night');

  const mapRef = useRef(null);

  useEffect(() => {
    const qCheckIn = searchParams.get('checkIn');
    const qCheckOut = searchParams.get('checkOut');
    const qGuests = searchParams.get('guests');

    if (qCheckIn || qCheckOut) {
      setBookingDates({
        checkIn: qCheckIn || '',
        checkOut: qCheckOut || ''
      });
    }
    if (qGuests) {
      const parsed = parseInt(qGuests, 10);
      if (!isNaN(parsed)) {
        setGuests(parsed);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchProperty = async () => {
      const mockId = parseInt(id);
      if (!isNaN(mockId) && mockId < 100) {
        const mockItem = mockProperties.find(p => p.id === mockId);
        if (mockItem) {
          setProperty({ ...mockItem, photos: [mockItem.image] });
          setLoading(false);
          return;
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/properties/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProperty(data);
        } else {
          const mockItem = mockProperties.find(p => p.id === parseInt(id));
          if (mockItem) setProperty({ ...mockItem, photos: [mockItem.image] });
        }
      } catch (err) {
        const mockItem = mockProperties.find(p => p.id === parseInt(id));
        if (mockItem) setProperty({ ...mockItem, photos: [mockItem.image] });
      }
      setLoading(false);
    };
    fetchProperty();
    window.scrollTo(0, 0);
  }, [id]);

  // Leaflet map initialization for single property location
  useEffect(() => {
    if (!property || loading || !window.L) return;
    const mapElement = document.getElementById('detail-leaflet-map');
    if (!mapElement) return;

    const L = window.L;

    let lat = property.lat;
    let lon = property.lon ?? property.lng;

    if (!lat || !lon) {
      const locLower = (property.location || '').toLowerCase();
      const predefined = {
        "shimla": { lat: 31.1048, lon: 77.1734 },
        "munnar": { lat: 10.0889, lon: 77.0595 },
        "manali": { lat: 32.2396, lon: 77.1887 },
        "gulmarg": { lat: 34.0484, lon: 74.3805 },
        "ooty": { lat: 11.4102, lon: 76.6950 },
        "nainital": { lat: 29.3919, lon: 79.4542 },
        "mahabaleshwar": { lat: 17.9258, lon: 73.6510 },
        "panchgani": { lat: 17.9238, lon: 73.8050 },
        "lonavala": { lat: 18.7557, lon: 73.4091 }
      };

      for (const [key, coords] of Object.entries(predefined)) {
        if (locLower.includes(key)) {
          lat = coords.lat;
          lon = coords.lon;
          break;
        }
      }
      if (!lat || !lon) {
        lat = 17.9258;
        lon = 73.6510;
      }
    }

    try {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map('detail-leaflet-map', {
        zoomControl: true
      }).setView([lat, lon], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const customIcon = L.divIcon({
        className: 'custom-red-pin-marker',
        html: `<div class="map-red-pin marker-active">
                 <svg width="34" height="46" viewBox="0 0 384 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <path fill="#e63946" d="M172.268 501.67C26.97 291.03 0 269.41 0 192 0 85.96 85.96 0 192 0s192 85.96 192 192c0 77.41-26.97 99.03-172.268 309.67a24 24 0 0 1-35.464 0z"/>
                   <circle cx="192" cy="192" r="75" fill="#ffffff"/>
                 </svg>
               </div>`,
        iconSize: [34, 46],
        iconAnchor: [17, 46]
      });

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

      const popupContent = `
        <div class="popup-hotel-card">
          <img src="${property.photos?.[0] || property.image}" alt="${property.name}" class="popup-hotel-image" />
          <div class="popup-hotel-details">
            <div class="popup-hotel-type">${property.type}</div>
            <div class="popup-hotel-name">${property.name}</div>
            <div class="popup-hotel-price">${property.price || '₹15,000'}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      mapRef.current = map;

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    } catch (err) {
      console.warn('Leaflet detail map initialization skipped:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [property]);

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleResetBookingForm = () => {
    setBookingDates({ checkIn: '', checkOut: '' });
    setGuests(1);
    setStayType('night');
  };

  const calculateTotalPrice = () => {
    if (!bookingDates.checkIn || !property) return 0;
    const priceValue = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '15000');
    
    if (stayType === 'day') {
      return Math.round(priceValue * 0.55); // Day pass at 55% rate
    }

    if (!bookingDates.checkOut) return priceValue;
    const start = new Date(bookingDates.checkIn);
    const end = new Date(bookingDates.checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return priceValue * diffDays;
  };

  const handleBookingStart = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please sign in to book your stay.');
      navigate('/signin');
      return;
    }

    const total = calculateTotalPrice();
    if (total <= 0) {
      alert('Please select valid check-in and check-out dates.');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          propertyId: property?._id || id,
          checkIn: bookingDates.checkIn,
          checkOut: bookingDates.checkOut || bookingDates.checkIn,
          guests: guests,
          totalPrice: total,
          isFake: true 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || 'Booking failed');

      setPendingData(data);
      setTimeout(() => {
        setShowFakeModal(true);
      }, 100);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmFakePayment = async () => {
    if (!pendingData) {
      alert('Session lost. Please refresh and try again.');
      setShowFakeModal(false);
      return;
    }

    if (!pendingData.order_id) {
      alert('Order ID missing. Please try reserving again.');
      setShowFakeModal(false);
      return;
    }

    setIsProcessing(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          razorpay_order_id: pendingData.order_id,
          isFake: true
        })
      });

      const resData = await response.json();
      if (response.ok) {
        alert('Payment Successful! (Simulated)');
        navigate('/dashboard');
      } else {
        alert(`Payment simulation failed: ${resData.msg || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network Error: Could not reach the server.');
    } finally {
      setIsProcessing(false);
      setShowFakeModal(false);
    }
  };

  if (loading) return <div className="loading">Loading your luxury experience...</div>;
  if (!property) return <div className="error">Property not found</div>;

  return (
    <>
      <Navbar />
      <div className="property-details-page">
        <div className="details-hero">
          <img src={property.photos?.[0] || property.image} alt={property.name} />
          <div className="hero-overlay">
            <div className="container">
              <div>
                <span className="badge">{property.type}</span>
                <h1>{property.name}</h1>
                <p className="location-text">📍 {property.location}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container main-content">
          <div className="details-grid">
            <div className="info-section">
              <div className="description-card glass-morphism">
                <h3>About this {property.type}</h3>
                <p>Experience the ultimate luxury at {property.name}. Nestled in the heart of {property.location}, this exquisite {property.type} offers breathtaking views and premium amenities.</p>
                <div className="amenities">
                  <h4>What this place offers</h4>
                  <ul>
                    <li>Mountain View</li>
                    <li>Premium Wifi</li>
                    <li>Private Kitchen</li>
                    <li>Infinity Pool Access</li>
                  </ul>
                </div>
              </div>

              {/* Host / Provider Profile Card */}
              <div className="description-card glass-morphism" style={{ marginTop: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1b4332 0%, #52b788 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    border: '2px solid var(--secondary-color)',
                    boxShadow: '0 4px 12px rgba(27, 67, 50, 0.3)'
                  }}>
                    {property.owner?.name ? property.owner.name.charAt(0).toUpperCase() : 'H'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--primary-color)' }}>
                      Hosted by {property.owner?.name || 'Verified Luxury Host'}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <i className="fa-solid fa-shield-halved" style={{ color: 'var(--secondary-color)', marginRight: '6px' }}></i>
                      Verified Stay Provider • 100% Superhost Response Rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Location Map Section */}
              <div className="location-map-card glass-morphism">
                <h3>Where you'll be staying</h3>
                <p>
                  <i className="fa-solid fa-location-dot" style={{ color: 'var(--secondary-color)', marginRight: '8px' }}></i> 
                  {property.location}
                </p>
                <div className="detail-map-wrapper">
                  <div id="detail-leaflet-map"></div>
                </div>
              </div>

              {/* Property Video Tour Section */}
              {property.videos && property.videos.length > 0 && (
                <div className="location-map-card glass-morphism" style={{ marginTop: '30px' }}>
                  <h3>
                    <i className="fa-solid fa-circle-play" style={{ color: 'var(--secondary-color)', marginRight: '10px' }}></i>
                    Property Video Tour
                  </h3>
                  <p>Take an immersive video walkthrough of {property.name}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '15px' }}>
                    {property.videos.map((vid, idx) => (
                      <video key={idx} controls style={{ width: '100%', borderRadius: '16px', boxShaow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                        <source src={vid} type="video/mp4" />
                        <source src={vid} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="booking-section">
              <div className="booking-card glass-morphism">
                <div className="price-header">
                  <span className="price-text">
                    ₹{stayType === 'day' 
                      ? Math.round(parseInt(property.price?.toString().replace(/[^0-9]/g, '') || 15000) * 0.55).toLocaleString('en-IN')
                      : (property.price || '15,000')}
                  </span>
                  <span className="per-night">{stayType === 'day' ? ' / day pass (9 AM - 6 PM)' : ' / night'}</span>
                </div>

                {/* Day & Night Stay Selector Toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <button 
                    type="button" 
                    onClick={() => setStayType('night')}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: stayType === 'night' ? '2px solid #2D433D' : '1px solid #ddd',
                      background: stayType === 'night' ? '#2D433D' : '#ffffff',
                      color: stayType === 'night' ? '#ffffff' : '#1a1a1a',
                      fontWeight: '700',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    🌙 Night Stay
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStayType('day')}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: stayType === 'day' ? '2px solid #D4AF37' : '1px solid #ddd',
                      background: stayType === 'day' ? '#D4AF37' : '#ffffff',
                      color: stayType === 'day' ? '#1a1a1a' : '#1a1a1a',
                      fontWeight: '700',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ☀️ Day Pass
                  </button>
                </div>

                <form onSubmit={handleBookingStart} className="booking-form">
                  <div className="form-group">
                    <label>{stayType === 'day' ? 'Date of Visit' : 'Check-in'}</label>
                    <input 
                      type="date" 
                      required 
                      min={getTodayDateString()}
                      value={bookingDates.checkIn} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setBookingDates(prev => ({
                          ...prev,
                          checkIn: val,
                          checkOut: stayType === 'day' ? val : (prev.checkOut && prev.checkOut <= val ? '' : prev.checkOut)
                        }));
                      }} 
                    />
                  </div>

                  {stayType === 'night' && (
                    <div className="form-group">
                      <label>Check-out</label>
                      <input 
                        type="date" 
                        required 
                        min={bookingDates.checkIn || getTodayDateString()}
                        value={bookingDates.checkOut} 
                        onChange={(e) => setBookingDates({ ...bookingDates, checkOut: e.target.value })} 
                      />
                    </div>
                  )}

                  {stayType === 'day' && (
                    <div className="form-group" style={{ background: '#f8f9fa', padding: '12px', borderRadius: '10px', border: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '0.78rem', color: '#666', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Day Slot Hours</span>
                      <strong style={{ fontSize: '0.95rem', color: '#2D433D' }}>9:00 AM - 6:00 PM (Full Day Pass)</strong>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Guests</label>
                    <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))}>
                      <option value="1">1 Guest</option>
                      <option value="2">2 Guests</option>
                      <option value="3">3 Guests</option>
                      <option value="4">4 Guests</option>
                    </select>
                  </div>
                  
                  {bookingDates.checkIn && bookingDates.checkOut && (
                    <div className="price-summary">
                      <div className="price-row">
                        <span>Total Amount</span>
                        <strong>₹{calculateTotalPrice()}</strong>
                      </div>
                    </div>
                  )}

                  <div className="booking-actions-group" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="submit" disabled={isProcessing} className="btn-primary" style={{ flex: '2', padding: '12px 20px', borderRadius: '50px' }}>
                      {isProcessing ? 'Processing...' : 'Reserve & Pay'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleResetBookingForm} 
                      className="cancel-booking-form-btn"
                      style={{ flex: '1', padding: '12px 16px', borderRadius: '50px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                <p className="no-charge">Secure Simulation Mode Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fake Payment Modal */}
        {showFakeModal && (
          <div className="fake-payment-overlay">
            <div className="fake-payment-modal glass-morphism">
              <div className="modal-header">
                <h3>Secure Checkout</h3>
                <p>Simulation Mode</p>
              </div>
              <div className="modal-body">
                <div className="payment-summary">
                  <p>Property: <strong>{property.name}</strong></p>
                  <p>Amount to Pay: <strong className="amount">₹{calculateTotalPrice()}</strong></p>
                </div>
                <div className="fake-card-info">
                  <div className="fake-card-graphic">
                    <div className="chip"></div>
                    <p className="card-number">**** **** **** 1234</p>
                    <p className="card-holder">LUXURY MEMBER</p>
                  </div>
                  <p className="sim-hint">This is a simulated payment gateway for testing.</p>
                </div>
                <button onClick={confirmFakePayment} disabled={isProcessing} className="btn-primary pay-btn">
                  {isProcessing ? 'Verifying...' : 'Pay Now'}
                </button>
                <button onClick={() => setShowFakeModal(false)} className="btn-text cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default PropertyDetails;
