import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PopularPoints.css';

const popularPointsData = [
  {
    id: 1,
    name: "Venna Lake & Boating Point",
    category: "Lake & Boating",
    location: "Mahabaleshwar (2.5 km from Market)",
    rating: "4.9",
    reviews: "3.2k reviews",
    highlight: "Shikara Boating, Horse Riding & Lakeside Strawberry Stalls",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
    distance: "2.5 km",
    bestTime: "09:00 AM - 07:00 PM"
  },
  {
    id: 2,
    name: "Kate's Point & Elephant's Head",
    category: "Scenic Viewpoint",
    location: "Mahabaleshwar (7 km from City)",
    rating: "4.8",
    reviews: "2.8k reviews",
    highlight: "Panoramic Krishna Valley View & Natural Elephant Trunk Rock",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    distance: "7.0 km",
    bestTime: "06:00 AM - 06:00 PM"
  },
  {
    id: 3,
    name: "Arthur's Seat (Queen of Points)",
    category: "Valley Viewpoint",
    location: "Mahabaleshwar (13 km from Market)",
    rating: "4.9",
    reviews: "4.1k reviews",
    highlight: "Deep Savitri River Valley & Floating Light Objects Phenomenon",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
    distance: "13.0 km",
    bestTime: "08:00 AM - 06:00 PM"
  },
  {
    id: 4,
    name: "Wilson Point (Sunrise Point)",
    category: "Highest Peak 1439m",
    location: "Mahabaleshwar Peak",
    rating: "4.7",
    reviews: "1.9k reviews",
    highlight: "360° Panoramic Sunrise Views over Sahyadri Ranges",
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
    distance: "1.5 km",
    bestTime: "05:30 AM - 07:30 AM"
  },
  {
    id: 5,
    name: "Table Land Plateau",
    category: "Mountain Plateau",
    location: "Panchgani (18 km from Mahabaleshwar)",
    rating: "4.8",
    reviews: "3.9k reviews",
    highlight: "Asia's 2nd Largest Volcanic Plateau & Rajpuri Cave Views",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80",
    distance: "18.0 km",
    bestTime: "06:00 AM - 07:00 PM"
  },
  {
    id: 6,
    name: "Mapro Garden & Strawberry Farm",
    category: "Strawberry Farm & Cafe",
    location: "Gureghar, Panchgani-Mahabaleshwar Road",
    rating: "4.9",
    reviews: "5.4k reviews",
    highlight: "Fresh Strawberry Cream, Woodfired Pizza & Chocolate Tasting",
    image: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80",
    distance: "11.0 km",
    bestTime: "08:00 AM - 09:30 PM"
  },
  {
    id: 7,
    name: "Lingmala Waterfall Point",
    category: "Plunge Waterfall",
    location: "Mahabaleshwar Forest Trail",
    rating: "4.8",
    reviews: "2.1k reviews",
    highlight: "600-Foot Plunge Waterfall & Forest Trek Trail",
    image: "https://images.unsplash.com/photo-1511497584788-876761c11969?w=800&auto=format&fit=crop&q=80",
    distance: "6.0 km",
    bestTime: "08:00 AM - 05:30 PM"
  },
  {
    id: 8,
    name: "Elphinstone & Lodwick Point",
    category: "Fort & Cliff Viewpoint",
    location: "Mahabaleshwar West Edge",
    rating: "4.7",
    reviews: "1.6k reviews",
    highlight: "Majestic View of Pratapgad Fort & Koyna River Valley",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=80",
    distance: "5.0 km",
    bestTime: "07:00 AM - 06:00 PM"
  }
];

const PopularPoints = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const handlePointClick = (pointName) => {
    const cleanSearch = pointName.split('&')[0].trim();
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
        <div className="points-header-row">
          <div className="section-header">
            <span className="section-subtitle">
              <i className="fa-solid fa-compass" style={{ color: '#d4af37', marginRight: '6px' }}></i>
              Must-Visit Sightseeing Attractions
            </span>
            <h2>Popular Hill Station Points</h2>
            <p className="section-desc">
              Explore famous scenic viewpoints, waterfalls, boating lakes, and strawberry farms in Mahabaleshwar & Panchgani.
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
              ›
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
