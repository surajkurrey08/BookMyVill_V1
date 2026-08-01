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

// Horizontal card for the Home Page split view next to the map (Matching User's Screenshot)
const SplitPropertyCard = ({ property, isSelected, isHovered, onSelect, onHover, onLeave }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPriceNum = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '10000');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;

  const handleBookNow = (e) => {
    if (e) e.stopPropagation();
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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

    if (!token) {
      navigate('/signin', { state: { from: targetUrl, property } });
    } else {
      navigate(targetUrl, { state: { property } });
    }
  };

  return (
    <div 
      id={`split-card-${property.id}`}
      className={`split-grid-card ${isSelected ? 'selected-card' : ''} ${isHovered ? 'hovered-card' : ''}`}
      onClick={() => onSelect(property)}
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer' }}
    >
      <div className="split-card-img-wrapper">
        <img src={property.image} alt={property.name} />
        <span className="split-card-tag" style={{ background: '#2D433D', border: '1px solid #D4AF37', color: '#fff' }}>
          ☀️ Day & 🌙 Night
        </span>
      </div>
      <div className="split-card-info">
        <div>
          <div className="split-card-meta">
            <span className="split-card-type">{property.type?.toUpperCase()}</span>
            <span className="split-card-rating">
              ★ {property.rating} <span className="split-card-reviews">({property.reviewsCount || 70} reviews)</span>
            </span>
          </div>
          <h3 style={{ fontSize: '1.25rem', margin: '4px 0 4px 0', fontFamily: 'var(--font-heading)', color: '#1a1a1a' }}>{property.name}</h3>
          <p className="split-card-location" style={{ margin: '0 0 6px 0' }}>
            <i className="fa-solid fa-location-dot" style={{ color: '#d4af37', marginRight: '6px' }}></i>
            {property.location}
          </p>
        </div>

        <div className="card-price-row">
          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1a1a1a', fontFamily: 'var(--font-heading)' }}>
            {numericPrice} <span style={{ fontSize: '0.82rem', color: '#666', fontWeight: '500' }}>/night</span>
          </span>
             <div className="split-card-footer" style={{ marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <button 
              type="button" 
              className="btn-locate-map" 
              onClick={(e) => {
                e.stopPropagation();
                onSelect(property);
              }}
              title="Locate hotel and zoom on interactive map"
            >
              <i className="fa-solid fa-location-crosshairs" style={{ color: '#d4af37' }}></i> Find on Map
            </button>
            <button 
              type="button"
              className="btn-primary" 
              style={{ padding: '9px 22px', fontSize: '0.88rem', fontWeight: '700', borderRadius: '30px', whiteSpace: 'nowrap', background: '#1b4332', border: 'none', cursor: 'pointer' }}
              onClick={handleBookNow}
            >
              Book Stays
            </button>
          </div>
        </div>       </div>
      </div>
    </div>
  );
};

// Redesigned Luxury Property Card for standalone Explore page
const LuxuryPropertyCard = ({ property, isSelected, isHovered, onSelect, onHover, onLeave, isWishlisted, onToggleWishlist }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPriceNum = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '10000');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;

  const handleBookNow = (e) => {
    if (e) e.stopPropagation();
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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

    if (!token) {
      navigate('/signin', { state: { from: targetUrl, property } });
    } else {
      navigate(targetUrl, { state: { property } });
    }
  };

  return (
    <div 
      id={`split-card-${property.id}`}
      className={`luxury-explore-card ${isSelected ? 'selected-card' : ''} ${isHovered ? 'hovered-card' : ''}`}
      onClick={() => onSelect(property)}
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-img-box">
        <img src={property.image} alt={property.name} />
        <span className="day-night-badge">
          Day & Night
        </span>
        <button 
          type="button"
          className={`wishlist-heart-btn ${isWishlisted ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(property.id);
          }}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <i className={`fa-${isWishlisted ? 'solid' : 'regular'} fa-heart`}></i>
        </button>
      </div>

      <div className="card-content-box">
        <h3 className="card-title">{property.name}</h3>
        <p className="card-location">
          <i className="fa-solid fa-location-dot" style={{ color: '#d4af37', marginRight: '6px' }}></i>
          {property.location}
        </p>

        <div className="card-rating-row">
          <span className="card-rating-star">★ {property.rating}</span>
          <span className="card-reviews-count">({property.reviewsCount || 70} reviews)</span>
        </div>

        <div className="card-price-row">
          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1a1a1a', fontFamily: 'var(--font-heading)' }}>
            {numericPrice} <span style={{ fontSize: '0.82rem', color: '#666', fontWeight: '500' }}>/night</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            className="btn-locate-map"
            style={{ flex: '1', justifyContent: 'center' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(property);
            }}
            title="Locate hotel and zoom on interactive map"
          >
            <i className="fa-solid fa-location-crosshairs" style={{ color: '#d4af37' }}></i> Map Pin
          </button>
          <button 
            type="button"
            className="btn-book-now-gold"
            style={{ flex: '1.2', padding: '10px', border: 'none', cursor: 'pointer' }}
            onClick={handleBookNow}
          >
            Book Now
          </button>
        </div>
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
  
  // Search, View, and Selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null);
  const [showViewAllModal, setShowViewAllModal] = useState(false);

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
    let result = resolvedAllProperties.filter(prop => {
      // 1. Category / Type filter
      const matchesFilter = activeFilter === 'All' || prop.type === activeFilter || (activeFilter === 'Cottage' && prop.type === 'Cottage') || (activeFilter === 'Farm House' && (prop.type === 'Farm House' || prop.type === 'Villa'));
      
      // 2. Search query filter
      const matchesSearch = !searchQuery || 
        prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.location.toLowerCase().includes(searchQuery.toLowerCase());

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
      if (mapRef.current) return true;

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
      }, 250);
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
    <section className="property-grid-section" id="explore" style={{ padding: isHomePage ? '90px 0' : '50px 0 90px 0' }}>
      {isHomePage ? (
        /* HOME PAGE SPLIT VIEW LAYOUT (MATCHING USER'S SCREENSHOT) */
        <>
          <div className="section-header" style={{ maxWidth: '1440px', margin: '0 auto 36px auto', padding: '0 20px', textAlign: 'center' }}>
            <span className="section-subtitle" style={{ letterSpacing: '3px', color: '#d4af37', fontWeight: '800', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.88rem' }}>
              Our Curated Collection
            </span>
            <h2 style={{ fontSize: '2.8rem', color: '#0f382c', margin: '0 0 24px 0', fontFamily: 'var(--font-heading)', fontWeight: '800', letterSpacing: '0.5px' }}>
              Explore <span style={{ color: '#d4af37' }}>Exceptional</span> Stays
            </h2>
            
            {/* Unified Luxury Control Bar: All Controls & View All Button */}
            <div className="map-control-bar" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '60px',
              padding: '12px 28px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              margin: '0 auto 30px auto',
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
                    {tab === 'All' ? '✨ All' : (tab === 'Villa' ? '🏡 Villas' : tab === 'Hotel' ? '🏨 Hotels' : tab === 'Cabin' ? '🛖 Cabins' : '🏞️ Resorts')}
                  </button>
                ))}
              </div>

              {/* Search Input Box */}
              <form onSubmit={handleSearchSubmit} className="search-input-wrapper" style={{ margin: 0, border: '1px solid #d4af37', borderRadius: '30px', background: '#fdfbf7', padding: '0', width: '220px', position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#d4af37', fontSize: '0.85rem' }}></i>
                <input 
                  type="text" 
                  placeholder="Search hotel name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-location-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', padding: '6px 14px 6px 36px', fontSize: '0.85rem', fontWeight: '600', color: '#1b4332', boxShadow: 'none' }}
                />
              </form>

              {/* View All Stays Action Button */}
              <button 
                onClick={() => navigate('/explore')} 
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #d4af37 0%, #b38b19 100%)',
                  color: '#0b110f',
                  fontWeight: '800',
                  padding: '8px 22px',
                  borderRadius: '50px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
                  whiteSpace: 'nowrap'
                }}
              >
                <i className="fa-solid fa-list-check"></i> View All Stays ({resolvedAllProperties.length})
              </button>
            </div>
          </div>
          
          {/* Side-by-Side Map + Hotel List View (User Screenshot Design) */}
          <div className="property-split-container" style={{ height: '620px' }}>
            <div className="properties-list-column" data-lenis-prevent style={{ flex: '4.8', overflowY: 'auto' }}>
              {filteredProperties.length > 0 ? (
                filteredProperties.map(property => (
                  <SplitPropertyCard 
                    key={property.id} 
                    property={property} 
                    isSelected={selectedPropertyId === property.id}
                    isHovered={hoveredPropertyId === property.id}
                    onSelect={selectHotelOnMap}
                    onHover={setHoveredPropertyId}
                    onLeave={() => setHoveredPropertyId(null)}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-hotel" style={{ fontSize: '2rem', marginBottom: '10px', color: 'var(--secondary-color)' }}></i>
                  <h3>No stays matching search</h3>
                  <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try searching another city or selecting a different category.</p>
                </div>
              )}
            </div>
            <div className="map-column" style={{ flex: '5.2', height: '620px' }}>
              <div id="leaflet-map" style={{ height: '100%' }}></div>
            </div>
          </div>

          {/* Full-width View All Hotels Banner (Navigates to /explore page) */}
          <div style={{
            maxWidth: '1400px',
            margin: '30px auto 0 auto',
            padding: '0 20px',
            textAlign: 'center'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
              borderRadius: '24px',
              padding: '30px 40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
              boxShadow: '0 10px 30px rgba(27, 67, 50, 0.3)'
            }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: '#d4af37', margin: '0 0 6px 0' }}>
                  Explore All Available Hotels ({resolvedAllProperties.length} Stays)
                </h3>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
                  Browse complete luxury amenities, room details, ratings, and video tours for all stays.
                </p>
              </div>
              <button 
                onClick={() => navigate('/explore')} 
                className="btn-primary"
                style={{
                  background: '#d4af37',
                  color: '#1a1a1a',
                  fontWeight: '700',
                  padding: '14px 32px',
                  borderRadius: '50px',
                  fontSize: '1rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(212, 175, 55, 0.4)',
                  whiteSpace: 'nowrap'
                }}
              >
                <i className="fa-solid fa-list-check" style={{ marginRight: '8px' }}></i> View All Hotels & Details
              </button>
            </div>
          </div>
        </>
      ) : (
        /* STANDALONE EXPLORE STAYS PAGE LAYOUT (/explore) */
        <>
          {/* Unified Luxury Control Card for Explore Stays Page */}
          <div className="explore-unified-card" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '28px',
            padding: '18px 28px',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            margin: '0 auto 28px auto',
            width: 'fit-content',
            maxWidth: '95%'
          }}>
            {/* Title Header Centered */}
            <h2 style={{ fontSize: '1.85rem', margin: 0, fontFamily: 'var(--font-heading)', color: '#0f382c', fontWeight: '800', textAlign: 'center', letterSpacing: '0.5px' }}>
              Stay in <span style={{ color: '#d4af37' }}>Nature</span>, Live in <span style={{ color: '#d4af37' }}>Luxury</span>
            </h2>

            {/* All Controls Centered Together */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* Category Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      border: activeFilter === tab ? 'none' : '1px solid #c8d3cc',
                      background: activeFilter === tab ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : '#f4f6f4',
                      color: activeFilter === tab ? '#ffffff' : '#1b4332',
                      boxShadow: activeFilter === tab ? '0 4px 14px rgba(27, 67, 50, 0.3)' : '0 2px 5px rgba(0,0,0,0.02)'
                    }}
                  >
                    {tab === 'All' ? '✨ All' : (tab === 'Villa' ? '🏡 Villas' : tab === 'Hotel' ? '🏨 Hotels' : tab === 'Cabin' ? '🛖 Cabins' : '🏞️ Resorts')}
                  </button>
                ))}
              </div>

              {/* Search Input Box */}
              <form onSubmit={handleSearchSubmit} className="explore-search-form" style={{ margin: 0, width: '210px', position: 'relative', border: '1px solid #d4af37', borderRadius: '30px', background: '#fdfbf7', padding: '0' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#d4af37', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem' }}></i>
                <input 
                  type="text" 
                  placeholder="Search location or stay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="explore-search-input"
                  style={{ border: 'none', outline: 'none', background: 'transparent', padding: '6px 14px 6px 36px', fontSize: '0.85rem', fontWeight: '600', color: '#1b4332', width: '100%', boxShadow: 'none' }}
                />
              </form>

              {/* Filters Button */}
              <button 
                type="button"
                className="filter-toggle-pill-btn"
                onClick={() => setShowViewAllModal(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #c8d3cc',
                  color: '#1b4332',
                  fontWeight: '700',
                  padding: '7px 16px',
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
          
          {/* 1. Interactive Map Section FIRST */}
          <div className="explore-map-container-top" style={{ maxWidth: '1440px', margin: '0 auto 35px auto', padding: '0 20px' }}>
            <div className="top-map-wrapper" style={{
              position: 'relative',
              height: '440px',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.08)'
            }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 999,
                background: 'rgba(212, 175, 55, 0.95)',
                color: '#1a1a1a',
                padding: '8px 20px',
                borderRadius: '30px',
                fontWeight: '700',
                fontSize: '0.88rem',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(8px)'
              }}>
                <i className="fa-solid fa-map-location-dot" style={{ marginRight: '6px' }}></i> Explore This Area on Map
              </div>
              <div id="leaflet-map" style={{ height: '100%', width: '100%' }}></div>
            </div>
          </div>

          {/* 2. Grid of Hotels BELOW THE MAP */}
          <div className="explore-hotels-container-bottom" style={{ maxWidth: '1440px', margin: '0 auto 60px auto', padding: '0 20px' }}>
            {filteredProperties.length > 0 ? (
              <div className="explore-cards-3col-grid">
                {filteredProperties.map(property => (
                  <LuxuryPropertyCard 
                    key={property.id} 
                    property={property} 
                    isSelected={selectedPropertyId === property.id}
                    isHovered={hoveredPropertyId === property.id}
                    onSelect={selectHotelOnMap}
                    onHover={setHoveredPropertyId}
                    onLeave={() => setHoveredPropertyId(null)}
                    isWishlisted={!!wishlistMap[property.id]}
                    onToggleWishlist={toggleWishlist}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666', background: '#fff', borderRadius: '20px' }}>
                <i className="fa-solid fa-hotel" style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#d4af37' }}></i>
                <h3 style={{ fontSize: '1.4rem', color: '#1a1a1a' }}>No luxury stays matching search</h3>
                <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>Try searching another property name or selecting a different category filter above.</p>
              </div>
            )}
          </div>
        </>
      )}

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
    </section>
  );
};

export default PropertyGrid;
