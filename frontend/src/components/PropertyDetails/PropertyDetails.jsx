import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './PropertyDetails.css';
import '../PropertyGrid/MapContainer.css';
import { properties as mockProperties } from '../../data/mockData';
import { API_BASE_URL } from '../../config';
import { getRawMapLink, formatGoogleMapsDirectionsUrl } from '../../utils/locationUtils';
import { launchRazorpayCheckout } from '../../utils/razorpayCheckout';

const getPropertyTagBadge = (prop) => {
  if (prop?.tag) return prop.tag.toUpperCase();
  if (prop?.type) return `${prop.type.toUpperCase()} COLLECTION`;
  return 'BOOKMYVILLA LUXURY';
};

const getPropertyScriptTitle = (prop) => {
  const titles = ['Peaceful', 'Serene', 'Tranquil', 'Exquisite', 'Breathtaking', 'Majestic', 'Charming', 'Luxurious'];
  const idStr = String(prop?.id || prop?._id || prop?.name || '');
  const charSum = idStr.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return titles[charSum % titles.length];
};

const getPropertyFeatures = (prop) => {
  const ams = prop?.amenities && prop.amenities.length > 0 ? prop.amenities : [];
  
  const bedFeature = prop?.bedrooms ? `${prop.bedrooms} Bedrooms` : (ams.find(a => a.toLowerCase().includes('bed')) || '3 King Beds');
  const bathFeature = prop?.bathrooms ? `${prop.bathrooms} Baths` : (ams.find(a => a.toLowerCase().includes('bath')) || 'Modern Baths');
  const wifiFeature = ams.find(a => a.toLowerCase().includes('wifi') || a.toLowerCase().includes('wi-fi')) || 'Free Wi-Fi';
  const poolFeature = ams.find(a => a.toLowerCase().includes('pool') || a.toLowerCase().includes('jacuzzi') || a.toLowerCase().includes('lake') || a.toLowerCase().includes('view')) || (prop?.type === 'Villa' ? 'Private Pool' : 'Valley View');

  return [
    { icon: 'fa-bed', text: bedFeature },
    { icon: 'fa-bath', text: bathFeature },
    { icon: 'fa-wifi', text: wifiFeature },
    { icon: 'fa-water-ladder', text: poolFeature }
  ];
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingNotice, setBookingNotice] = useState({ type: '', msg: '' });
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
  const [ownerSelectedReviews, setOwnerSelectedReviews] = useState([]);
  const [showBookingAnimation, setShowBookingAnimation] = useState(false);

  useEffect(() => {
    const fetchPropertyFeedback = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/feedback/property/${id || property?._id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setOwnerSelectedReviews(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch owner feedback:', err);
      }
    };
    if (id || property?._id) {
      fetchPropertyFeedback();
    }
  }, [id, property]);

  const mapRef = useRef(null);

  const autoBookTriggeredRef = useRef(false);

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
    if (!property || loading || autoBookTriggeredRef.current) return;

    const autoBook = searchParams.get('autoBook');
    if (autoBook === 'true') {
      autoBookTriggeredRef.current = true;
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token) {
        let cIn = bookingDates.checkIn || searchParams.get('checkIn') || getTodayDateString();
        let cOut = bookingDates.checkOut || searchParams.get('checkOut');
        if (!cOut) {
          const nextDay = new Date(cIn);
          nextDay.setDate(nextDay.getDate() + 1);
          const yyyy = nextDay.getFullYear();
          const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDay.getDate()).padStart(2, '0');
          cOut = `${yyyy}-${mm}-${dd}`;
        }
        setBookingDates({ checkIn: cIn, checkOut: cOut });

        setTimeout(() => {
          triggerPaymentForAutoBook(cIn, cOut);
        }, 200);
      } else {
        // Unauthenticated user trying to autoBook! Forward to signin IMMEDIATELY before payment modal!
        const currentUrl = `/property/${property?._id || id}${window.location.search}`;
        navigate('/signin', { state: { from: currentUrl, property } });
      }
    }
  }, [property, loading, searchParams]);

  const triggerPaymentForAutoBook = async (cIn, cOut) => {
    if (!cIn || !cOut || cOut <= cIn) { setBookingNotice({ type: 'error', msg: 'Choose an overnight stay to select an available room.' }); return; }
    navigate(`/property/${property?._id || id}/rooms?checkIn=${cIn}&checkOut=${cOut}&guests=${guests}`);
  };

  const locationState = useLocation();

  useEffect(() => {
    const fetchProperty = async () => {
      // 0. Instant match from card click navigation state
      if (locationState.state?.property) {
        const passed = locationState.state.property;
        if (String(passed.id) === String(id) || String(passed._id) === String(id)) {
          const photos = Array.isArray(passed.photos) && passed.photos.length > 0
            ? passed.photos
            : (passed.image ? [passed.image] : ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200"]);
          setProperty({
            ...passed,
            photos,
            image: photos[0]
          });
          setLoading(false);
          return;
        }
      }

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
            : (data.image ? [data.image] : ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200"]);

          setProperty({
            ...data,
            name: data.name,
            type: data.type || 'Villa',
            location: data.location || 'Mahabaleshwar, Maharashtra',
            price: data.price ? (typeof data.price === 'number' ? `₹${data.price.toLocaleString('en-IN')}` : data.price) : '₹15,000',
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            mapLink: data.mapLink || '',
            photos,
            image: photos[0],
            rating: data.rating || 4.9,
            reviewsCount: data.reviewsCount || 85,
            videos: Array.isArray(data.videos) && data.videos.length > 0 
              ? data.videos 
              : ["https://assets.mixkit.co/videos/preview/mixkit-luxury-house-with-a-swimming-pool-41481-large.mp4"]
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch property by ID:', err);
      }

      // Match mock dataset by strict ID match first, or fallback to deterministic hash index
      const mockMatch = mockProperties.find(p => String(p.id) === String(id) || String(p._id) === String(id));
      if (mockMatch) {
        setProperty({
          ...mockMatch,
          photos: mockMatch.photos || [mockMatch.image],
          image: mockMatch.image
        });
      } else {
        const seedIndex = Math.abs((id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % mockProperties.length;
        const fallbackItem = mockProperties[seedIndex] || mockProperties[0];
        setProperty({
          ...fallbackItem,
          photos: fallbackItem.photos || [fallbackItem.image],
          image: fallbackItem.image
        });
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
      const pbMatch = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (pbMatch) {
        lat = parseFloat(pbMatch[1]);
        lon = parseFloat(pbMatch[2]);
      } else {
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
        "venna lake": { lat: 17.9312, lon: 73.6589 },
        "kate's point": { lat: 17.9201, lon: 73.6442 },
        "kate point": { lat: 17.9201, lon: 73.6442 },
        "wilson point": { lat: 17.9285, lon: 73.6631 },
        "lingmala": { lat: 17.9180, lon: 73.6380 },
        "elphinstone": { lat: 17.9350, lon: 73.6700 },
        "arthur's seat": { lat: 17.9625, lon: 73.6400 },
        "lodwick point": { lat: 17.9210, lon: 73.6300 },
        "parsi point": { lat: 17.9230, lon: 73.8010 },
        "table land": { lat: 17.9280, lon: 73.8090 },
        "panchgani": { lat: 17.9238, lon: 73.8050 },
        "tapola": { lat: 17.7600, lon: 73.6900 },
        "bhilar": { lat: 17.9050, lon: 73.7750 },
        "metgutad": { lat: 17.9220, lon: 73.7100 },
        "khinger": { lat: 17.9150, lon: 73.7900 },
        "old mahabaleshwar": { lat: 17.9480, lon: 73.6580 },
        "mahabaleshwar": { lat: 17.9258, lon: 73.6510 },
        "shimla": { lat: 31.1048, lon: 77.1734 },
        "munnar": { lat: 10.0889, lon: 77.0595 },
        "manali": { lat: 32.2396, lon: 77.1887 },
        "gulmarg": { lat: 34.0484, lon: 74.3805 },
        "ooty": { lat: 11.4102, lon: 76.6950 },
        "nainital": { lat: 29.3919, lon: 79.4542 },
        "lonavala": { lat: 18.7557, lon: 73.4091 },
        "pune": { lat: 18.5204, lon: 73.8567 }
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

      if (!document.getElementById('detail-leaflet-map')) return;

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

  // Auto-switch to Day Pass if Check-in and Check-out are on the exact same date
  useEffect(() => {
    if (bookingDates.checkIn && bookingDates.checkOut && bookingDates.checkIn === bookingDates.checkOut) {
      if (stayType !== 'day') {
        setStayType('day');
      }
    }
  }, [bookingDates.checkIn, bookingDates.checkOut, stayType]);

  const calculateTotalPrice = () => {
    if (!bookingDates.checkIn || !property) return 0;
    const priceValue = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '15000');
    
    const isSameDate = bookingDates.checkIn && bookingDates.checkOut && bookingDates.checkIn === bookingDates.checkOut;

    if (stayType === 'day' || isSameDate) {
      return Math.round(priceValue * 0.55); // Same date -> Automatically calculated as Day Pass (55% rate)
    }

    if (!bookingDates.checkOut) return priceValue;
    const start = new Date(bookingDates.checkIn);
    const end = new Date(bookingDates.checkOut);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime <= 0) {
      return Math.round(priceValue * 0.55); // Same date or same day -> Day pass rate
    }
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return priceValue * diffDays;
  };

  const handleBookingStart = async (event) => {
    event?.preventDefault();
    await triggerPaymentForAutoBook(bookingDates.checkIn, bookingDates.checkOut);
  };

  const handlePaymentOrder = async (order, token) => {
    if (!order.paymentAvailable) {
      setBookingNotice({ type: 'info', msg: order.msg || 'Booking request saved. Payment is pending.' });
      return;
    }
    let user = null;
    try { user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null'); } catch (_) {}
    try {
      await launchRazorpayCheckout({
        order,
        token,
        propertyName: property?.name,
        user,
        onPaid: result => {
          const isTest = result.booking?.paymentMode === 'test';
          setBookingNotice({ type: 'success', msg: isTest ? 'Test payment captured. No real money was charged.' : 'Payment captured and booking confirmed.' });
          if (!isTest) setShowBookingAnimation(true);
          setTimeout(() => navigate('/dashboard'), 3500);
        },
        onError: error => setBookingNotice({ type: 'error', msg: error.message || 'Payment could not be verified. Booking remains pending.' }),
        onDismiss: () => setBookingNotice(current => current.type === 'success' ? current : { type: 'info', msg: 'Payment window closed. Booking remains pending until payment is verified.' })
      });
    } catch (error) {
      setBookingNotice({ type: 'error', msg: `${error.message} Booking remains pending.` });
    }
  };
  if (loading) return <div className="loading">Loading your luxury experience...</div>;

  if (!property) {
    return (
      <div className="details-page">
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 20px', color: '#ffffff' }}>
          <i className="fa-solid fa-hotel" style={{ fontSize: '3.5rem', color: '#d4af37', marginBottom: '20px' }}></i>
          <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', margin: '0 0 10px 0' }}>Property Listing Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '24px', fontSize: '0.95rem' }}>
            The requested stay listing could not be found or has been updated. Explore our collection of luxury Mahabaleshwar villas & resorts.
          </p>
          <button 
            onClick={() => navigate('/explore')} 
            className="btn-primary" 
            style={{ background: '#d4af37', color: '#1a1a1a', fontWeight: '700', padding: '12px 32px', borderRadius: '30px', border: 'none', cursor: 'pointer' }}
          >
            Explore All Luxury Stays
          </button>
        </div>
        <Footer />
      </div>
    );
  }

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

  const toggleNativeFullscreen = (elementOrRef) => {
    const elem = elementOrRef || document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  return (
    <>
      <Navbar />
      <div 
        className="property-details-page"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(11, 20, 17, 0.75) 0%, rgba(11, 20, 17, 0.94) 100%), url(${galleryPhotos[0] || property.image})`,
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="details-hero-salford-mockup" style={{
          position: 'relative',
          minHeight: '620px',
          padding: '40px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundImage: `linear-gradient(180deg, rgba(13, 27, 30, 0.45) 0%, rgba(13, 27, 30, 0.82) 65%, rgba(13, 27, 30, 0.95) 100%), url(${galleryPhotos[0] || property.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}>
          {/* Top Header Row: Fullscreen Button */}
          <div className="container" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', zIndex: 10 }}>

            <button
              type="button"
              onClick={() => {
                openImageZoom(activePhotoIndex);
                toggleNativeFullscreen();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                padding: '10px 22px',
                borderRadius: '30px',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-expand" style={{ color: '#f5d061' }}></i> Full Screen ⛶
            </button>
          </div>

          {/* Center Glass Card Overlay (Matching User Mockup) */}
          <div className="container" style={{ zIndex: 10, maxWidth: '820px', margin: '30px auto' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderRadius: '32px',
              padding: '36px 32px',
              border: '1.5px solid rgba(255, 255, 255, 0.35)',
              textAlign: 'center',
              color: '#ffffff',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
            }}>
              <span style={{
                fontFamily: "'Great Vibes', 'Playfair Display', cursive, serif",
                fontSize: '3.2rem',
                color: '#f5d061',
                display: 'block',
                marginBottom: '-8px',
                fontWeight: '500',
                lineHeight: '1'
              }}>
                {getPropertyScriptTitle(property)}
              </span>
              
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '2.4rem',
                fontWeight: '900',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                color: '#ffffff',
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                {property.name}
              </h1>

              <span style={{
                fontSize: '0.88rem',
                fontWeight: '800',
                color: '#f5d061',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '16px'
              }}>
                {property.type || 'LUXURY STAY'} • {property.location}
              </span>

              <p style={{
                fontSize: '0.98rem',
                color: '#e2e8f0',
                lineHeight: '1.6',
                margin: '0 auto 24px auto',
                maxWidth: '650px',
                fontWeight: '400'
              }}>
                A {getPropertyScriptTitle(property).toLowerCase()} space designed for rest and recharge. Discover your dream stay in {property.location} where luxury meets tranquility.
              </p>

              {/* Sub-Card with FEATURES ROW: Gold Pill Header */}
              <div style={{
                position: 'relative',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '20px 16px 14px 16px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                marginTop: '20px'
              }}>
                <span style={{
                  position: 'absolute',
                  top: '-13px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #f5d061 0%, #d4af37 100%)',
                  color: '#0b110f',
                  fontSize: '0.74rem',
                  fontWeight: '900',
                  letterSpacing: '1.5px',
                  padding: '3px 18px',
                  borderRadius: '16px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.4)'
                }}>
                  FEATURES ROW:
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', alignItems: 'center' }}>
                  {getPropertyFeatures(property).map((ft, idx) => (
                    <div key={idx} style={{ padding: '0 8px', borderRight: idx < 3 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                      <i className={`fa-solid ${ft.icon}`} style={{ fontSize: '1.4rem', color: '#f5d061', display: 'block', marginBottom: '6px' }}></i>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#ffffff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ft.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Photo Gallery Row (3 Preview Thumbnails with Rating Badges) */}
          <div className="container" style={{ zIndex: 10, maxWidth: '820px', margin: '0 auto' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '24px',
              padding: '14px',
              border: '1.5px solid rgba(255, 255, 255, 0.35)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {galleryPhotos.slice(0, 3).map((photoUrl, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => openImageZoom(idx)}
                    title="Click to view full screen"
                    style={{
                      height: '110px',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      border: '1.5px solid rgba(255,255,255,0.4)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <img src={photoUrl} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(11, 17, 15, 0.85)',
                      color: '#f5d061',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(245, 208, 97, 0.4)'
                    }}>
                      ♥ {idx === 0 ? '4.9' : idx === 1 ? '4.8' : '4.6'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="container main-content" style={{ marginTop: '40px' }}>
          <div className="details-grid">
            <div className="info-section">
              
              {/* 1. About Villa, Amenities & Host Profile Section FIRST */}
              <div className="description-card glass-morphism animated-details-card">
                <h3>About this {property.type}</h3>
                <p>Experience the ultimate luxury at {property.name}. Nestled in the heart of {property.location}, this exquisite {property.type} offers breathtaking views, mountain mist breeze, and premium amenities.</p>
                
                <div className="amenities" style={{ marginTop: '30px' }}>
                  <h4>What this place offers & Provided Resources</h4>
                  {property.amenities && property.amenities.length > 0 ? (
                    <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', padding: 0, listStyle: 'none' }}>
                      {property.amenities.map((item, idx) => (
                        <li key={idx} style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}>
                          <i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', padding: 0, listStyle: 'none' }}>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Mountain & Valley View</li>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Premium High-Speed Wi-Fi</li>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Private Kitchen & Chef Service</li>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Infinity Pool & Jacuzzi Access</li>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Private Evening Bonfire Pass</li>
                      <li style={{ background: 'rgba(212, 175, 55, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}><i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Free Valet Parking</li>
                    </ul>
                  )}
                </div>

                {/* Host Profile Inside Description Box */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '35px', paddingTop: '24px', borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1b4332 0%, #52b788 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: '700',
                    border: '2px solid #d4af37',
                    boxShadow: '0 4px 12px rgba(27, 67, 50, 0.3)'
                  }}>
                    {property.owner?.name ? property.owner.name.charAt(0).toUpperCase() : 'H'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.25rem', color: '#d4af37' }}>
                      Hosted by {property.owner?.name || 'Verified Luxury Host'}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                      <i className="fa-solid fa-shield-halved" style={{ color: '#d4af37', marginRight: '6px' }}></i>
                      Verified Stay Provider • 100% Superhost Response Rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Hotel Full Address & Location Card */}
              <div className="location-map-card glass-morphism animated-details-card" style={{ padding: '24px 28px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#ffd700', fontFamily: 'var(--font-heading, serif)' }}>
                      <i className="fa-solid fa-location-dot" style={{ color: '#d4af37', marginRight: '10px' }}></i>
                      Hotel Location & Full Address
                    </h3>
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                      Official property location & verified postal address provided by the owner.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a 
                      href={formatGoogleMapsDirectionsUrl(property.mapLink, property.name, property.location)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)',
                        color: '#1a1a1a',
                        padding: '10px 22px',
                        borderRadius: '30px',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)'
                      }}
                    >
                      <i className="fa-solid fa-diamond-turn-right"></i> Directions
                    </a>
                  </div>
                </div>

                {/* Detailed Address Details Box */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}>
                  <div style={{
                    background: 'rgba(212, 175, 55, 0.15)',
                    color: '#d4af37',
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    flexShrink: 0
                  }}>
                    <i className="fa-solid fa-map-pin"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.96rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>
                      {property.name} Address
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
                      <span>Near Main Hill Station Vista, {property.location}, Maharashtra 412806</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                      <span><i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '4px' }}></i> GPS Navigation Verified</span>
                      <span>Region: {property.location}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#d4af37', fontWeight: '700' }}>
                      <i className="fa-solid fa-shield-check" style={{ marginRight: '4px' }}></i> Property Owner Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Owner Selected Guest Reviews & Stay Feedback */}
              <div className="description-card glass-morphism animated-details-card" style={{ marginTop: '24px', padding: '24px 28px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fa-solid fa-star" style={{ color: '#d4af37' }}></i>
                    Verified Guest Reviews & Host Featured Feedback
                  </h3>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(212, 175, 55, 0.15)', color: '#d4af37', padding: '4px 12px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.3)', fontWeight: '700' }}>
                    ★ Selected by Property Owner
                  </span>
                </div>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                  Hand-picked guest reviews and authentic stay experiences selected directly by the property owner.
                </p>

                {ownerSelectedReviews && ownerSelectedReviews.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {ownerSelectedReviews.map((rev, idx) => (
                      <div key={rev._id || idx} style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(212, 175, 55, 0.25)',
                        borderRadius: '16px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>{rev.guestName}</strong>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              {[...Array(5)].map((_, i) => (
                                <i key={i} className={`fa-solid fa-star${i < (rev.rating || 5) ? '' : '-o'}`} style={{ color: i < (rev.rating || 5) ? '#d4af37' : 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}></i>
                              ))}
                            </div>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{rev.reviewText}"
                          </p>
                        </div>

                        {rev.facilitiesUsed && rev.facilitiesUsed.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {rev.facilitiesUsed.map((fac, fIdx) => (
                              <span key={fIdx} style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '8px', fontWeight: '600' }}>
                                ✓ {fac}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px dashed rgba(212, 175, 55, 0.3)' }}>
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                      No owner-featured reviews selected yet. Check back soon!
                    </p>
                  </div>
                )}
              </div>

            </div>

            <div className="booking-section">
              <div className="booking-card glass-morphism animated-booking-card">
                {/* Embedded Hotel Image Preview Header Card with Animated Shimmer Border */}
                <div 
                  className="booking-hotel-img-preview"
                  onClick={() => openImageZoom(0)}
                  title="Click to view full image"
                  style={{
                    position: 'relative',
                    height: '165px',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    marginBottom: '22px',
                    border: '2px solid rgba(212, 175, 55, 0.6)',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.35)',
                    cursor: 'zoom-in'
                  }}
                >
                  <img 
                    src={property.image} 
                    alt={property.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(11, 20, 17, 0.88) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: 'rgba(212, 175, 55, 0.95)',
                        color: '#0b110f',
                        fontSize: '0.72rem',
                        fontWeight: '900',
                        letterSpacing: '1px',
                        padding: '3px 12px',
                        borderRadius: '16px',
                        textTransform: 'uppercase'
                      }}>
                        {property.type || 'LUXURY STAY'}
                      </span>
                      <span style={{
                        background: 'rgba(0, 0, 0, 0.65)',
                        color: '#f5d061',
                        fontSize: '0.76rem',
                        fontWeight: '800',
                        padding: '3px 10px',
                        borderRadius: '14px',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <i className="fa-solid fa-star"></i> {property.rating || '4.8'}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '1.1rem', color: '#ffffff', fontWeight: '800' }}>
                        {property.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fa-solid fa-location-dot" style={{ color: '#f5d061' }}></i>
                        {property.location}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Segmented Pricing Header & Model Badges */}
                <div className="segmented-pricing-header" style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(212, 175, 55, 0.35)',
                  borderRadius: '20px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      background: stayType === 'night' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                      color: stayType === 'night' ? '#f5d061' : '#34d399',
                      border: stayType === 'night' ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid rgba(52, 211, 153, 0.4)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.74rem',
                      fontWeight: '800',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>
                      {stayType === 'night' ? '🌙 Nightly Rate' : '☀️ Day Pass Rate'}
                    </span>
                    
                    <span style={{ fontSize: '0.78rem', color: '#a3b18a', fontWeight: '600' }}>
                      Save 25% Instant
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: '900', color: '#ffffff', fontFamily: 'var(--font-heading, serif)' }}>
                      ₹{stayType === 'day' 
                        ? Math.round(parseInt(property.price?.toString().replace(/[^0-9]/g, '') || 15000) * 0.55).toLocaleString('en-IN')
                        : (property.price || '15,000')}
                    </span>
                    <span style={{ fontSize: '0.88rem', color: '#a3b18a', fontWeight: '700' }}>
                      {stayType === 'day' ? '/ day pass (9 AM - 6 PM)' : '/ night'}
                    </span>
                  </div>
                </div>

                {/* Day & Night Segmented Control Switcher */}
                <div style={{
                  display: 'flex',
                  background: 'rgba(0, 0, 0, 0.45)',
                  padding: '5px',
                  borderRadius: '24px',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  marginBottom: '22px'
                }}>
                  <button 
                    type="button" 
                    onClick={() => setStayType('night')}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      borderRadius: '20px',
                      border: 'none',
                      background: stayType === 'night' ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : 'transparent',
                      color: stayType === 'night' ? '#ffffff' : '#94a3b8',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: stayType === 'night' ? '0 4px 15px rgba(27, 67, 50, 0.4)' : 'none',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-moon" style={{ color: stayType === 'night' ? '#f5d061' : 'inherit' }}></i>
                    Night Stay
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setStayType('day')}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      borderRadius: '20px',
                      border: 'none',
                      background: stayType === 'day' ? 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)' : 'transparent',
                      color: stayType === 'day' ? '#1a1a1a' : '#94a3b8',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: stayType === 'day' ? '0 4px 15px rgba(212, 175, 55, 0.4)' : 'none',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-sun" style={{ color: stayType === 'day' ? '#1a1a1a' : 'inherit' }}></i>
                    Day Pass
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
                    <div className="form-group" style={{ background: '#f8f9fa', padding: '16px 18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', marginBottom: '22px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px', marginBottom: '4px' }}>DAY SLOT HOURS</span>
                      <strong style={{ fontSize: '1.08rem', color: '#2D433D', fontWeight: '800' }}>9:00 AM - 6:00 PM (Full Day Pass)</strong>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Guests</label>
                    <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))}>
                      <option value="1">1 Guest</option>
                      <option value="2">2 Guests</option>
                      <option value="3">3 Guests</option>
                      <option value="4">4 Guests</option>
                      <option value="5">5 Guests</option>
                      <option value="6">6 Guests</option>
                      <option value="8">8+ Guests (Group Pass)</option>
                    </select>
                  </div>
                  
                  {bookingDates.checkIn && bookingDates.checkOut && (
                    <div className="price-summary" style={{ padding: '18px 20px', borderRadius: '16px', margin: '22px 0' }}>
                      <div className="price-row">
                        <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>Total Amount</span>
                        <strong style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1b4332' }}>₹{calculateTotalPrice()}</strong>
                      </div>
                    </div>
                  )}

                  <div className="booking-actions-group" style={{ display: 'flex', gap: '14px', marginTop: '26px' }}>
                    <button type="submit" disabled={isProcessing} className="btn-primary" style={{ flex: '1.8', padding: '16px 24px', borderRadius: '50px', fontSize: '1.08rem', fontWeight: '800' }}>
                      {isProcessing ? 'Processing...' : 'Continue to Payment'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleResetBookingForm} 
                      className="cancel-booking-form-btn"
                      style={{ flex: '1', padding: '16px 20px', borderRadius: '50px', fontSize: '1.02rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                <p className="no-charge">Payment details are entered only in Razorpay Checkout. If online payment is unavailable, your request stays pending.</p>
              </div>
            </div>
          </div>
        </div>

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

                <button 
                  type="button" 
                  onClick={() => toggleNativeFullscreen()} 
                  className="zoom-btn" 
                  style={{ background: '#d4af37', color: '#1a1a1a', borderColor: '#d4af37', fontWeight: '800' }}
                  title="Toggle Fullscreen Window Mode"
                >
                  <i className="fa-solid fa-expand"></i> Fullscreen Window ⛶
                </button>
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
        {/* LUXURY HOTEL BOOKING SUCCESS ANIMATION OVERLAY */}
        {showBookingAnimation && (
          <div className="booking-success-overlay">
            <div className="booking-success-container">
              {/* Sparkle Particles Burst */}
              <div className="confetti-burst">
                {[...Array(14)].map((_, i) => (
                  <div 
                    key={i} 
                    className="sparkle-particle" 
                    style={{
                      left: `${8 + i * 6.8}%`,
                      animationDelay: `${(i % 5) * 0.25}s`,
                      background: i % 2 === 0 ? '#d4af37' : '#10b981'
                    }}
                  />
                ))}
              </div>

              {/* Glowing Success Ring Icon */}
              <div className="success-ring-box">
                <i className="fa-solid fa-circle-check success-check-icon"></i>
              </div>

              <h2 style={{ color: '#d4af37', fontFamily: 'var(--font-heading, serif)', fontSize: '1.8rem', margin: '0 0 6px 0', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                Booking Confirmed!
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', margin: '0 0 16px 0' }}>
                Your stay reservation at <strong>{property?.name}</strong> is officially locked & confirmed.
              </p>

              {/* Hotel Booking Ticket Voucher */}
              <div className="booking-ticket-card">
                <div className="ticket-confirmed-stamp">
                  <i className="fa-solid fa-shield-check" style={{ marginRight: '4px' }}></i> RESERVED
                </div>

                <div className="ticket-header-row">
                  <img 
                    src={property?.image || (property?.photos && property?.photos[0] ? property.photos[0] : 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80')} 
                    alt={property?.name} 
                    className="ticket-prop-thumb" 
                  />
                  <div>
                    <h4 className="ticket-prop-name">{property?.name}</h4>
                    <p className="ticket-prop-loc"><i className="fa-solid fa-location-dot" style={{ color: '#d4af37', marginRight: '4px' }}></i> {property?.location}</p>
                  </div>
                </div>

                <div className="ticket-details-grid">
                  <div className="ticket-field">
                    <label>CHECK-IN</label>
                    <span>{bookingDates.checkIn || '2026-08-10'}</span>
                  </div>
                  <div className="ticket-field">
                    <label>CHECK-OUT</label>
                    <span>{bookingDates.checkOut || bookingDates.checkIn || '2026-08-12'}</span>
                  </div>
                  <div className="ticket-field">
                    <label>GUEST COUNT</label>
                    <span>{guests} Guest(s)</span>
                  </div>
                  <div className="ticket-field">
                    <label>TOTAL PAID</label>
                    <span style={{ color: '#10b981' }}>₹{calculateTotalPrice().toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Stepper Progress */}
              <div className="booking-stepper-box">
                <div className="stepper-step">
                  <div className="stepper-icon-circle"><i className="fa-solid fa-credit-card"></i></div>
                  <span>Paid</span>
                </div>
                <div className="stepper-step">
                  <div className="stepper-icon-circle"><i className="fa-solid fa-hotel"></i></div>
                  <span>Room Locked</span>
                </div>
                <div className="stepper-step">
                  <div className="stepper-icon-circle"><i className="fa-solid fa-qrcode"></i></div>
                  <span>Pass Issued</span>
                </div>
              </div>

              {/* Redirect Progress Bar */}
              <div className="redirect-progress-bar-wrap">
                <div className="redirect-progress-bar-fill"></div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '8px', display: 'block' }}>
                Redirecting to your Guest Portal in 3 seconds...
              </span>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </>
  );
};

export default PropertyDetails;
