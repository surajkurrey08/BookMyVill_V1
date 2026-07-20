import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { properties } from '../../data/mockData';
import './PropertyGrid.css';
import './MapContainer.css';
import { API_BASE_URL } from '../../config';

// Predefined coordinates for common tourist locations to ensure instant response
const LOCATION_COORDINATES = {
  "Shimla": { lat: 31.1048, lon: 77.1734 },
  "Munnar": { lat: 10.0889, lon: 77.0595 },
  "Manali": { lat: 32.2396, lon: 77.1887 },
  "Gulmarg": { lat: 34.0484, lon: 74.3805 },
  "Ooty": { lat: 11.4102, lon: 76.6950 },
  "Nainital": { lat: 29.3919, lon: 79.4542 },
  "Mahabaleshwar": { lat: 17.9258, lon: 73.6510 },
  "Panchgani": { lat: 17.9238, lon: 73.8050 },
  "Lonavala": { lat: 18.7557, lon: 73.4091 }
};

// Geocoding helper with local lookup + OpenStreetMap fallback
const resolveCoordinates = async (property) => {
  if (property.lat && (property.lon || property.lng)) {
    return { ...property, lon: property.lon ?? property.lng };
  }

  const loc = property.location;
  if (!loc) return { ...property, lat: 17.9258, lon: 73.6510 };
  
  const normalized = loc.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (normalized.includes(key.toLowerCase())) {
      return {
        ...property,
        lat: coords.lat + (Math.random() - 0.5) * 0.015,
        lon: coords.lon + (Math.random() - 0.5) * 0.015
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
    lat: 17.9258 + (Math.random() - 0.5) * 0.04,
    lon: 73.6510 + (Math.random() - 0.5) * 0.04
  };
};

// Horizontal card for the list view next to the map
const SplitPropertyCard = ({ property, isSelected, isHovered, onSelect, onHover, onLeave }) => {
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
        {property.tag && <span className="split-card-tag">{property.tag}</span>}
      </div>
      <div className="split-card-info">
        <div>
          <div className="split-card-meta">
            <span className="split-card-type">{property.type}</span>
            <span className="split-card-rating">
              <i className="fa-solid fa-star"></i> {property.rating}
              <span className="split-card-reviews">({property.reviewsCount || Math.floor(Math.random() * 80) + 20} reviews)</span>
            </span>
          </div>
          <h3>{property.name}</h3>
          <p className="split-card-location">
            <i className="fa-solid fa-location-dot"></i> {property.location}
          </p>
        </div>
        <div className="split-card-footer">
          <span className="split-card-price">
            {property.price} <span>/ night</span>
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-outline" 
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(property);
              }}
            >
              <i className="fa-solid fa-location-crosshairs"></i> Find on Map
            </button>
            <Link 
              to={`/property/${property.id}`} 
              className="btn-primary" 
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              Book Stays
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const PropertyGrid = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [dbProperties, setDbProperties] = useState([]);
  const [resolvedAllProperties, setResolvedAllProperties] = useState(properties);
  
  // Search and Selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null);

  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);
  const markersMapRef = useRef({});
  const { search } = useLocation();

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
            name: prop.name,
            location: prop.location,
            type: prop.type,
            price: prop.price ? `₹${prop.price.toLocaleString('en-IN')}` : "₹10,000",
            rating: prop.rating || parseFloat((4 + Math.random()).toFixed(1)),
            reviewsCount: prop.reviewsCount || Math.floor(Math.random() * 120) + 30,
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

  // Select a hotel: Center map, fly to lat/lon, and open marker popup
  const selectHotelOnMap = (property) => {
    if (!property) return;
    setSelectedPropertyId(property.id);

    if (mapRef.current && property.lat && (property.lon || property.lng)) {
      const lng = property.lon ?? property.lng;
      mapRef.current.flyTo([property.lat, lng], 13.5, { duration: 1.4 });

      setTimeout(() => {
        const marker = markersMapRef.current[property.id];
        if (marker) {
          marker.openPopup();
        }
      }, 500);
    }
  };

  // Filter properties by Tab + Search Input
  const filteredProperties = React.useMemo(() => {
    return resolvedAllProperties.filter(prop => {
      const matchesFilter = activeFilter === 'All' || prop.type === activeFilter;
      const matchesSearch = !searchQuery || 
        prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [resolvedAllProperties, activeFilter, searchQuery]);

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
    if (!window.L) return;
    const L = window.L;

    if (mapRef.current) return; // Prevent duplicate creation

    let initialLat = 17.9258;
    let initialLon = 73.6510;
    let initialZoom = 6;

    if (filteredProperties.length > 0) {
      const firstValid = filteredProperties.find(p => p.lat && (p.lon || p.lng));
      if (firstValid) {
        initialLat = firstValid.lat;
        initialLon = firstValid.lon ?? firstValid.lng;
        initialZoom = filteredProperties.length === 1 ? 12 : 7;
      }
    }

    // Create map
    const map = L.map('leaflet-map', {
      zoomControl: false
    }).setView([initialLat, initialLon], initialZoom);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update/Draw markers on the map when list of properties changes
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;

    markersGroup.clearLayers();
    markersMapRef.current = {};

    if (filteredProperties.length === 0) return;

    const markersList = [];

    filteredProperties.forEach(property => {
      const lat = property.lat;
      const lon = property.lon ?? property.lng;
      if (lat === undefined || lon === undefined) return;

      const isSelected = selectedPropertyId === property.id;

      const customIcon = L.divIcon({
        className: 'custom-price-marker',
        html: `<div class="price-marker-bubble ${isSelected ? 'marker-active' : ''}" id="marker-${property.id}">${property.price}</div>`,
        iconSize: [60, 30],
        iconAnchor: [30, 15]
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      const popupContent = `
        <div class="popup-hotel-card">
          <img src="${property.image}" alt="${property.name}" class="popup-hotel-image" />
          <div class="popup-hotel-details">
            <div class="popup-hotel-type">${property.type} • ★ ${property.rating} (${property.reviewsCount || Math.floor(Math.random() * 80) + 20} reviews)</div>
            <div class="popup-hotel-name">${property.name}</div>
            <div class="popup-hotel-price">${property.price} <span>/ night</span></div>
            <a href="/property/${property.id}" class="popup-hotel-link">Book Stays</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -10)
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

    // Auto-center and fit map view to display matching property markers
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
    <section className="property-grid-section" id="explore">
      <div className="section-header">
        <span className="section-subtitle">Our Curated Collection</span>
        <h2>Explore Exceptional Stays</h2>
        
        {/* Modern Control Bar: Category Tabs, Search Box, Quick Dropdown, Count Badge */}
        <div className="map-control-bar">
          <div className="filter-tabs" style={{ marginBottom: 0 }}>
            {['All', 'Villa', 'Hotel', 'Cabin', 'Resort'].map(tab => (
              <button 
                key={tab}
                className={`filter-btn ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(tab);
                  setSelectedPropertyId(null);
                }}
              >
                {tab === 'All' ? 'All' : tab + 's'}
              </button>
            ))}
          </div>

          {/* Search box with hotel name search + OSM Geocoding */}
          <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input 
              type="text" 
              placeholder="Search hotel name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-location-input"
            />
          </form>

          {/* Quick Hotel Select Dropdown */}
          <select 
            className="hotel-quick-select"
            value={selectedPropertyId || ''}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (selectedId) {
                const targetProp = resolvedAllProperties.find(p => String(p.id) === String(selectedId));
                if (targetProp) {
                  selectHotelOnMap(targetProp);
                }
              } else {
                setSelectedPropertyId(null);
              }
            }}
          >
            <option value="">Find Hotel on Map...</option>
            {filteredProperties.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.location.split(',')[0]})</option>
            ))}
          </select>

          {/* Count Badge */}
          <span className="hotels-count-badge">
            <i className="fa-solid fa-hotel" style={{ marginRight: '6px' }}></i>
            {filteredProperties.length} Stays
          </span>
        </div>
      </div>
      
      {/* Map + Hotel List View */}
      <div className="property-split-container">
        <div className="properties-list-column">
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
        <div className="map-column">
          <div id="leaflet-map"></div>
        </div>
      </div>
    </section>
  );
};

export default PropertyGrid;
