import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { properties } from '../../data/mockData';
import './PropertyGrid.css';
import './MapContainer.css';
import { API_BASE_URL } from '../../config';
import { formatGoogleMapsDirectionsUrl } from '../../utils/locationUtils';

// Predefined coordinates for common tourist locations to ensure instant response
// Predefined coordinates for common tourist locations and Mahabaleshwar landmarks
const LOCATION_COORDINATES = {
  "Venna Lake": { lat: 17.9312, lon: 73.6589 },
  "Kate's Point": { lat: 17.9201, lon: 73.6442 },
  "Kate Point": { lat: 17.9201, lon: 73.6442 },
  "Wilson Point": { lat: 17.9285, lon: 73.6631 },
  "Lingmala": { lat: 17.9180, lon: 73.6380 },
  "Lingmala Waterfall": { lat: 17.9180, lon: 73.6380 },
  "Elphinstone": { lat: 17.9350, lon: 73.6700 },
  "Elphinstone Point": { lat: 17.9350, lon: 73.6700 },
  "Arthur's Seat": { lat: 17.9625, lon: 73.6400 },
  "Arthur Seat": { lat: 17.9625, lon: 73.6400 },
  "Lodwick Point": { lat: 17.9210, lon: 73.6300 },
  "Parsi Point": { lat: 17.9230, lon: 73.8010 },
  "Table Land": { lat: 17.9280, lon: 73.8090 },
  "Panchgani": { lat: 17.9238, lon: 73.8050 },
  "Tapola": { lat: 17.7600, lon: 73.6900 },
  "Bhilar": { lat: 17.9050, lon: 73.7750 },
  "Metgutad": { lat: 17.9220, lon: 73.7100 },
  "Khinger": { lat: 17.9150, lon: 73.7900 },
  "Old Mahabaleshwar": { lat: 17.9480, lon: 73.6580 },
  "Mahabaleshwar Market": { lat: 17.9265, lon: 73.6560 },
  "Mahabaleshwar": { lat: 17.9258, lon: 73.6510 },
  "Shimla": { lat: 31.1048, lon: 77.1734 },
  "Munnar": { lat: 10.0889, lon: 77.0595 },
  "Manali": { lat: 32.2396, lon: 77.1887 },
  "Gulmarg": { lat: 34.0484, lon: 74.3805 },
  "Ooty": { lat: 11.4102, lon: 76.6950 },
  "Nainital": { lat: 29.3919, lon: 79.4542 },
  "Lonavala": { lat: 18.7557, lon: 73.4091 },
  "Pune": { lat: 18.5204, lon: 73.8567 },
  "Pawna": { lat: 18.6878, lon: 73.4832 },
  "Mulshi": { lat: 18.5083, lon: 73.5132 },
  "Lavasa": { lat: 18.4088, lon: 73.5080 },
  "Khandala": { lat: 18.7512, lon: 73.3814 },
  "Baner": { lat: 18.5590, lon: 73.7868 },
  "Shivajinagar": { lat: 18.5314, lon: 73.8446 },
  "Balewadi": { lat: 18.5793, lon: 73.7712 },
  "Wakad": { lat: 18.5985, lon: 73.7635 },
  "Kshitij": { lat: 18.5630, lon: 73.7800 },
  "Orchid": { lat: 18.5793, lon: 73.7712 },
  "Sayaji": { lat: 18.5985, lon: 73.7635 },
  "Bloom": { lat: 18.5775, lon: 73.7745 },
  "Townhouse": { lat: 18.5760, lon: 73.7730 },
  "AUHTEL": { lat: 18.5745, lon: 73.7760 },
  "Balewadi High Street": { lat: 18.5775, lon: 73.7745 },
  "Kamshet": { lat: 18.7583, lon: 73.5604 }
};

// Extract coordinates from lat/lon properties, mapLink, or location string
const parseMapCoordinates = (prop) => {
  if (!prop) return null;

  if (prop.lat && (prop.lon || prop.lng)) {
    const latNum = parseFloat(prop.lat);
    const lonNum = parseFloat(prop.lon ?? prop.lng);
    if (!isNaN(latNum) && !isNaN(lonNum) && latNum !== 0 && lonNum !== 0) {
      return { lat: latNum, lon: lonNum };
    }
  }

  if (prop.mapLink && typeof prop.mapLink === 'string') {
    const link = prop.mapLink;
    
    // Pattern 1: !3d17.9258!4d73.6510 (Google Maps embed / share format)
    const pbMatch = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pbMatch) {
      return { lat: parseFloat(pbMatch[1]), lon: parseFloat(pbMatch[2]) };
    }

    // Pattern 2: @17.9258,73.6510
    const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
    }

    // Pattern 3: q=17.9258,73.6510 or query=17.9258,73.6510 or ll=17.9258,73.6510
    const queryMatch = link.match(/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
    if (queryMatch) {
      return { lat: parseFloat(queryMatch[1]), lon: parseFloat(queryMatch[2]) };
    }

    // Pattern 4: Any lat,lon pair in link
    const genMatch = link.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (genMatch) {
      return { lat: parseFloat(genMatch[1]), lon: parseFloat(genMatch[2]) };
    }
  }

  if (prop.location && typeof prop.location === 'string') {
    const locMatch = prop.location.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (locMatch) {
      return { lat: parseFloat(locMatch[1]), lon: parseFloat(locMatch[2]) };
    }
  }

  return null;
};

// Geocoding helper with mapLink coordinate parsing + OpenStreetMap lookup
const resolveCoordinates = async (property) => {
  const parsed = parseMapCoordinates(property);
  if (parsed) {
    return { ...property, lat: parsed.lat, lon: parsed.lon };
  }

  const loc = property.location;
  if (!loc) return { ...property, lat: 17.9258, lon: 73.6510 };
  
  const normalized = loc.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (normalized.includes(key.toLowerCase())) {
      const seed = (property.name || property.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const latOffset = ((seed % 100) / 100 - 0.5) * 0.012;
      const lonOffset = (((seed * 13) % 100) / 100 - 0.5) * 0.012;
      return {
        ...property,
        lat: coords.lat + latOffset,
        lon: coords.lon + lonOffset
      };
    }
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}`);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        ...property,
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
  } catch (err) {
    console.error("Nominatim geocoding failed for location:", loc, err);
  }

  return {
    ...property,
    lat: 17.9258,
    lon: 73.6510
  };
};

// Horizontal card for the Home Page split view next to the map
const SplitPropertyCard = ({ property, isSelected, isHovered, onSelect, onHover, onLeave }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPriceNum = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '8500');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;
  const originalPrice = `₹${Math.round(rawPriceNum * 1.25).toLocaleString('en-IN')}`;
  const reviewsCount = property.reviewsCount || (((String(property._id || property.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 80) + 35);

  const defaultAmenities = property.amenities && property.amenities.length > 0 
    ? property.amenities.slice(0, 3) 
    : ['Pool', 'WiFi', 'View'];

  const handleCardClick = (e) => {
    if (e) e.stopPropagation();
    const propertyId = property._id || property.id;
    navigate(`/property/${propertyId}`, { state: { property } });
  };

  const handleBookNow = (e) => {
    if (e) e.stopPropagation();
    const propertyId = property._id || property.id;
    
    const searchParams = new URLSearchParams(location.search);
    const qCheckIn = searchParams.get('checkIn');
    const qCheckOut = searchParams.get('checkOut');
    const qGuests = searchParams.get('guests');

    const query = new URLSearchParams();
    if (qCheckIn) query.append('checkIn', qCheckIn);
    if (qCheckOut) query.append('checkOut', qCheckOut);
    if (qGuests) query.append('guests', qGuests);
    query.append('autoBook', 'true');

    const targetUrl = `/property/${propertyId}?${query.toString()}`;
    navigate(targetUrl, { state: { property } });
  };

  return (
    <div 
      id={`split-card-${property.id}`}
      className={`split-grid-card ${isSelected ? 'selected-card' : ''} ${isHovered ? 'hovered-card' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={onLeave}
    >
      <div className="split-card-img-wrapper">
        <img src={property.image} alt={property.name} loading="lazy" />
        <span className="split-card-tag">
          ☀️ Day & 🌙 Night
        </span>
      </div>

      <div className="split-card-info">
        <div className="split-card-top">
          <div className="split-card-meta">
            <span className="split-card-type">{property.type?.toUpperCase() || 'STAY'}</span>
            <span className="split-card-rating">
              <i className="fa-solid fa-star" style={{ color: '#d4af37' }}></i>
              <b>{property.rating || '4.8'}</b>
              <span className="split-card-reviews">({reviewsCount})</span>
            </span>
          </div>

          <h3 className="split-card-title">{property.name}</h3>
          <p className="split-card-location">
            <i className="fa-solid fa-location-dot"></i>
            <span>{property.location}</span>
          </p>
        </div>

        <div className="split-card-bottom">
          <div className="split-card-price-container">
            <span className="split-card-orig-price">{originalPrice}</span>
            <div className="split-card-final-price">
              {numericPrice} <span className="split-price-unit">/ night</span>
            </div>
          </div>

          <div className="split-card-actions" style={{ display: 'flex', gap: '6px' }}>
            <button 
              type="button" 
              className="btn-locate-map" 
              onClick={handleCardClick}
              title="View stay details"
              style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', color: '#ffffff', border: 'none' }}
            >
              <i className="fa-solid fa-eye" style={{ color: '#f5d061' }}></i>
              <span>View Details</span>
            </button>

            <button 
              type="button" 
              className="btn-locate-map" 
              onClick={(e) => {
                e.stopPropagation();
                onSelect(property);
              }}
              title="Locate hotel and zoom on interactive map"
            >
              <i className="fa-solid fa-location-dot" style={{ color: '#d4af37' }}></i>
              <span>Map Pin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Redesigned Luxury Property Card for standalone Explore page
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

const LuxuryPropertyCard = ({ property, index = 0, isSelected, isHovered, onSelect, onHover, onLeave, isWishlisted, onToggleWishlist, onOpenFullView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHeartBouncing, setIsHeartBouncing] = useState(false);

  const rawPriceNum = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '8500');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;
  const originalPrice = `₹${Math.round(rawPriceNum * 1.25).toLocaleString('en-IN')}`;
  const reviewsCount = property.reviewsCount || (((String(property._id || property.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 80) + 35);

  const handleViewDetails = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const propertyId = property._id || property.id;
    navigate(`/property/${propertyId}`, { state: { property } });
  };

  const handleHeartClick = (e) => {
    e.stopPropagation();
    setIsHeartBouncing(true);
    setTimeout(() => setIsHeartBouncing(false), 350);
    if (onToggleWishlist) {
      onToggleWishlist(property.id);
    }
  };

  return (
    <div 
      id={`split-card-${property.id}`}
      className={`luxury-explore-card ${isSelected ? 'selected-card' : ''} ${isHovered ? 'hovered-card' : ''}`}
      onClick={handleViewDetails}
      onMouseEnter={() => onHover && onHover(property.id)}
      onMouseLeave={onLeave}
      style={{
        animationDelay: `${(index % 10) * 80}ms`
      }}
    >
      {/* 1. IMAGE AT TOP OF CARD */}
      <div 
        onClick={(e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (onOpenFullView) onOpenFullView(property);
        }}
        title="Click image to view full screen"
        className="card-img-box"
        style={{ position: 'relative', height: '220px', overflow: 'hidden', cursor: 'zoom-in', background: '#f1f5f9' }}
      >
        {!imageLoaded && (
          <div className="skeleton-box" style={{ position: 'absolute', inset: 0, zIndex: 1 }}></div>
        )}

        <img 
          src={property.image} 
          alt={property.name} 
          loading="lazy" 
          onLoad={() => setImageLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imageLoaded ? 1 : 0
          }} 
        />

        {/* Hover Quick Action Overlay */}
        <div className="pro-card-hover-overlay">
          <span className="pro-hover-action-btn">
            View Details <i className="fa-solid fa-arrow-right"></i>
          </span>
        </div>
        
        {/* Category Pill Tag */}
        <span className="pro-type-badge-media">
          {property.tag ? property.tag.toUpperCase() : (property.type || 'STAY')}
        </span>

        {/* Wishlist Heart Button */}
        <button 
          type="button"
          onClick={handleHeartClick}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`pro-wishlist-btn ${isWishlisted ? 'saved' : ''} ${isHeartBouncing ? 'heart-bounce' : ''}`}
        >
          <i className={`fa-${isWishlisted ? 'solid' : 'regular'} fa-heart`}></i>
        </button>
      </div>

      {/* 2. CARD BODY: PRICE BELOW IMAGE & DETAILS */}
      <div style={{ padding: '18px 20px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          {/* Price Section Directly Below Image */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.8rem' }}>{originalPrice}</span>
              <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#1b4332' }}>{numericPrice}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>/ night</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fdfbf7', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '2px 8px', borderRadius: '12px' }}>
              <i className="fa-solid fa-star" style={{ color: '#d4af37', fontSize: '0.85rem' }}></i>
              <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#0f172a' }}>{property.rating || '4.8'}</span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({reviewsCount})</span>
            </div>
          </div>

          {/* Property Name */}
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '800',
            color: '#0f172a',
            margin: '0 0 6px 0',
            lineHeight: '1.3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }} title={property.name}>
            {property.name}
          </h3>

          {/* Location with Pin */}
          <p style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#64748b',
            fontSize: '0.85rem',
            margin: '0 0 14px 0',
            fontWeight: '500'
          }}>
            <i className="fa-solid fa-location-dot" style={{ color: '#d4af37' }}></i>
            <span>{property.location}</span>
          </p>
        </div>

        {/* 3. BUTTONS: VIEW DETAILS & MAP PIN */}
        <div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn-animated"
              onClick={handleViewDetails}
              title="View property details"
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '11px 12px',
                borderRadius: '24px',
                fontSize: '0.86rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(27, 67, 50, 0.25)',
                transition: 'all 0.25s ease'
              }}
            >
              <i className="fa-solid fa-eye" style={{ color: '#f5d061' }}></i> View Details
            </button>

            <button
              type="button"
              className="btn-animated"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(property);
              }}
              title="Locate hotel on map"
              style={{
                flex: 1,
                background: '#f8fafc',
                color: '#1b4332',
                border: '1px solid #cbd5e1',
                padding: '11px 12px',
                borderRadius: '24px',
                fontSize: '0.86rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-location-dot" style={{ color: '#d4af37' }}></i> Map Pin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Brand New Featured Card for All Hotels List Explorer
const ViewAllHotelsCard = ({ totalCount, isExpanded, onToggleExpand }) => {
  return (
    <div 
      className="view-all-hotels-special-card"
      onClick={onToggleExpand}
      style={{
        background: 'linear-gradient(135deg, #0b110f 0%, #1b4332 100%)',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '2px solid rgba(212, 175, 55, 0.4)',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        color: '#ffffff',
        cursor: 'pointer',
        minHeight: '380px',
        position: 'relative',
        transition: 'all 0.35s ease'
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(212, 175, 55, 0.18) 0%, transparent 60%)',
        pointerEvents: 'none'
      }}></div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <span style={{
          display: 'inline-block',
          background: 'rgba(212, 175, 55, 0.2)',
          color: '#d4af37',
          border: '1px solid rgba(212, 175, 55, 0.4)',
          padding: '4px 14px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: '800',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '16px'
        }}>
          {isExpanded ? 'Full Collection Shown' : 'Complete Collection'}
        </span>

        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.55rem',
          fontWeight: '800',
          color: '#ffffff',
          lineHeight: '1.3',
          margin: '0 0 12px 0'
        }}>
          Explore All <span style={{ color: '#d4af37' }}>{totalCount}+</span> Luxury Stays & Villas
        </h3>

        <p style={{ color: '#a3b18a', fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 18px 0' }}>
          Browse our complete list of hill view villas, forest cabins, and heritage hotels across Mahabaleshwar.
        </p>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#e2e8f0' }}>🏡 Luxury Villas</span>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#e2e8f0' }}>🌊 Lake View Resorts</span>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#e2e8f0' }}>🌲 Mountain Cabins</span>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #d4af37 0%, #b38b19 100%)',
            color: '#0b110f',
            border: 'none',
            padding: '13px 18px',
            borderRadius: '30px',
            fontWeight: '800',
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(212, 175, 55, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
        >
          <i className={isExpanded ? "fa-solid fa-compress" : "fa-solid fa-list-check"}></i>
          <span>{isExpanded ? "Show Featured Top 3" : `View All (${totalCount} Hotels)`}</span>
          <i className={isExpanded ? "fa-solid fa-chevron-up" : "fa-solid fa-arrow-right"}></i>
        </button>
      </div>
    </div>
  );
};

const PropertyGrid = ({ isHomePage = false }) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortOption, setSortOption] = useState('low-high');
  const [wishlistMap, setWishlistMap] = useState({});
  const [dbProperties, setDbProperties] = useState([]);
  const [resolvedAllProperties, setResolvedAllProperties] = useState(properties);
  
  // Search, View, Selection, and Layout states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null);
  const [showViewAllModal, setShowViewAllModal] = useState(false);
  const [showAllList, setShowAllList] = useState(false);
  const [fullViewImage, setFullViewImage] = useState(null);

  const openFullViewModal = (property) => {
    const propertyPhotos = property.photos && property.photos.length > 0 ? property.photos : [property.image];
    setFullViewImage({
      url: property.image,
      title: property.name,
      location: property.location,
      price: property.price,
      propertyId: property._id || property.id,
      photos: propertyPhotos,
      activeIndex: 0
    });
  };

  // Advanced Filter States
  const [selectedView, setSelectedView] = useState('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState(50000);
  const [minRatingFilter, setMinRatingFilter] = useState(0);

  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);
  const markersMapRef = useRef({});
  const { search } = useLocation();
  const navigate = useNavigate();

  const toggleWishlist = (propId) => {
    setWishlistMap(prev => ({
      ...prev,
      [propId]: !prev[propId]
    }));
  };

  // Sync search parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(search);
    const query = params.get('search');
    if (query) {
      setSearchQuery(query);
    }
  }, [search]);

  // Fetch Database properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/properties/all`);
        if (response.ok) {
          const data = await response.json();
          const mappedData = data.map(prop => ({
            id: prop._id,
            _id: prop._id,
            name: prop.name,
            location: prop.location,
            type: prop.type,
            price: prop.price ? `₹${prop.price.toLocaleString('en-IN')}` : "₹10,000",
            mapLink: prop.mapLink || '',
            amenities: prop.amenities || [],
            photos: prop.photos || [],
            videos: prop.videos || [],
            rating: prop.rating || 4.8,
            reviewsCount: prop.reviewsCount || 85,
            tag: "New",
            image: prop.photos && prop.photos.length > 0 
              ? (prop.photos[0].startsWith('http') || prop.photos[0].startsWith('data:') ? prop.photos[0] : "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800")
              : "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800"
          }));
          
          const withCoords = await Promise.all(mappedData.map(p => resolveCoordinates(p)));
          setDbProperties(withCoords);
        }
      } catch (err) {
        console.error('Failed to fetch properties:', err);
      }
    };
    fetchProperties();
  }, []);

  // Combine mock properties and db properties
  useEffect(() => {
    const prepareAll = async () => {
      const mockWithCoords = await Promise.all(properties.map(p => resolveCoordinates(p)));
      
      if (dbProperties.length > 0) {
        const merged = [...dbProperties, ...mockWithCoords.filter(mp => !dbProperties.some(dp => dp.name === mp.name))];
        setResolvedAllProperties(merged);
      } else {
        setResolvedAllProperties(mockWithCoords);
      }
    };
    prepareAll();
  }, [dbProperties]);

  // Select a hotel: Center map, fly to lat/lon, scroll to map viewport, and open marker popup
  const selectHotelOnMap = (property) => {
    if (!property) return;
    setSelectedPropertyId(property.id);

    const mapElement = document.getElementById('leaflet-map');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (mapRef.current && property.lat && (property.lon || property.lng)) {
      const lng = property.lon ?? property.lng;
      mapRef.current.flyTo([property.lat, lng], 14.5, { duration: 1.5 });

      setTimeout(() => {
        const marker = markersMapRef.current[property.id];
        if (marker) {
          marker.openPopup();
        }
      }, 500);
    }
  };

  // Filter & Sort properties dynamically by Category + Search + View + Price + Rating + Sort Option
  const filteredProperties = React.useMemo(() => {
    const cleanSearch = searchQuery ? searchQuery.trim().toLowerCase() : '';

    let result = resolvedAllProperties.filter(prop => {
      // 1. Category / Type filter
      const matchesFilter = activeFilter === 'All' || prop.type === activeFilter || (activeFilter === 'Cottage' && prop.type === 'Cottage') || (activeFilter === 'Farm House' && (prop.type === 'Farm House' || prop.type === 'Villa'));
      
      // 2. Comprehensive Search query filter (matches name, location, type, amenities, view, and description)
      let matchesSearch = true;
      if (cleanSearch) {
        const nameMatch = prop.name ? prop.name.toLowerCase().includes(cleanSearch) : false;
        const locationMatch = prop.location ? prop.location.toLowerCase().includes(cleanSearch) : false;
        const typeMatch = prop.type ? prop.type.toLowerCase().includes(cleanSearch) : false;
        const descMatch = prop.description ? prop.description.toLowerCase().includes(cleanSearch) : false;
        const viewMatch = prop.viewType ? prop.viewType.toLowerCase().includes(cleanSearch) : false;
        const tagMatch = prop.tag ? prop.tag.toLowerCase().includes(cleanSearch) : false;
        const amenitiesMatch = Array.isArray(prop.amenities) ? prop.amenities.some(am => am.toLowerCase().includes(cleanSearch)) : false;

        matchesSearch = nameMatch || locationMatch || typeMatch || descMatch || viewMatch || tagMatch || amenitiesMatch;
      }

      // 3. Price Filter
      const rawPriceNum = parseInt(prop.price?.toString().replace(/[^0-9]/g, '') || '10000');
      const matchesPrice = rawPriceNum <= maxPriceFilter;

      // 4. View Type Filter (View functionality)
      let matchesView = true;
      if (selectedView !== 'All') {
        const propText = (prop.name + ' ' + prop.location + ' ' + (prop.viewType || '') + ' ' + (prop.description || '')).toLowerCase();
        const viewKey = selectedView.toLowerCase().replace(' view', '');
        if (viewKey === 'lake') {
          matchesView = propText.includes('lake') || propText.includes('venna') || propText.includes('water');
        } else if (viewKey === 'mountain') {
          matchesView = propText.includes('mountain') || propText.includes('hill') || propText.includes('peak') || propText.includes('chalet') || propText.includes('point');
        } else if (viewKey === 'valley') {
          matchesView = propText.includes('valley') || propText.includes('cliff') || propText.includes('view') || propText.includes('kate') || propText.includes('arthur');
        } else if (viewKey === 'forest') {
          matchesView = propText.includes('forest') || propText.includes('manor') || propText.includes('nature') || propText.includes('wood') || propText.includes('lingmala');
        } else {
          matchesView = propText.includes(viewKey);
        }
      }

      // 5. Rating Filter
      const matchesRating = minRatingFilter === 0 || (prop.rating && prop.rating >= minRatingFilter);

      return matchesFilter && matchesSearch && matchesPrice && matchesView && matchesRating;
    });

    if (sortOption === 'low-high') {
      result.sort((a, b) => {
        const valA = parseInt(a.price.toString().replace(/[^0-9]/g, '') || '0');
        const valB = parseInt(b.price.toString().replace(/[^0-9]/g, '') || '0');
        return valA - valB;
      });
    } else if (sortOption === 'high-low') {
      result.sort((a, b) => {
        const valA = parseInt(a.price.toString().replace(/[^0-9]/g, '') || '0');
        const valB = parseInt(b.price.toString().replace(/[^0-9]/g, '') || '0');
        return valB - valA;
      });
    } else if (sortOption === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [resolvedAllProperties, activeFilter, searchQuery, sortOption, selectedView, maxPriceFilter, minRatingFilter]);

  const visibleProperties = filteredProperties;

  // Handle Search Location input submission
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery || !searchQuery.trim()) return;

    const term = searchQuery.trim().toLowerCase();
    
    const directMatches = filteredProperties.filter(p => 
      p.name.toLowerCase().includes(term) || p.location.toLowerCase().includes(term)
    );

    if (directMatches.length > 0) {
      if (directMatches.length === 1) {
        selectHotelOnMap(directMatches[0]);
      } else if (mapRef.current && window.L) {
        const L = window.L;
        const validCoords = directMatches.filter(p => p.lat && (p.lon || p.lng));
        if (validCoords.length > 0) {
          const group = L.featureGroup(validCoords.map(p => L.marker([p.lat, p.lon ?? p.lng])));
          mapRef.current.fitBounds(group.getBounds().pad(0.2));
        }
      }
      return;
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0 && mapRef.current) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        mapRef.current.flyTo([lat, lon], 12, { duration: 1.8 });
      }
    } catch (err) {
      console.error("Nominatim search failed:", err);
    }
  };

  // Setup Leaflet map instance
  useEffect(() => {
    let checkInterval;

    const initMap = () => {
      if (!window.L) return false;
      const mapElement = document.getElementById('leaflet-map');
      if (!mapElement) return false;
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize();
        } catch (e) {}
        return true;
      }

      const L = window.L;

      let initialLat = 17.9258;
      let initialLon = 73.6510;

      if (filteredProperties.length > 0) {
        const firstValid = filteredProperties.find(p => p.lat && (p.lon || p.lng));
        if (firstValid) {
          initialLat = firstValid.lat;
          initialLon = firstValid.lon ?? firstValid.lng;
        }
      }

      try {
        const map = L.map('leaflet-map', {
          zoomControl: false,
          scrollWheelZoom: true
        }).setView([initialLat, initialLon], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        markersGroupRef.current = L.featureGroup().addTo(map);
        mapRef.current = map;
        return true;
      } catch (e) {
        console.error("Leaflet map setup error:", e);
        return false;
      }
    };

    if (!initMap()) {
      checkInterval = setInterval(() => {
        if (initMap()) {
          clearInterval(checkInterval);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          console.warn('Map removal error:', err);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Update map markers when filteredProperties change
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !window.L) return;

    const L = window.L;
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;

    markersGroup.clearLayers();
    markersMapRef.current = {};

    const markersList = [];

    filteredProperties.forEach((property) => {
      const lat = property.lat;
      const lon = property.lon ?? property.lng;

      if (!lat || !lon) return;

      const isSel = selectedPropertyId === property.id;

      const customIcon = L.divIcon({
        className: 'custom-hotel-location-marker',
        html: `<div id="marker-${property.id}" class="map-hotel-location-pin ${isSel ? 'marker-active' : ''}" title="${property.name}">
                 <div class="pin-icon-inner">
                   <i class="fa-solid fa-location-dot"></i>
                 </div>
                 <div class="pin-pulse-wave"></div>
               </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44]
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      const popupContent = `
        <div class="popup-hotel-card">
          <img src="${property.image}" alt="${property.name}" class="popup-hotel-image" />
          <div class="popup-hotel-details">
            <div class="popup-hotel-type">${property.type} • ★ ${property.rating} (${property.reviewsCount || 45} reviews)</div>
            <div class="popup-hotel-name">${property.name}</div>
            <div class="popup-hotel-price">${property.price}</div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <a href="/property/${property._id || property.id}" class="popup-hotel-link popup-book-stay-link" style="flex: 1; text-align: center;">Book Stays</a>
              <a href="${formatGoogleMapsDirectionsUrl(property.mapLink, property.name, property.location)}" target="_blank" rel="noopener noreferrer" class="popup-hotel-link" style="flex: 1; text-align: center; background: #d4af37; color: #1a1a1a;">Directions</a>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -10)
      });

      marker.on('popupopen', () => {
        const popupElement = marker.getPopup().getElement();
        if (popupElement) {
          const bookBtn = popupElement.querySelector('.popup-book-stay-link');
          if (bookBtn) {
            bookBtn.onclick = (e) => {
              e.preventDefault();
              const token = sessionStorage.getItem('token') || localStorage.getItem('token');
              const propertyId = property._id || property.id;
              if (!token) {
                navigate('/signin', { state: { from: `/property/${propertyId}`, property } });
              } else {
                navigate(`/property/${propertyId}`, { state: { property } });
              }
            };
          }
        }
      });

      marker.on('mouseover', () => {
        setHoveredPropertyId(property.id);
        const bubble = document.getElementById(`marker-${property.id}`);
        if (bubble) bubble.classList.add('marker-active');
      });

      marker.on('mouseout', () => {
        setHoveredPropertyId(null);
        if (selectedPropertyId !== property.id) {
          const bubble = document.getElementById(`marker-${property.id}`);
          if (bubble) bubble.classList.remove('marker-active');
        }
      });

      marker.on('click', () => {
        setSelectedPropertyId(property.id);
        const cardElem = document.getElementById(`split-card-${property.id}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      markersGroup.addLayer(marker);
      markersList.push(marker);
      markersMapRef.current[property.id] = marker;
    });

    if (markersList.length > 0 && !selectedPropertyId) {
      if (markersList.length === 1) {
        const singleMarkerLatLng = markersList[0].getLatLng();
        map.setView(singleMarkerLatLng, 12);
        const singleProp = filteredProperties[0];
        if (singleProp && markersMapRef.current[singleProp.id]) {
          setTimeout(() => {
            markersMapRef.current[singleProp.id]?.openPopup();
          }, 300);
        }
      } else {
        const boundsGroup = L.featureGroup(markersList);
        map.fitBounds(boundsGroup.getBounds().pad(0.25), { maxZoom: 13 });
      }
    }
  }, [filteredProperties, selectedPropertyId]);

  // Sync hovered state to marker DOM elements
  useEffect(() => {
    if (!hoveredPropertyId) return;
    const bubble = document.getElementById(`marker-${hoveredPropertyId}`);
    if (bubble) bubble.classList.add('marker-active');

    return () => {
      if (hoveredPropertyId && selectedPropertyId !== hoveredPropertyId) {
        const b = document.getElementById(`marker-${hoveredPropertyId}`);
        if (b) b.classList.remove('marker-active');
      }
    };
  }, [hoveredPropertyId, selectedPropertyId]);

  return (
    <section className="property-grid-section" id="explore" style={{ padding: isHomePage ? '80px 0' : '40px 0 80px 0' }}>
      {/* Header & Controls Section */}
      <div className="section-header" style={{ maxWidth: '1440px', margin: '0 auto 30px auto', padding: '0 20px', textAlign: 'center' }}>
        <span className="section-subtitle" style={{ letterSpacing: '3px', color: '#d4af37', fontWeight: '800', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.88rem' }}>
          {isHomePage ? 'Our Curated Collection' : 'Explore Stays'}
        </span>
        <h2 style={{ fontSize: '2.6rem', color: '#0f382c', margin: '0 0 20px 0', fontFamily: 'var(--font-heading)', fontWeight: '800', letterSpacing: '0.5px' }}>
          {isHomePage ? (
            <>Explore <span style={{ color: '#d4af37' }}>Exceptional</span> Stays</>
          ) : (
            <>Stay in <span style={{ color: '#d4af37' }}>Nature</span>, Live in <span style={{ color: '#d4af37' }}>Luxury</span></>
          )}
        </h2>
        
        {/* Unified Luxury Control Bar */}
        <div className="map-control-bar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '60px',
          padding: '12px 26px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          margin: '0 auto 28px auto',
          width: 'fit-content',
          maxWidth: '95%'
        }}>
          {/* Category Pills Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['All', 'Villa', 'Hotel', 'Cabin', 'Resort'].map(tab => (
              <button 
                key={tab}
                className={`filter-btn ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(tab);
                  setSelectedPropertyId(null);
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '25px',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  border: activeFilter === tab ? 'none' : '1px solid #c8d3cc',
                  background: activeFilter === tab ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : '#f4f6f4',
                  color: activeFilter === tab ? '#ffffff' : '#1b4332',
                  boxShadow: activeFilter === tab ? '0 4px 14px rgba(27, 67, 50, 0.3)' : '0 2px 5px rgba(0,0,0,0.02)'
                }}
              >
                {tab === 'All' && <><i className="fa-solid fa-border-all" style={{ marginRight: '6px' }}></i>All</>}
                {tab === 'Villa' && <><i className="fa-solid fa-house-chimney-window" style={{ marginRight: '6px' }}></i>Villas</>}
                {tab === 'Hotel' && <><i className="fa-solid fa-hotel" style={{ marginRight: '6px' }}></i>Hotels</>}
                {tab === 'Cabin' && <><i className="fa-solid fa-tree" style={{ marginRight: '6px' }}></i>Cabins</>}
                {tab === 'Resort' && <><i className="fa-solid fa-spa" style={{ marginRight: '6px' }}></i>Resorts</>}
              </button>
            ))}
          </div>

          {/* Search Input Box */}
          <form onSubmit={handleSearchSubmit} className="search-input-wrapper" style={{ margin: 0, border: '1px solid #d4af37', borderRadius: '30px', background: '#fdfbf7', padding: '0', width: '240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#d4af37', fontSize: '0.85rem', position: 'absolute', left: '12px' }}></i>
            <input 
              type="text" 
              placeholder="Search stay or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-location-input"
              style={{ border: 'none', outline: 'none', background: 'transparent', padding: '6px 30px 6px 36px', fontSize: '0.85rem', fontWeight: '600', color: '#1b4332', boxShadow: 'none', width: '100%' }}
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}
                title="Clear Search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </form>

          {/* Filter Modal Toggle Button */}
          <button 
            type="button"
            onClick={() => setShowViewAllModal(true)}
            style={{
              background: '#ffffff',
              border: '1px solid #c8d3cc',
              color: '#1b4332',
              fontWeight: '700',
              padding: '7px 18px',
              borderRadius: '30px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-sliders" style={{ color: '#d4af37' }}></i> Filters
          </button>
        </div>
      </div>

      {/* 1. FIRST SECTION: HOTEL CARDS GRID */}
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 20px' }}>
        {filteredProperties.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginBottom: '28px'
          }}>
            {visibleProperties.map((property, idx) => (
              <LuxuryPropertyCard
                key={property.id}
                index={idx}
                property={property}
                isSelected={selectedPropertyId === property.id}
                isHovered={hoveredPropertyId === property.id}
                onSelect={selectHotelOnMap}
                onHover={setHoveredPropertyId}
                onLeave={() => setHoveredPropertyId(null)}
                isWishlisted={!!wishlistMap[property.id || property._id]}
                onToggleWishlist={() => toggleWishlist(property.id || property._id)}
                onOpenFullView={openFullViewModal}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#666', background: '#fff', borderRadius: '20px', marginBottom: '30px' }}>
            <i className="fa-solid fa-hotel" style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#d4af37' }}></i>
            <h3 style={{ fontSize: '1.4rem', color: '#1a1a1a' }}>No luxury stays matching search</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>Try searching another property name or selecting a different category filter above.</p>
          </div>
        )}

        {/* 3. INTERACTIVE MAP SECTION PLACED DIRECTLY BELOW THE HOTEL CARDS */}
        <div className="hotel-map-container-below" style={{
          background: '#ffffff',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          marginTop: '20px',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#d4af37', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Interactive Navigation
              </span>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#0f382c', fontWeight: '800' }}>
                <i className="fa-solid fa-map-location-dot" style={{ color: '#d4af37', marginRight: '10px' }}></i>
                Mahabaleshwar Hotel Locations Map
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#666' }}>
                Interactive OpenStreetMap. Click any pin to view hotel photos, details, & live directions.
              </p>
            </div>

            {/* Hotel Quick Select Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select 
                onChange={(e) => {
                  const selected = filteredProperties.find(p => String(p.id) === e.target.value);
                  if (selected) selectHotelOnMap(selected);
                }}
                className="hotel-quick-select"
                style={{
                  padding: '9px 18px',
                  borderRadius: '25px',
                  border: '1.5px solid #d4af37',
                  background: '#fdfbf7',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  color: '#1b4332',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">📍 Jump to Hotel Pin...</option>
                {filteredProperties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.location}</option>
                ))}
              </select>
            </div>
          </div>

          {/* The Leaflet Map container element */}
          <div 
            id="leaflet-map" 
            style={{ 
              width: '100%', 
              height: '520px', 
              borderRadius: '20px', 
              overflow: 'hidden',
              border: '1px solid rgba(27, 67, 50, 0.15)',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)'
            }}
          ></div>
        </div>
      </div>

      {/* Interactive Filter Stays Modal (View, Pricing, & Rating Options) */}
      {showViewAllModal && (
        <div className="view-all-modal-overlay">
          <div className="view-all-modal-content" style={{ maxWidth: '640px', borderRadius: '24px', padding: '28px', color: '#1a1a1a', background: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }} data-lenis-prevent>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#0f382c', fontWeight: '800' }}>
                  <i className="fa-solid fa-sliders" style={{ color: '#d4af37', marginRight: '10px' }}></i>
                  Filter Luxury Stays
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Filter properties by Scenic View, Max Budget Price, & Rating</p>
              </div>
              <button onClick={() => setShowViewAllModal(false)} className="modal-close-btn" style={{ background: '#f4f6f4', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2rem', cursor: 'pointer', color: '#333' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxHeight: '68vh', overflowY: 'auto', paddingRight: '6px' }}>
              
              {/* Section 1: View Functionality (Scenic Views) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#0f382c', marginBottom: '10px' }}>
                  🏞️ Scenic View / Environment:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['All', 'Lake View', 'Mountain View', 'Valley View', 'Forest View'].map(v => (
                    <button 
                      key={v}
                      type="button"
                      onClick={() => setSelectedView(v)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '25px',
                        fontSize: '0.84rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: selectedView === v ? 'none' : '1px solid #c8d3cc',
                        background: selectedView === v ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : '#f4f6f4',
                        color: selectedView === v ? '#ffffff' : '#1b4332',
                        boxShadow: selectedView === v ? '0 4px 14px rgba(27, 67, 50, 0.3)' : 'none'
                      }}
                    >
                      {v === 'All' ? '✨ Any View' : (v === 'Lake View' ? '🌊 Lake View' : v === 'Mountain View' ? '⛰️ Mountain View' : v === 'Valley View' ? '🏞️ Valley View' : '🌲 Forest View')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Pricing Functionality (Price Slider & Presets) */}
              <div style={{ background: '#fdfbf7', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '18px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f382c' }}>💰 Max Price Per Night:</span>
                  <span style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', color: '#ffffff', padding: '5px 16px', borderRadius: '20px', fontWeight: '800', fontSize: '0.88rem' }}>
                    Up to ₹{maxPriceFilter.toLocaleString('en-IN')}
                  </span>
                </div>

                <input 
                  type="range" 
                  min="3000" 
                  max="50000" 
                  step="1000" 
                  value={maxPriceFilter} 
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer', height: '6px' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#888', marginTop: '6px' }}>
                  <span>₹3,000</span>
                  <span>₹25,000</span>
                  <span>₹50,000</span>
                </div>

                {/* Quick Budget Presets */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: '700' }}>Quick Budget:</span>
                  {[
                    { label: 'Under ₹5k', val: 5000 },
                    { label: 'Under ₹12k', val: 12000 },
                    { label: 'Under ₹25k', val: 25000 },
                    { label: 'All Budgets', val: 50000 }
                  ].map(p => (
                    <button 
                      key={p.val}
                      type="button"
                      onClick={() => setMaxPriceFilter(p.val)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: maxPriceFilter === p.val ? 'none' : '1px solid #d4af37',
                        background: maxPriceFilter === p.val ? '#d4af37' : '#ffffff',
                        color: maxPriceFilter === p.val ? '#0b110f' : '#1b4332'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Minimum Rating Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#0f382c', marginBottom: '10px' }}>
                  ⭐ Rating Requirement:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Any Rating', val: 0 },
                    { label: '★ 4.0 & Above', val: 4.0 },
                    { label: '★ 4.5 & Above', val: 4.5 },
                    { label: '★ 4.8 & Above', val: 4.8 }
                  ].map(r => (
                    <button 
                      key={r.val}
                      type="button"
                      onClick={() => setMinRatingFilter(r.val)}
                      style={{
                        padding: '6px 15px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: minRatingFilter === r.val ? 'none' : '1px solid #c8d3cc',
                        background: minRatingFilter === r.val ? '#1b4332' : '#f4f6f4',
                        color: minRatingFilter === r.val ? '#ffffff' : '#1b4332'
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer Action Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              <button 
                type="button"
                onClick={() => {
                  setSelectedView('All');
                  setMaxPriceFilter(50000);
                  setMinRatingFilter(0);
                  setActiveFilter('All');
                  setSearchQuery('');
                }}
                style={{ background: 'transparent', border: '1px solid #ccc', padding: '8px 18px', borderRadius: '30px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', color: '#555' }}
              >
                Reset All Filters
              </button>

              <button 
                type="button"
                onClick={() => setShowViewAllModal(false)}
                style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', color: '#ffffff', border: 'none', padding: '10px 26px', borderRadius: '30px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(27, 67, 50, 0.3)' }}
              >
                Apply Filters ({filteredProperties.length} Stays)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Image Lightbox Modal */}
      {fullViewImage && (
        <div 
          className="image-fullview-modal-backdrop"
          onClick={() => setFullViewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 17, 15, 0.95)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setFullViewImage(null)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '28px',
              background: 'rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              border: '1.5px solid rgba(255, 255, 255, 0.4)',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              fontSize: '1.4rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              transition: 'all 0.25s ease'
            }}
            title="Close Full View (Esc)"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          {/* Prev Photo Arrow */}
          {fullViewImage.photos && fullViewImage.photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = (fullViewImage.activeIndex - 1 + fullViewImage.photos.length) % fullViewImage.photos.length;
                setFullViewImage({
                  ...fullViewImage,
                  url: fullViewImage.photos[newIdx],
                  activeIndex: newIdx
                });
              }}
              style={{
                position: 'absolute',
                left: '24px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                fontSize: '1.4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
              }}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}

          {/* Next Photo Arrow */}
          {fullViewImage.photos && fullViewImage.photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = (fullViewImage.activeIndex + 1) % fullViewImage.photos.length;
                setFullViewImage({
                  ...fullViewImage,
                  url: fullViewImage.photos[newIdx],
                  activeIndex: newIdx
                });
              }}
              style={{
                position: 'absolute',
                right: '24px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                fontSize: '1.4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
              }}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          )}

          {/* Main Full View Container */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '88vh',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              border: '1.5px solid rgba(255, 255, 255, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#0b110f'
            }}
          >
            <img 
              src={fullViewImage.url} 
              alt={fullViewImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: '76vh',
                objectFit: 'contain',
                display: 'block'
              }} 
            />

            {/* Bottom Info Bar Overlay */}
            <div style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(12px)',
              padding: '16px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#f5d061', fontWeight: '800' }}>
                  {fullViewImage.title}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <i className="fa-solid fa-location-dot" style={{ color: '#f5d061', marginRight: '6px' }}></i>
                  {fullViewImage.location} • {fullViewImage.price}/night
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.open(`/property/${fullViewImage.propertyId}`, '_blank');
                }}
                style={{
                  background: 'linear-gradient(135deg, #f5d061 0%, #d4af37 100%)',
                  color: '#0b110f',
                  border: 'none',
                  padding: '11px 24px',
                  borderRadius: '30px',
                  fontWeight: '900',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
                }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Full Hotel Page
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PropertyGrid;
