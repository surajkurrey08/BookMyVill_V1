import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Destinations.css';

const hillStations = [
  {
    name: "Mahabaleshwar",
    district: "Satara",
    highlight: "Queen of Hill Stations",
    properties: "150+ Stays",
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Panchgani",
    district: "Satara",
    highlight: "Table Land & Strawberry Farms",
    properties: "110+ Stays",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Lonavala",
    district: "Pune",
    highlight: "Sahyadri Peaks & Bhushi Dam",
    properties: "140+ Stays",
    image: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Khandala",
    district: "Pune",
    highlight: "Duke's Nose & Valley Views",
    properties: "90+ Stays",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Matheran",
    district: "Raigad",
    highlight: "Eco-Friendly Toy Train Retreat",
    properties: "80+ Stays",
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Igatpuri",
    district: "Nashik",
    highlight: "Serene Valleys & Kalsubai Peak",
    properties: "95+ Stays",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Bhandardara",
    district: "Ahilyanagar",
    highlight: "Arthur Lake & Randha Falls",
    properties: "70+ Stays",
    image: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Chikhaldara",
    district: "Amravati",
    highlight: "Coffee Plantations & Wildlife",
    properties: "65+ Stays",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Toranmal",
    district: "Nandurbar",
    highlight: "Lotus Lake & Serene Heights",
    properties: "50+ Stays",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Jawhar",
    district: "Palghar",
    highlight: "Cultural Forts & Cascades",
    properties: "45+ Stays",
    image: "https://images.unsplash.com/photo-1434394354979-a235cd36269d?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Panhala",
    district: "Kolhapur",
    highlight: "Misty Historic Fort Heights",
    properties: "55+ Stays",
    image: "https://images.unsplash.com/photo-1586375300773-8384e3e4916f?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Kaas Plateau",
    district: "Satara",
    highlight: "Valley of Flowers Reserve",
    properties: "60+ Stays",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop&q=80"
  },
  {
    name: "Amboli",
    district: "Sindhudurg",
    highlight: "Misty Rainforest Waterfalls",
    properties: "50+ Stays",
    image: "https://images.unsplash.com/photo-1511497584788-876761c11969?w=800&auto=format&fit=crop&q=80"
  }
];

const Destinations = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const handleCardClick = (name) => {
    navigate(`/explore?search=${encodeURIComponent(name)}`);
  };

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="destinations-section">
      <div className="container">
        <div className="destinations-header-row">
          <div className="section-header">
            <span className="section-subtitle">Discover Premium Escapes</span>
            <h2>Top Hill Stations</h2>
          </div>
          <div className="dest-nav-arrows">
            <button 
              className="dest-nav-btn" 
              onClick={() => handleScroll('left')} 
              aria-label="Scroll Left"
            >
              ‹
            </button>
            <button 
              className="dest-nav-btn" 
              onClick={() => handleScroll('right')} 
              aria-label="Scroll Right"
            >
              ›
            </button>
          </div>
        </div>

        <div className="destinations-scroll-container" ref={scrollRef}>
          {hillStations.map((dest, index) => (
            <div 
              className="destination-card fade-in" 
              key={index} 
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => handleCardClick(dest.name)}
            >
              <img src={dest.image} alt={dest.name} loading="lazy" />
              <div className="destination-info">
                <h3>{dest.name}</h3>
                <span className="dest-highlight">{dest.highlight}</span>
                <p>{dest.district} • {dest.properties}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Destinations;


