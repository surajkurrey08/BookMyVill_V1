import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';
import { API_BASE_URL } from '../../config';
import { properties } from '../../data/mockData';

import bg1 from '../../assets/hillstationhome (1).jpg';
import bg2 from '../../assets/hillstationhome (2).jpg';
import bg3 from '../../assets/hillstationhome (3).jpg';
import bg4 from '../../assets/hillstationhome (4).jpg';

const Hero = () => {
  const images = [bg1, bg2, bg3, bg4];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hotels, setHotels] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const navigate = useNavigate();

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

  // Extract unique locations sorted alphabetically
  const uniqueLocations = Array.from(
    new Set(
      hotels.map(h => {
        if (!h.location) return '';
        const parts = h.location.split(',');
        return parts[0].trim();
      }).filter(Boolean)
    )
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
      
      navigate(`/?${queryParams.toString()}#explore`);
      
      // Smooth scroll to explore section
      setTimeout(() => {
        const exploreSection = document.getElementById('explore');
        if (exploreSection) {
          exploreSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      alert('Please select a location to search.');
    }
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
        
        <div className="search-bar-container glass-morphism">
          <div className="search-field">
            <label>Trip Location</label>
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
            <label>Check-in</label>
            <input 
              type="date" 
              className="search-input" 
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
            <label>Check-out</label>
            <input 
              type="date" 
              className="search-input" 
              value={checkOut}
              min={checkIn || getTodayDateString()}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div className="search-field">
            <label>Guests</label>
            <input 
              type="number" 
              min="1" 
              placeholder="Add guests" 
              className="search-input" 
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            />
          </div>
          <button className="btn-primary search-btn" onClick={handleSearch}>Search</button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
