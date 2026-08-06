import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './PropertyCard.css';

const PropertyCard = ({ property }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isWishlisted, setIsWishlisted] = useState(false);

  const rawPriceNum = parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '8500');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;
  const originalPrice = `₹${Math.round(rawPriceNum * 1.25).toLocaleString('en-IN')}`;
  const reviewsCount = property.reviewsCount || (((String(property._id || property.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 80) + 35);

  const defaultAmenities = property.amenities && property.amenities.length > 0 
    ? property.amenities.slice(0, 3) 
    : ['Swimming Pool', 'Free WiFi', 'Valley View'];

  const handleCardClick = () => {
    const propertyId = property._id || property.id;
    navigate(`/property/${propertyId}`, { state: { property } });
  };

  const handleBookNow = (e) => {
    e.stopPropagation();
    e.preventDefault();
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

  const toggleWishlist = (e) => {
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  return (
    <div className="pro-hotel-card" onClick={handleCardClick}>
      {/* Image Header Box */}
      <div className="pro-card-media">
        <img src={property.image} alt={property.name} loading="lazy" />
        
        {/* Floating Badges */}
        <div className="pro-media-badges">
          <span className="pro-badge-stay">
            <i className="fa-solid fa-sun" style={{ color: '#FFD700', marginRight: '4px' }}></i>
            Day & Night Stay
          </span>
        </div>

        {/* Wishlist Heart */}
        <button 
          type="button" 
          className={`pro-wishlist-btn ${isWishlisted ? 'saved' : ''}`}
          onClick={toggleWishlist}
          title={isWishlisted ? "Remove from favorites" : "Save to favorites"}
        >
          <i className={`fa-${isWishlisted ? 'solid' : 'regular'} fa-heart`}></i>
        </button>

        {/* Interactive Image Hover Info Overlay */}
        <div className="pro-image-hover-info">
          <div className="pro-hover-info-content">
            <span className="pro-hover-tag"><i className="fa-solid fa-bolt"></i> Instant Confirmation</span>
            <div className="pro-hover-perks">
              <span><i className="fa-solid fa-utensils"></i> Free Breakfast</span>
              <span><i className="fa-solid fa-wifi"></i> Free High-Speed WiFi</span>
              <span><i className="fa-solid fa-mountain-sun"></i> Scenic View Balcony</span>
            </div>
            <span className="pro-hover-click-hint">Click to View Details <i className="fa-solid fa-arrow-right"></i></span>
          </div>
        </div>

        {/* Amenities Pill Bar on Image */}
        <div className="pro-amenities-overlay">
          {defaultAmenities.map((amenity, idx) => (
            <span key={idx} className="pro-amenity-chip">
              {amenity}
            </span>
          ))}
        </div>
      </div>

      {/* Card Info Box */}
      <div className="pro-card-body">
        <div className="pro-card-top-row">
          <span className="pro-type-tag">{property.type || 'Luxury Villa'}</span>
          <div className="pro-rating-badge">
            <i className="fa-solid fa-star" style={{ color: '#D4AF37' }}></i>
            <span className="pro-rating-score">{property.rating || '4.8'}</span>
            <span className="pro-review-count">({reviewsCount})</span>
          </div>
        </div>

        <h3 className="pro-card-title">{property.name}</h3>

        <p className="pro-card-location">
          <i className="fa-solid fa-location-dot"></i>
          <span>{property.location}</span>
        </p>

        {/* Footer Price & Action */}
        <div className="pro-card-footer">
          <div className="pro-price-block">
            <div className="pro-price-original">{originalPrice}</div>
            <div className="pro-price-main">
              {numericPrice} <span className="pro-price-unit">/ night</span>
            </div>
          </div>

          <button 
            type="button" 
            className="pro-book-btn" 
            onClick={handleBookNow}
          >
            <span>Book Now</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
