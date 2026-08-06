import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PopularPoints.css';

const popularPointsData = [
  {
    id: 1,
    name: "Mahabaleshwar (Venna Lake & Boating)",
    category: "Queen of Hill Stations",
    location: "Satara District, Maharashtra",
    rating: "4.9",
    reviews: "5.2k reviews",
    highlight: "Shikara Boating, Kate's Point, Arthur's Seat & Strawberry Farms",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
    distance: "0 km",
    bestTime: "Year Round"
  },
  {
    id: 2,
    name: "Panchgani (Table Land & Mapro)",
    category: "Volcanic Plateau",
    location: "Panchgani (18 km from Mahabaleshwar)",
    rating: "4.8",
    reviews: "4.2k reviews",
    highlight: "Asia's 2nd Largest Table Land, Rajpuri Caves & Mapro Garden",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80",
    distance: "18 km",
    bestTime: "06:00 AM - 07:00 PM"
  },
  {
    id: 3,
    name: "Lonavala (Tiger's Leap & Dam)",
    category: "Sahyadri Jewel",
    location: "Pune District, Maharashtra",
    rating: "4.8",
    reviews: "6.1k reviews",
    highlight: "Tiger's Leap, Bhushi Dam, Lion's Point & Chikki Markets",
    image: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&auto=format&fit=crop&q=80",
    distance: "175 km",
    bestTime: "Monsoon & Winter"
  },
  {
    id: 4,
    name: "Khandala (Rajmachi Point)",
    category: "Scenic Cliff",
    location: "Western Ghats, Maharashtra",
    rating: "4.7",
    reviews: "3.5k reviews",
    highlight: "Duke's Nose Peak, Rajmachi Fort Trail & Valley Mist",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
    distance: "178 km",
    bestTime: "06:00 AM - 06:00 PM"
  },
  {
    id: 5,
    name: "Matheran (Automobile-Free Hill)",
    category: "Eco-Sensitive Zone",
    location: "Raigad District, Maharashtra",
    rating: "4.9",
    reviews: "4.8k reviews",
    highlight: "Toy Train Ride, Louisa Point, Charlotte Lake & Horse Trails",
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
    distance: "190 km",
    bestTime: "07:00 AM - 07:00 PM"
  },
  {
    id: 6,
    name: "Igatpuri (Kalsubai & Vipassana)",
    category: "Trekking & Wellness",
    location: "Nashik District, Maharashtra",
    rating: "4.8",
    reviews: "3.1k reviews",
    highlight: "Highest Peak in Maharashtra (Kalsubai 1646m) & Meditation Center",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80",
    distance: "270 km",
    bestTime: "Monsoon & Winter"
  },
  {
    id: 7,
    name: "Bhandardara (Arthur Lake & Waterfalls)",
    category: "Lakes & Waterfalls",
    location: "Ahmednagar District, Maharashtra",
    rating: "4.8",
    reviews: "2.9k reviews",
    highlight: "Wilson Dam, Randha Falls, Fireflies Festival & Lake Camping",
    image: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop&q=80",
    distance: "290 km",
    bestTime: "June - March"
  },
  {
    id: 8,
    name: "Kaas Plateau (UNESCO Flower Valley)",
    category: "UNESCO Heritage Site",
    location: "Satara (25 km from Mahabaleshwar)",
    rating: "4.9",
    reviews: "5.8k reviews",
    highlight: "Endemic Wildflowers Bloom, Kaas Lake & Biodiversity Trail",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop&q=80",
    distance: "25 km",
    bestTime: "August - October"
  },
  {
    id: 9,
    name: "Amboli (Cherrapunji of Maharashtra)",
    category: "High Rainfall & Waterfalls",
    location: "Sindhudurg District, Maharashtra",
    rating: "4.7",
    reviews: "2.3k reviews",
    highlight: "Amboli Waterfalls, Sunset Point, Hiranyakeshi River Temple",
    image: "https://images.unsplash.com/photo-1511497584788-876761c11969?w=800&auto=format&fit=crop&q=80",
    distance: "340 km",
    bestTime: "Monsoon Special"
  },
  {
    id: 10,
    name: "Chikhaldara (Melghat Tiger Reserve)",
    category: "Vidarbha Hill Resort",
    location: "Amravati District, Maharashtra",
    rating: "4.7",
    reviews: "1.9k reviews",
    highlight: "Coffee Plantations, Hurricane Point & Melghat Tiger Safari",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80",
    distance: "550 km",
    bestTime: "October - March"
  }
];

const PopularPoints = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const handlePointClick = (pointName) => {
    const cleanSearch = pointName.split('(')[0].trim();
    navigate(`/explore?search=${encodeURIComponent(cleanSearch)}`);
  };

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="popular-points-section">
      <div className="container">
        <div className="points-header-row centered-header">
          <div className="section-header center-align">
            <span className="section-subtitle">
              <i className="fa-solid fa-mountain-sun" style={{ color: '#d4af37', marginRight: '6px' }}></i>
              EXPLORE MAHARASHTRA DESTINATIONS
            </span>
            <h2>Popular Maharashtra Hill Stations</h2>
            <p className="section-desc">
              Discover serene mountain retreats, volcanic plateaus, waterfalls, and strawberry valleys across Maharashtra.
            </p>
          </div>

          <div className="points-nav-arrows">
            <button 
              className="points-nav-btn" 
              onClick={() => handleScroll('left')} 
              aria-label="Scroll Left"
            >
              ‹
            </button>
            <button 
              className="points-nav-btn" 
              onClick={() => handleScroll('right')} 
              aria-label="Scroll Right"
            >
            </button>
          </div>
        </div>

        <div className="popular-points-scroll-grid" ref={scrollRef}>
          {popularPointsData.map((point) => (
            <div 
              className="popular-point-card" 
              key={point.id}
              onClick={() => handlePointClick(point.name)}
            >
              <div className="point-img-box">
                <img src={point.image} alt={point.name} loading="lazy" />
                <span className="point-cat-badge">{point.category}</span>
                <span className="point-distance-badge">
                  <i className="fa-solid fa-location-dot"></i> {point.distance}
                </span>
              </div>

              <div className="point-card-body">
                <div className="point-rating-row">
                  <span className="point-rating-star">
                    <i className="fa-solid fa-star"></i> {point.rating}
                  </span>
                  <span className="point-reviews">{point.reviews}</span>
                </div>

                <h3 className="point-title">{point.name}</h3>

                <p className="point-location-text">
                  <i className="fa-solid fa-map-pin"></i> {point.location}
                </p>

                <p className="point-highlight-text">
                  {point.highlight}
                </p>

                <div className="point-card-footer">
                  <span className="point-timing">
                    <i className="fa-solid fa-clock"></i> {point.bestTime}
                  </span>
                  <button 
                    type="button" 
                    className="btn-find-stays-near"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePointClick(point.name);
                    }}
                  >
                    <span>Stays Nearby</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularPoints;
