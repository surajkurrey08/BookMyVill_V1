import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './PropertyDetails.css';
import '../PropertyGrid/MapContainer.css';
import { properties as mockProperties } from '../../data/mockData';
export const getRawMapLink = (mapLink) => {
  if (!mapLink || typeof mapLink !== 'string') return '';
  let trimmed = mapLink.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const formatGoogleMapsDirectionsUrl = (mapLink, name, location) => {
  if (mapLink && typeof mapLink === 'string') {
    let trimmed = mapLink.trim();
    if (trimmed) {
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = `https://${trimmed}`;
      }
      if (trimmed.includes('/dir/')) {
        return trimmed;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
    }
  }

  const destinationQuery = location ? `${location}` : (name || 'Mahabaleshwar');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;
};

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
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeMediaType, setActiveMediaType] = useState('photo'); // 'photo' or 'video'

  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    type: 'image',
    url: '',
    index: 0
  });
  const [zoomScale, setZoomScale] = useState(1);

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
      const isPureNumericId = /^\d+$/.test(id) && id.length <= 3;
      if (isPureNumericId) {
        const mockId = parseInt(id, 10);
        const mockItem = mockProperties.find(p => p.id === mockId);
        if (mockItem) {
          setProperty({
            ...mockItem,
            photos: mockItem.photos || [mockItem.image],
            image: mockItem.image
          });
          setLoading(false);
          return;
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/properties/${id}`);
        if (response.ok) {
          const data = await response.json();
          const photos = Array.isArray(data.photos) && data.photos.length > 0
            ? data.photos
            : ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200"];

          setProperty({
            ...data,
            photos,
            image: photos[0],
            rating: data.rating || 4.9,
            reviewsCount: data.reviewsCount || 85,
            videos: Array.isArray(data.videos) && data.videos.length > 0 
              ? data.videos 
              : ["https://assets.mixkit.co/videos/preview/mixkit-luxury-house-with-a-swimming-pool-41481-large.mp4"]
          });
        } else {
          const mockItem = mockProperties.find(p => p.id === parseInt(id));
          if (mockItem) {
            setProperty({
              ...mockItem,
              photos: mockItem.photos || [mockItem.image],
              image: mockItem.image
            });
          }
        }
      } catch (err) {
        const mockItem = mockProperties.find(p => p.id === parseInt(id));
        if (mockItem) {
          setProperty({
            ...mockItem,
            photos: mockItem.photos || [mockItem.image],
            image: mockItem.image
          });
        }
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

    // Helper to parse coordinates from property lat/lon, mapLink, or location text
    let lat = null;
    let lon = null;

    if (property.lat && (property.lon || property.lng)) {
      lat = parseFloat(property.lat);
      lon = parseFloat(property.lon ?? property.lng);
    }

    if ((!lat || !lon) && property.mapLink) {
      const link = property.mapLink;
      const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lon = parseFloat(atMatch[2]);
      } else {
        const qMatch = link.match(/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
        if (qMatch) {
          lat = parseFloat(qMatch[1]);
          lon = parseFloat(qMatch[2]);
        } else {
          const genMatch = link.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
          if (genMatch) {
            lat = parseFloat(genMatch[1]);
            lon = parseFloat(genMatch[2]);
          }
        }
      }
    }

    if ((!lat || !lon) && property.location) {
      const locMatch = property.location.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
      if (locMatch) {
        lat = parseFloat(locMatch[1]);
        lon = parseFloat(locMatch[2]);
      }
    }

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
        "lonavala": { lat: 18.7557, lon: 73.4091 },
        "pune": { lat: 18.5204, lon: 73.8567 },
        "pawna": { lat: 18.6878, lon: 73.4832 },
        "mulshi": { lat: 18.5083, lon: 73.5132 },
        "lavasa": { lat: 18.4088, lon: 73.5080 },
        "khandala": { lat: 18.7512, lon: 73.3814 },
        "baner": { lat: 18.5590, lon: 73.7868 },
        "kamshet": { lat: 18.7583, lon: 73.5604 }
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

  const galleryPhotos = (property.photos && property.photos.length > 0)
    ? property.photos
    : [
        property.image,
        'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800'
      ];

  const openImageZoom = (index) => {
    setLightboxState({
      isOpen: true,
      type: 'image',
      url: galleryPhotos[index] || galleryPhotos[0],
      index: index
    });
    setZoomScale(1);
  };

  const openVideoZoom = (vidUrl) => {
    setLightboxState({
      isOpen: true,
      type: 'video',
      url: vidUrl,
      index: 0
    });
    setZoomScale(1);
  };

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.5, 3.5));
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.5, 0.5));
  const handleZoomReset = () => setZoomScale(1);

  const closeLightbox = () => {
    setLightboxState({ isOpen: false, type: 'image', url: '', index: 0 });
    setZoomScale(1);
  };

  const prevPhotoZoom = () => {
    if (lightboxState.type !== 'image') return;
    const newIdx = (lightboxState.index - 1 + galleryPhotos.length) % galleryPhotos.length;
    setLightboxState({
      ...lightboxState,
      url: galleryPhotos[newIdx],
      index: newIdx
    });
    setZoomScale(1);
  };

  const nextPhotoZoom = () => {
    if (lightboxState.type !== 'image') return;
    const newIdx = (lightboxState.index + 1) % galleryPhotos.length;
    setLightboxState({
      ...lightboxState,
      url: galleryPhotos[newIdx],
      index: newIdx
    });
    setZoomScale(1);
  };

  return (
    <>
      <Navbar />
      <div className="property-details-page">
        <div className="details-hero" style={{ position: 'relative', overflow: 'hidden', background: '#0d1b1e' }}>
          {activeMediaType === 'photo' ? (
            <img 
              src={galleryPhotos[activePhotoIndex] || galleryPhotos[0]} 
              alt={property.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <video 
              src={property.video || "https://assets.mixkit.co/videos/preview/mixkit-resort-pool-in-a-sunny-day-42845-large.mp4"} 
              controls 
              autoPlay 
              loop
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div className="hero-overlay" style={{ pointerEvents: 'none' }}>
            <div className="container" style={{ pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                <div>
                  <span className="badge">{property.type}</span>
                  <h1>{property.name}</h1>
                  <p className="location-text">📍 {property.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container main-content">
          <div className="details-grid">
            <div className="info-section">
              {/* Property Photos & Video Tour Showcase in Same Place */}
              <div className="description-card glass-morphism">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
                    <i className="fa-solid fa-photo-film" style={{ color: 'var(--secondary-color)', marginRight: '10px' }}></i>
                    Photos & HD Video Showcase
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={() => setActiveMediaType('photo')}
                      style={{
                        background: activeMediaType === 'photo' ? '#1b4332' : '#e8e8e8',
                        color: activeMediaType === 'photo' ? '#ffffff' : '#333333',
                        border: 'none',
                        padding: '7px 18px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      📷 Photos ({galleryPhotos.length})
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setActiveMediaType('video')}
                      style={{
                        background: activeMediaType === 'video' ? '#d4af37' : '#e8e8e8',
                        color: activeMediaType === 'video' ? '#1a1a1a' : '#333333',
                        border: 'none',
                        padding: '7px 18px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      🎬 HD Video Tour
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Click photos or the video thumbnail below to switch view directly in the top showcase frame
                </p>

                <div className="gallery-thumbnails-strip" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {/* Photo Thumbnails */}
                  {galleryPhotos.map((photoUrl, idx) => (
                    <div 
                      key={idx} 
                      className={`gallery-thumb-item ${activeMediaType === 'photo' && activePhotoIndex === idx ? 'active-thumb' : ''}`}
                      onClick={() => {
                        setActiveMediaType('photo');
                        setActivePhotoIndex(idx);
                      }}
                      title={`View Photo ${idx + 1}`}
                      style={{ 
                        cursor: 'pointer', 
                        position: 'relative', 
                        minWidth: '95px', 
                        height: '68px', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        border: (activeMediaType === 'photo' && activePhotoIndex === idx) ? '3px solid #d4af37' : '2px solid transparent',
                        boxShadow: (activeMediaType === 'photo' && activePhotoIndex === idx) ? '0 4px 12px rgba(212, 175, 55, 0.4)' : 'none'
                      }}
                    >
                      <img src={photoUrl} alt={`${property.name} view ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        📷
                      </span>
                    </div>
                  ))}

                  {/* Video Thumbnail in Same Place */}
                  <div 
                    className={`gallery-thumb-item ${activeMediaType === 'video' ? 'active-thumb' : ''}`}
                    onClick={() => setActiveMediaType('video')}
                    title="Play HD Video Tour"
                    style={{ 
                      cursor: 'pointer', 
                      position: 'relative', 
                      minWidth: '115px', 
                      height: '68px', 
                      borderRadius: '12px', 
                      overflow: 'hidden', 
                      border: activeMediaType === 'video' ? '3px solid #d4af37' : '2px solid #1b4332',
                      background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: activeMediaType === 'video' ? '0 4px 12px rgba(212, 175, 55, 0.4)' : 'none'
                    }}
                  >
                    <i className="fa-solid fa-circle-play" style={{ fontSize: '1.4rem', color: '#d4af37' }}></i>
                    <span style={{ fontSize: '0.68rem', fontWeight: '800', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ▶ PLAY VIDEO
                    </span>
                  </div>
                </div>
              </div>

              <div className="description-card glass-morphism">
                <h3>About this {property.type}</h3>
                <p>Experience the ultimate luxury at {property.name}. Nestled in the heart of {property.location}, this exquisite {property.type} offers breathtaking views, mountain mist breeze, and premium amenities.</p>
                <div className="amenities">
                  <h4>What this place offers</h4>
                  <ul>
                    <li>⛰️ Mountain & Valley View</li>
                    <li>📶 Premium High-Speed Wi-Fi</li>
                    <li>🍳 Private Kitchen & Chef Service</li>
                    <li>🏊 Infinity Pool & Jacuzzi Access</li>
                    <li>🔥 Private Evening Bonfire Pass</li>
                    <li>🚗 Free Valet Parking</li>
                  </ul>
                </div>
              </div>

              {/* Host / Provider Profile Card */}
              <div className="description-card glass-morphism">
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>Where you'll be staying</h3>
                    <p style={{ margin: 0 }}>
                      <i className="fa-solid fa-location-dot" style={{ color: 'var(--secondary-color)', marginRight: '8px' }}></i> 
                      {property.location}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {property.mapLink && (
                      <a 
                        href={getRawMapLink(property.mapLink)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          border: '1px solid rgba(212, 175, 55, 0.5)',
                          padding: '10px 16px',
                          borderRadius: '30px',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: '#d4af37' }}></i> Open Host Map Link ↗
                      </a>
                    )}

                    <a 
                      href={formatGoogleMapsDirectionsUrl(property.mapLink, property.name, property.location)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)',
                        color: '#1a1a1a',
                        padding: '10px 18px',
                        borderRadius: '30px',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
                      }}
                    >
                      <i className="fa-solid fa-compass"></i> Live GPS Directions ↗
                    </a>
                  </div>
                </div>
                <div className="detail-map-wrapper">
                  <div id="detail-leaflet-map"></div>
                </div>
              </div>

              {/* Property Video Tour Section */}
              <div className="location-map-card glass-morphism" style={{ marginTop: '30px' }}>
                <h3>
                  <i className="fa-solid fa-circle-play" style={{ color: 'var(--secondary-color)', marginRight: '10px' }}></i>
                  Property HD Video Tour & Walkthrough
                </h3>
                <p>Take an immersive video tour of {property.name}, infinity pool, and mountain mist views</p>
                <div style={{ marginTop: '15px' }}>
                  {(() => {
                    const videoList = (property.videos && property.videos.length > 0)
                      ? property.videos
                      : [
                          "https://assets.mixkit.co/videos/preview/mixkit-luxury-house-with-a-swimming-pool-41481-large.mp4",
                          "https://assets.mixkit.co/videos/preview/mixkit-living-room-of-a-modern-house-41482-large.mp4"
                        ];

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        {videoList.map((vidUrl, idx) => (
                          <div key={idx} style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.15)', background: '#000', position: 'relative' }}>
                            <video 
                              controls 
                              preload="metadata"
                              poster={galleryPhotos[idx % galleryPhotos.length]}
                              style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block' }}
                            >
                              <source src={vidUrl} type="video/mp4" />
                              <source src={vidUrl} type="video/webm" />
                            </video>
                            <div style={{ padding: '10px 14px', background: '#1b4332', color: '#ffffff', fontSize: '0.82rem', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span><i className="fa-solid fa-film" style={{ color: '#d4af37', marginRight: '6px' }}></i> Tour Video #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => openVideoZoom(vidUrl)}
                                style={{
                                  background: '#d4af37',
                                  color: '#1a1a1a',
                                  border: 'none',
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontWeight: '700',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <i className="fa-solid fa-expand" style={{ marginRight: '4px' }}></i> Fullscreen Zoom
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

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
        {/* Fullscreen Zoom Lightbox Modal for Images and Videos */}
        {lightboxState.isOpen && (
          <div className="media-zoom-overlay" onClick={closeLightbox}>
            <div className="zoom-modal-toolbar" onClick={(e) => e.stopPropagation()}>
              <div className="zoom-controls-group">
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#d4af37' }}>
                  {lightboxState.type === 'image' ? `Photo (${lightboxState.index + 1}/${galleryPhotos.length})` : 'HD Video Theater'}
                </span>
                
                <button type="button" onClick={handleZoomIn} className="zoom-btn" title="Zoom In">
                  <i className="fa-solid fa-magnifying-glass-plus"></i> Zoom In
                </button>
                <button type="button" onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">
                  <i className="fa-solid fa-magnifying-glass-minus"></i> Zoom Out
                </button>
                <button type="button" onClick={handleZoomReset} className="zoom-btn" title="Reset Zoom">
                  Reset
                </button>
                <span className="zoom-scale-badge">{Math.round(zoomScale * 100)}%</span>
              </div>

              {lightboxState.type === 'image' && (
                <div className="zoom-controls-group">
                  <button type="button" onClick={prevPhotoZoom} className="zoom-btn">
                    <i className="fa-solid fa-chevron-left"></i> Previous
                  </button>
                  <button type="button" onClick={nextPhotoZoom} className="zoom-btn">
                    Next <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              )}

              <button type="button" onClick={closeLightbox} className="zoom-close-btn" title="Close Lightbox">
                ✕
              </button>
            </div>

            <div className="zoom-stage-viewport" onClick={closeLightbox}>
              {lightboxState.type === 'image' ? (
                <img 
                  src={lightboxState.url} 
                  alt="Zoom View"
                  className="zoomable-media-element"
                  style={{ transform: `scale(${zoomScale})`, cursor: zoomScale > 1 ? 'grab' : 'zoom-in' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (zoomScale === 1) handleZoomIn();
                  }}
                />
              ) : (
                <div 
                  className="zoomable-media-element" 
                  onClick={(e) => e.stopPropagation()} 
                  style={{ transform: `scale(${zoomScale})`, width: '85%', maxWidth: '1100px' }}
                >
                  <video 
                    controls 
                    autoPlay 
                    style={{ width: '100%', borderRadius: '16px', maxHeight: '75vh', background: '#000', display: 'block' }}
                  >
                    <source src={lightboxState.url} type="video/mp4" />
                    <source src={lightboxState.url} type="video/webm" />
                  </video>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default PropertyDetails;
