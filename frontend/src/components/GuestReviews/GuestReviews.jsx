import React, { useRef } from 'react';
import './GuestReviews.css';

const reviewsData = [
  {
    id: 1,
    guestName: "Ananya Deshmukh",
    stayName: "Ganesh Kuj Villa Estate",
    rating: "5.0",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bgImage: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
    review: "An unforgettable getaway! The valley views from the infinity pool were breathtaking, and the caretaker provided exceptional warm hospitality.",
    verifiedTag: "Verified Guest"
  },
  {
    id: 2,
    guestName: "Vikramaditya Roy",
    stayName: "Strawberry Hill Estate",
    rating: "5.0",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    bgImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    review: "Ultra-luxurious amenities, pristine cleanliness, and fresh farm strawberries every morning. Booking was effortless and instant!",
    verifiedTag: "Verified Guest"
  },
  {
    id: 3,
    guestName: "Dr. Meera Kulkarni",
    stayName: "Sahyadri Crest Resort",
    rating: "4.9",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    bgImage: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
    review: "The evening campfire and private chef experience exceeded all our expectations. Perfect family luxury retreat in Mahabaleshwar.",
    verifiedTag: "Verified Guest"
  },
  {
    id: 4,
    guestName: "Rohan & Sneha Kapoor",
    stayName: "Venna Lakefront Cottage",
    rating: "5.0",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    bgImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
    review: "Right next to Venna Lake with private boating access. Clean, serene, and beautifully decorated luxury cottage with lush gardens.",
    verifiedTag: "Verified Guest"
  }
];

const GuestReviews = () => {
  const scrollRef = useRef(null);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="guest-reviews-section">
      <div className="container">
        <div className="reviews-header-row">
          <div className="section-header">
            <span className="section-subtitle">
              <i className="fa-solid fa-heart" style={{ color: '#d4af37', marginRight: '6px' }}></i>
              Guest Experiences & Reviews
            </span>
            <h2>What Traveler Guests Say</h2>
            <p className="section-desc">
              Real feedback and stories from guests who experienced our handpicked luxury villas, resorts, and hill station cottages.
            </p>
          </div>

          <div className="reviews-nav-arrows">
            <button 
              className="reviews-nav-btn" 
              onClick={() => handleScroll('left')} 
              aria-label="Scroll Left"
            >
              ‹
            </button>
            <button 
              className="reviews-nav-btn" 
              onClick={() => handleScroll('right')} 
              aria-label="Scroll Right"
            >
              ›
            </button>
          </div>
        </div>

        {/* 1:1 Matching Feedback Cards Grid */}
        <div className="reviews-cards-scroll-grid" ref={scrollRef}>
          {reviewsData.map((item) => (
            <div 
              className="feedback-luxury-card" 
              key={item.id}
            >
              {/* Card Background Image & Dark Overlay */}
              <div 
                className="card-bg-image" 
                style={{ backgroundImage: `url(${item.bgImage})` }}
              >
                <div className="card-gradient-overlay"></div>
              </div>

              {/* Card Content Container */}
              <div className="feedback-card-content">
                {/* Top Circular Avatar Badge */}
                <div className="avatar-ring-container">
                  <img src={item.avatar} alt={item.guestName} className="guest-avatar-img" />
                  <span className="star-rating-pill">
                    <i className="fa-solid fa-star"></i> {item.rating}
                  </span>
                </div>

                {/* Guest Name & Stay Tag */}
                <h3 className="guest-name-title">{item.guestName}</h3>
                <span className="stay-name-tag">{item.stayName}</span>

                {/* Review Text Body */}
                <p className="review-quote-text">
                  "{item.review}"
                </p>

                {/* Bottom Action Pill Button */}
                <div className="bottom-action-container">
                  <button type="button" className="dots-action-btn" title="Verified Guest Stay">
                    <i className="fa-solid fa-ellipsis"></i>
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

export default GuestReviews;
