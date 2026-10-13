import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';
import { API_BASE_URL } from '../../config';
import { properties } from '../../data/mockData';
import { getPlacePredictions, getPlaceDetails, createSessionToken } from '../../services/googleMaps';

import bg1 from '../../assets/hillstationhome (1).jpg';
import bg2 from '../../assets/hillstationhome (2).jpg';
import bg3 from '../../assets/hillstationhome (3).jpg';
import bg4 from '../../assets/hillstationhome (4).jpg';
import waterfallvalley from '../../assets/waterfallvalley.jpg';

const bgImages = [waterfallvalley, bg1, bg2, bg3, bg4];

const popularDestinations = [
  { name: 'Mahabaleshwar', famous: 'Arthur\'s Seat, Wilson Point, Venna Lake', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&auto=format&fit=crop&q=80' },
  { name: 'Panchgani', famous: 'Table Land, Sydney Point, Parsi Point', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80' },
  { name: 'Lonavala', famous: 'Tiger\'s Leap, Bhushi Dam, Lion\'s Point', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&auto=format&fit=crop&q=80' },
  { name: 'Khandala', famous: 'Duke\'s Nose, Rajmachi Point', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80' },
  { name: 'Matheran', famous: 'Panorama Point, Echo Point, Louisa Point', image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&auto=format&fit=crop&q=80' },
  { name: 'Igatpuri', famous: 'Kalsubai Peak, Camel Valley, Ghatandevi', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&auto=format&fit=crop&q=80' },
  { name: 'Bhandardara', famous: 'Arthur Lake, Wilson Dam, Randha Falls', image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=400&auto=format&fit=crop&q=80' },
  { name: 'Chikhaldara', famous: 'Hurricane Point, Prospect Point, Devi Point', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&auto=format&fit=crop&q=80' },
  { name: 'Toranmal', famous: 'Yashavant Lake, Lotus Lake, Sita Khai', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&auto=format&fit=crop&q=80' },
  { name: 'Jawhar', famous: 'Jai Vilas Palace, Dabhosa Falls', image: 'https://images.unsplash.com/photo-1434394354979-a235cd36269d?w=400&auto=format&fit=crop&q=80' },
  { name: 'Panhala', famous: 'Sunset Point, Tabak Udyan, Sajja Kothi', image: 'https://images.unsplash.com/photo-1586375300773-8384e3e4916f?w=400&auto=format&fit=crop&q=80' },
  { name: 'Kaas Plateau', famous: 'Kaas Lake, Flower Valley', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&auto=format&fit=crop&q=80' },
  { name: 'Amboli', famous: 'Amboli Falls, Sunset Point', image: 'https://images.unsplash.com/photo-1511497584788-876761c11969?w=400&auto=format&fit=crop&q=80' }
];

const Hero = () => {
  const images = bgImages;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hotels, setHotels] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const navigate = useNavigate();
  const destScrollRef = useRef(null);

  // Autocomplete state
  const locationFieldRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isTyped, setIsTyped] = useState(false);

  useEffect(() => {
    // Fetch registered hotels and merge with mock data
    const fetchHotels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/properties/all`);
        const data = await response.json();
        
        let allHotels = [];
        const mockHotels = properties.map(p => ({
          _id: String(p.id),
          name: p.name,
          location: p.location
        }));

        if (response.ok && Array.isArray(data)) {
          const dbHotels = data.map(h => ({
            _id: h._id,
            name: h.name,
            location: h.location
          }));
          
          allHotels = [...dbHotels, ...mockHotels.filter(mh => !dbHotels.some(dh => dh.name === mh.name))];
        } else {
          allHotels = mockHotels;
        }
        setHotels(allHotels);
      } catch (err) {
        console.error('Failed to fetch hotels:', err);
        const mockHotels = properties.map(p => ({
          _id: String(p.id),
          name: p.name,
          location: p.location
        }));
        setHotels(mockHotels);
      }
    };
    fetchHotels();

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  // Extract unique locations including popular districts
  const uniqueLocations = Array.from(
    new Set([
      ...hotels.map(h => {
        if (!h.location) return '';
        const parts = h.location.split(',');
        return parts[0].trim();
      }).filter(Boolean),
      ...popularDestinations.map(d => d.name)
    ])
  ).sort();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationFieldRef.current && !locationFieldRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Google Places autocomplete predictions
  useEffect(() => {
    if (!isTyped || selectedLocation.trim().length < 2) {
      setPredictions([]);
      setIsPlacesLoading(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createSessionToken();
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsPlacesLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getPlacePredictions(selectedLocation, sessionTokenRef.current);
        setPredictions(results || []);
      } catch {
        setPredictions([]);
      } finally {
        setIsPlacesLoading(false);
        setActiveIdx(-1);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedLocation, isTyped]);

  const choosePrediction = async (prediction) => {
    setSelectedLocation(prediction.mainText || prediction.description);
    setIsTyped(false);
    setActiveIdx(-1);
    setIsDropdownOpen(false);
    try {
      const details = await getPlaceDetails(prediction);
      sessionTokenRef.current = null;
      if (details) {
        setSelectedPlace(details);
      } else {
        setSelectedPlace({ placeId: prediction.placeId, name: prediction.mainText, formattedAddress: prediction.description });
      }
    } catch {
      setSelectedPlace({ placeId: prediction.placeId, name: prediction.mainText, formattedAddress: prediction.description });
    }
  };

  const chooseFallback = (locName) => {
    setSelectedLocation(locName);
    setIsTyped(false);
    setActiveIdx(-1);
    setIsDropdownOpen(false);
    sessionTokenRef.current = null;
    setSelectedPlace({ placeId: '', name: locName, formattedAddress: `${locName}, India` });
  };

  const term = selectedLocation.trim().toLowerCase();
  const filteredFallback = isTyped && term
    ? uniqueLocations.filter((loc) => loc.toLowerCase().includes(term))
    : uniqueLocations;

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSearch = () => {
    if (selectedLocation) {
      const queryParams = new URLSearchParams();
      queryParams.append('search', selectedLocation.trim());
      if (selectedPlace?.placeId) queryParams.append('placeId', selectedPlace.placeId);
      if (
        selectedPlace?.lat !== undefined &&
        selectedPlace?.lat !== null &&
        selectedPlace?.lng !== undefined &&
        selectedPlace?.lng !== null &&
        !isNaN(selectedPlace.lat) &&
        !isNaN(selectedPlace.lng)
      ) {
        queryParams.append('lat', String(selectedPlace.lat));
        queryParams.append('lng', String(selectedPlace.lng));
      }
      if (checkIn) queryParams.append('checkIn', checkIn);
      if (checkOut) queryParams.append('checkOut', checkOut);
      if (guests) queryParams.append('guests', guests);
      
      navigate(`/explore?${queryParams.toString()}`);
    } else {
      navigate('/explore');
    }
  };

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleSelectDest = (destName) => {
    setSelectedLocation(destName);
    setSelectedPlace(null);
    const queryParams = new URLSearchParams();
    queryParams.append('search', destName);
    if (checkIn) queryParams.append('checkIn', checkIn);
    if (checkOut) queryParams.append('checkOut', checkOut);
    if (guests) queryParams.append('guests', guests);
    navigate(`/explore?${queryParams.toString()}`);
  };

  const handleScroll = (direction) => {
    if (destScrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      destScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleWheel = (e) => {
    if (destScrollRef.current) {
      if (e.deltaY !== 0) {
        destScrollRef.current.scrollLeft += e.deltaY * 1.2;
      }
    }
  };

  const handleMouseDown = (e) => {
    if (!destScrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - destScrollRef.current.offsetLeft);
    setScrollLeftState(destScrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e) => {
    if (!isMouseDown || !destScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - destScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    destScrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  return (
    <section className="hero" id="home">
      <div className="hero-background">
        <video 
          className="hero-video-bg" 
          autoPlay 
          loop 
          muted 
          playsInline 
          preload="auto"
          poster={bg1}
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-resort-and-the-ocean-41480-large.mp4" type="video/mp4" />
          <source src="https://assets.mixkit.co/videos/preview/mixkit-luxury-house-with-a-swimming-pool-41481-large.mp4" type="video/mp4" />
        </video>
        {images.map((img, index) => (
          <img 
            key={index}
            src={img} 
            alt={`Hill Station ${index + 1}`} 
            className={`hero-img ${index === currentImageIndex ? 'active' : ''}`}
            loading="lazy"
          />
        ))}
        <div className="hero-overlay"></div>
      </div>
      
      <div className="hero-content fade-in">
        <span className="hero-tagline">Experience the Serenity of the Summits</span>
        <h1>Your Luxury Escape <br /> Above the Clouds</h1>
        <p>Book exclusive hotels, private villas, and boutique cabins in the most breathtaking hill stations.</p>
        
        <div className="search-bar-container">
          <div className="search-field hero-location-field" ref={locationFieldRef}>
            <label>TRIP LOCATION</label>
            <input 
              type="text"
              autoComplete="off"
              className="search-input"
              placeholder="Where to? (e.g. Mahabaleshwar)"
              value={selectedLocation} 
              onFocus={() => {
                setIsTyped(false);
                setActiveIdx(-1);
                setIsDropdownOpen(true);
              }}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                setSelectedPlace(null);
                setIsTyped(true);
                setActiveIdx(-1);
                setIsDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                const total = predictions.length > 0 ? predictions.length : filteredFallback.length;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIsDropdownOpen(true);
                  setActiveIdx((idx) => Math.min(idx + 1, total - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx((idx) => Math.max(idx - 1, 0));
                } else if (e.key === 'Enter') {
                  if (isDropdownOpen && activeIdx >= 0 && activeIdx < total) {
                    e.preventDefault();
                    if (predictions.length > 0) {
                      choosePrediction(predictions[activeIdx]);
                    } else {
                      chooseFallback(filteredFallback[activeIdx]);
                    }
                  } else {
                    handleSearch();
                  }
                } else if (e.key === 'Escape') {
                  setIsDropdownOpen(false);
                }
              }}
            />
            {isDropdownOpen && (
              <ul className="hero-location-dropdown" role="listbox">
                {isPlacesLoading && (
                  <li className="hero-location-loading">
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Finding destinations...</span>
                  </li>
                )}
                {predictions.length > 0 ? (
                  predictions.map((p, idx) => (
                    <li
                      key={p.placeId || idx}
                      className={`hero-location-item ${idx === activeIdx ? 'is-active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => choosePrediction(p)}
                    >
                      <span className="hero-location-pin">
                        <i className="fa-solid fa-location-dot"></i>
                      </span>
                      <span className="hero-location-info">
                        <strong>{p.mainText}</strong>
                        {p.secondaryText && <small>{p.secondaryText}</small>}
                      </span>
                    </li>
                  ))
                ) : filteredFallback.length > 0 ? (
                  filteredFallback.map((loc, idx) => (
                    <li
                      key={loc}
                      className={`hero-location-item ${idx === activeIdx ? 'is-active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => chooseFallback(loc)}
                    >
                      <span className="hero-location-pin">
                        <i className="fa-solid fa-location-dot"></i>
                      </span>
                      <span className="hero-location-info">
                        <strong>{loc}</strong>
                        <small>Popular destination</small>
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="hero-location-empty">
                    <span>No suggestions found for "{selectedLocation}". Press Search to find stays.</span>
                  </li>
                )}
                {predictions.length > 0 && (
                  <li className="hero-location-attribution" onMouseDown={(e) => e.preventDefault()}>
                    <span>Google Maps Platform</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="search-field">
            <label>CHECK-IN</label>
            <input 
              type="date" 
              className="search-input date-input" 
              value={checkIn}
              min={getTodayDateString()}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (checkOut && e.target.value > checkOut) {
                  setCheckOut('');
                }
              }}
            />
          </div>

          <div className="search-field">
            <label>CHECK-OUT</label>
            <input 
              type="date" 
              className="search-input date-input" 
              value={checkOut}
              min={checkIn || getTodayDateString()}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>

          <div className="search-field">
            <label>GUESTS</label>
            <input 
              type="number" 
              min="1" 
              placeholder="1" 
              className="search-input" 
              value={guests}
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Math.max(1, Math.abs(parseInt(e.target.value) || 1));
                setGuests(val);
              }}
            />
          </div>

          <button className="search-btn" onClick={handleSearch}>Search</button>
        </div>

        {/* Interactive Circle Hill Stations Scroll Bar Below Search Bar */}
        <div className="hero-destinations-outer">
          <button 
            className="circle-scroll-arrow left-arrow" 
            onClick={() => handleScroll('left')} 
            aria-label="Scroll Left"
          >
            ‹
          </button>

          <div 
            className={`hero-destinations-scroll ${isMouseDown ? 'dragging' : ''}`} 
            ref={destScrollRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
          >
            {popularDestinations.map((dest, idx) => (
              <div 
                key={idx} 
                className={`circle-dest-card ${selectedLocation === dest.name ? 'active' : ''}`}
                onClick={() => handleSelectDest(dest.name)}
                title={`${dest.name} (${dest.famous})`}
              >
                <div className="circle-img-box">
                  <img src={dest.image} alt={dest.name} loading="lazy" />
                </div>
                <span className="circle-dest-name">{dest.name}</span>
                <span className="circle-dest-spots">{dest.famous}</span>
              </div>
            ))}
          </div>

          <button 
            className="circle-scroll-arrow right-arrow" 
            onClick={() => handleScroll('right')} 
            aria-label="Scroll Right"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
