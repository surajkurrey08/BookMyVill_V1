import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';
import { API_BASE_URL } from '../../config';
import { properties } from '../../data/mockData';

import bg1 from '../../assets/hillstationhome (1).jpg';
import bg2 from '../../assets/hillstationhome (2).jpg';
import bg3 from '../../assets/hillstationhome (3).jpg';
import bg4 from '../../assets/hillstationhome (4).jpg';

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
  const images = [bg1, bg2, bg3, bg4];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hotels, setHotels] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const navigate = useNavigate();
  const destScrollRef = useRef(null);

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
      queryParams.append('search', selectedLocation);
      if (checkIn) queryParams.append('checkIn', checkIn);
      if (checkOut) queryParams.append('checkOut', checkOut);
      if (guests) queryParams.append('guests', guests);
      
      navigate(`/explore?${queryParams.toString()}`);
    } else {
      navigate('/explore');
    }
  };

  const handleScroll = (direction) => {
    if (destScrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      destScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleSelectDest = (destName) => {
    setSelectedLocation(destName);
    const queryParams = new URLSearchParams();
    queryParams.append('search', destName);
    if (checkIn) queryParams.append('checkIn', checkIn);
    if (checkOut) queryParams.append('checkOut', checkOut);
    if (guests) queryParams.append('guests', guests);
    navigate(`/explore?${queryParams.toString()}`);
  };

  return (
    <section className="hero" id="home">
      <div className="hero-background">
        {images.map((img, index) => (
          <img 
            key={index}
            src={img} 
            alt={`Hill Station ${index + 1}`} 
            className={`hero-img ${index === currentImageIndex ? 'active' : ''}`}
          />
        ))}
        <div className="hero-overlay"></div>
      </div>
      
      <div className="hero-content fade-in">
        <span className="hero-tagline">Experience the Serenity of the Summits</span>
        <h1>Your Luxury Escape <br /> Above the Clouds</h1>
        <p>Book exclusive hotels, private villas, and boutique cabins in the most breathtaking hill stations.</p>
        
        <div className="search-bar-container">
          <div className="search-field">
            <label>TRIP LOCATION</label>
            <select 
              className="search-select" 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="">Select Location</option>
              {uniqueLocations.map((loc, idx) => (
                <option key={idx} value={loc}>{loc}</option>
              ))}
            </select>
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

        {/* Popular Hill Stations Circle Images Slider */}
        <div className="hero-destinations-wrapper">
          <div className="hero-destinations-header">
            <span className="destinations-label">Explore Top Hill Stations</span>
            <div className="dest-scroll-arrows">
              <button 
                className="dest-arrow-btn" 
                onClick={() => handleScroll('left')} 
                aria-label="Scroll Left"
              >
                ‹
              </button>
              <button 
                className="dest-arrow-btn" 
                onClick={() => handleScroll('right')} 
                aria-label="Scroll Right"
              >
                ›
              </button>
            </div>
          </div>

          <div className="hero-destinations-scroll" ref={destScrollRef}>
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
        </div>
      </div>
    </section>
  );
};

export default Hero;

