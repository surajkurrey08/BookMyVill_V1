import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PropertyCard from '../PropertyCard/PropertyCard';
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
  const loc = property.location;
  if (!loc) return { ...property, lat: 17.9258, lon: 73.6510 };
  
  const normalized = loc.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (normalized.includes(key.toLowerCase())) {
      return {
        ...property,
        // Add slight random offset to prevent exact overlapping of pins in the same destination
        lat: coords.lat + (Math.random() - 0.5) * 0.015,
        lon: coords.lon + (Math.random() - 0.5) * 0.015
      };
    }
  }

  // Fallback to OSM Nominatim API
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

  // Final fallback to Mahabaleshwar area with offset
  return {
    ...property,
    lat: 17.9258 + (Math.random() - 0.5) * 0.04,
    lon: 73.6510 + (Math.random() - 0.5) * 0.04
  };
};

// Horizontal card for the split list view next to the map
const SplitPropertyCard = ({ property }) => {
  return (
    <div className="split-grid-card">
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
          <Link to={`/property/${property.id}`} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
            Book Stays
          </Link>
        </div>
      </div>
    </div>
  );
};

const PropertyGrid = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [dbProperties, setDbProperties] = useState([]);
  const [resolvedAllProperties, setResolvedAllProperties] = useState([]);
  
  // Map View Search and Viewport filtering states
  const [mapView, setMapView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByMapBounds, setFilterByMapBounds] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);

  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);
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
          
          // Resolve coordinates for all database properties
          const withCoords = await Promise.all(mappedData.map(p => resolveCoordinates(p)));
          setDbProperties(withCoords);
        }
      } catch (err) {
        console.error('Failed to fetch properties:', err);
      }
    };
    fetchProperties();
  }, []);

  // Combine mock properties and db properties, resolving coordinates for all of them
  useEffect(() => {
    const prepareAll = async () => {
      const mockWithCoords = await Promise.all(properties.map(p => resolveCoordinates(p)));
      
      if (dbProperties.length > 0) {
        // Merge without duplicate names
        const merged = [...dbProperties, ...mockWithCoords.filter(mp => !dbProperties.some(dp => dp.name === mp.name))];
        setResolvedAllProperties(merged);
      } else {
        setResolvedAllProperties(mockWithCoords);
      }
    };
    prepareAll();
  }, [dbProperties]);

  // Handle Search Location input submission (geocoding search query & centering map)
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0 && mapRef.current) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        
        // Temporarily turn off boundary filtering during pan transition to avoid empty flash
        const originalFilter = filterByMapBounds;
        setFilterByMapBounds(false);

        mapRef.current.flyTo([lat, lon], 12, { duration: 1.8 });

        setTimeout(() => {
          setFilterByMapBounds(originalFilter);
        }, 2000);
      }
    } catch (err) {
      console.error("Nominatim search failed:", err);
    }
  };

  // Setup Leaflet map instance and boundary listeners
  useEffect(() => {
    if (!mapView) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    if (!window.L) return;
    const L = window.L;

    // Create map
    const map = L.map('leaflet-map', {
      zoomControl: false
    }).setView([17.9258, 73.6510], 6); // default view centered on India/Mahabaleshwar

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Track map movement to update viewport bounds
    const updateBounds = () => {
      const bounds = map.getBounds();
      setMapBounds({
        northEast: bounds.getNorthEast(),
        southWest: bounds.getSouthWest()
      });
    };

    map.on('load', updateBounds);
    map.on('moveend', updateBounds);
    
    // Trigger first bounds update
    updateBounds();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapView]);

  // Initial queries logic: filter properties by Tab + Search Input (memoized to break infinite loops)
  const searchFilteredProperties = React.useMemo(() => {
    return resolvedAllProperties.filter(prop => {
      const matchesFilter = activeFilter === 'All' || prop.type === activeFilter;
      const matchesSearch = !searchQuery || 
        prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [resolvedAllProperties, activeFilter, searchQuery]);

  // Checkbox boundary filter check helper
  const isInMapBounds = (prop) => {
    if (!filterByMapBounds || !mapBounds) return true;
    if (!prop.lat || !prop.lon) return true;
    return (
      prop.lat >= mapBounds.southWest.lat &&
      prop.lat <= mapBounds.northEast.lat &&
      prop.lon >= mapBounds.southWest.lng &&
      prop.lon <= mapBounds.northEast.lng
    );
  };

  // Final properties listed in scroll column (split view) or grid container (classic view)
  const finalFilteredProperties = searchFilteredProperties.filter(isInMapBounds);

  // Update/Draw markers on the map when list of properties or map view changes
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;

    // Clear old markers
    markersGroup.clearLayers();

    if (searchFilteredProperties.length === 0) return;

    const markersList = [];

    searchFilteredProperties.forEach(property => {
      if (!property.lat || !property.lon) return;

      // Custom marker icon showing price bubble
      const customIcon = L.divIcon({
        className: 'custom-price-marker',
        html: `<div class="price-marker-bubble" id="marker-${property.id}">${property.price}</div>`,
        iconSize: [60, 30],
        iconAnchor: [30, 15]
      });

      const marker = L.marker([property.lat, property.lon], { icon: customIcon });

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

      // Hover bindings
      marker.on('mouseover', () => {
        const bubble = document.getElementById(`marker-${property.id}`);
        if (bubble) bubble.classList.add('marker-active');
      });

      marker.on('mouseout', () => {
        const bubble = document.getElementById(`marker-${property.id}`);
        if (bubble) bubble.classList.remove('marker-active');
      });

      markersGroup.addLayer(marker);
      markersList.push(marker);
    });

    // Auto-fit the map view to display all markers (only on initial load or search/tab changes)
    if (markersList.length > 0 && !filterByMapBounds) {
      const boundsGroup = L.featureGroup(markersList);
      map.fitBounds(boundsGroup.getBounds().pad(0.15));
    }
  }, [mapView, searchFilteredProperties, filterByMapBounds]);

  return (
    <section className="property-grid-section" id="explore">
      <div className="section-header">
        <span className="section-subtitle">Our Curated Collection</span>
        <h2>Explore Exceptional Stays</h2>
        
        {/* Modern Control Bar: Tabs, Search Box, Map Controls */}
        <div className="map-control-bar">
          <div className="filter-tabs" style={{ marginBottom: 0 }}>
            {['All', 'Villa', 'Hotel', 'Cabin', 'Resort'].map(tab => (
              <button 
                key={tab}
                className={`filter-btn ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => setActiveFilter(tab)}
              >
                {tab === 'All' ? 'All' : tab + 's'}
              </button>
            ))}
          </div>

          {/* Search box with OSM Geocoding capability */}
          <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input 
              type="text" 
              placeholder="Search by city, state or stay name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-location-input"
            />
          </form>

          {/* Viewport Filter checkbox (only relevant in Map View) */}
          {mapView && (
            <label className="viewport-checkbox-label">
              <input 
                type="checkbox" 
                checked={filterByMapBounds} 
                onChange={(e) => setFilterByMapBounds(e.target.checked)} 
                className="viewport-checkbox"
              />
              Filter by map viewport
            </label>
          )}

          {/* Toggle View button */}
          <button 
            onClick={() => setMapView(!mapView)} 
            className={`map-view-toggle-btn ${mapView ? 'btn-secondary-style' : ''}`}
          >
            {mapView ? (
              <>
                <i className="fa-solid fa-grip"></i> Show Grid View
              </>
            ) : (
              <>
                <i className="fa-solid fa-map-location-dot"></i> Show Map View
              </>
            )}
          </button>
        </div>
      </div>
      
      {mapView ? (
        /* Split view: scrollable property cards on the left, map on the right */
        <div className="property-split-container">
          <div className="properties-list-column">
            {finalFilteredProperties.length > 0 ? (
              finalFilteredProperties.map(property => (
                <SplitPropertyCard key={property.id} property={property} />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-hotel" style={{ fontSize: '2rem', marginBottom: '10px', color: 'var(--secondary-color)' }}></i>
                <h3>No stays found in this area</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try zoom out or panning the map to other locations.</p>
              </div>
            )}
          </div>
          <div className="map-column">
            <div id="leaflet-map"></div>
          </div>
        </div>
      ) : (
        /* Classic Grid view */
        <>
          <div className="grid-container" style={{ maxWidth: '1200px', margin: '0 auto 60px auto', padding: '0 20px' }}>
            {finalFilteredProperties.length > 0 ? (
              finalFilteredProperties.map(property => (
                <PropertyCard key={property.id} property={property} />
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-hotel" style={{ fontSize: '2.5rem', marginBottom: '15px', color: 'var(--secondary-color)' }}></i>
                <h3>No matching stays found</h3>
                <p>Try resetting the search query or select another category above.</p>
              </div>
            )}
          </div>
          
          <div className="view-all-container">
            <button className="btn-outline">View All Destinations</button>
          </div>
        </>
      )}
    </section>
  );
};

export default PropertyGrid;

