import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './PropertyCard.css';

const PropertyCard = ({ property, onSelectMapPin, index = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isHeartBouncing, setIsHeartBouncing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const rawPriceNum = parseInt(property?.price?.toString().replace(/[^0-9]/g, '') || '8500');
  const numericPrice = `₹${rawPriceNum.toLocaleString('en-IN')}`;
  const originalPrice = `₹${Math.round(rawPriceNum * 1.25).toLocaleString('en-IN')}`;
  const reviewsCount = property?.reviewsCount || (((String(property?._id || property?.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 80) + 35);

  const handleCardClick = (e) => {
    if (e) e.stopPropagation();
    const propertyId = property?._id || property?.id;
    if (propertyId) {
      navigate(`/property/${propertyId}`, { state: { property } });
    }
  };

  const handleMapPin = (e) => {
    if (e) e.stopPropagation();
    if (onSelectMapPin) {
      onSelectMapPin(property);
    } else {
      const propertyId = property?._id || property?.id;
      navigate(`/explore?select=${propertyId}`);
    }
  };

  const toggleWishlist = (e) => {
    e.stopPropagation();
    setIsWishlisted(prev => !prev);
    setIsHeartBouncing(true);
    setTimeout(() => setIsHeartBouncing(false), 350);
  };

  if (!property) return null;

  return (
    <div 
      className="pro-hotel-card" 
      onClick={handleCardClick}
      style={{ '--card-index': index }}
    >
      {/* 1. IMAGE MEDIA CONTAINER WITH OVERLAY */}
      <div className="pro-card-media">
        {!imageLoaded && (
          <div className="skeleton-box" style={{ position: 'absolute', inset: 0, zIndex: 1 }}></div>
        )}
        <img 
          src={property.image} 
          alt={property.name} 
          loading="lazy" 
          onLoad={() => setImageLoaded(true)}
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />

        {/* Hover Quick Action Overlay */}
        <div className="pro-card-hover-overlay">
          <span className="pro-hover-action-btn">
            View Details <i className="fa-solid fa-arrow-right"></i>
          </span>
        </div>
        
        {/* Category / Status Badge with Subtle Pulse */}
        <span className="pro-type-badge-media">
          {property.tag ? property.tag.toUpperCase() : (property.type || 'LUXURY STAY')}
        </span>

        {/* Floating Wishlist Heart Button */}
        <button 
          type="button" 
          className={`pro-wishlist-btn ${isWishlisted ? 'saved' : ''} ${isHeartBouncing ? 'heart-bounce' : ''}`}
          onClick={toggleWishlist}
          title={isWishlisted ? "Remove from favorites" : "Save to favorites"}
        >
          <i className={`fa-${isWishlisted ? 'solid' : 'regular'} fa-heart`}></i>
        </button>
      </div>

      {/* 2. CARD BODY: PRICING & DETAILS */}
      <div className="pro-card-body">
        {/* Price & Rating Row */}
        <div className="pro-card-price-row">
          <div className="pro-price-container">
            <span className="pro-price-orig">{originalPrice}</span>
            <span className="pro-price-main">{numericPrice}</span>
            <span className="pro-price-unit">/ night</span>
          </div>

          <div className="pro-rating-badge">
            <i className="fa-solid fa-star" style={{ color: '#D4AF37' }}></i>
            <span className="pro-rating-score">{property.rating || '4.8'}</span>
            <span className="pro-review-count">({reviewsCount})</span>
          </div>
        </div>

        <h3 className="pro-card-title" title={property.name}>{property.name}</h3>

        <p className="pro-card-location">
          <i className="fa-solid fa-location-dot"></i>
          <span>{property.location || 'Mahabaleshwar'}</span>
        </p>

        {/* 3. CARD FOOTER BUTTONS */}
        <div className="pro-card-footer">
          <button 
            type="button" 
            className="pro-btn-action pro-btn-view-primary" 
            onClick={handleCardClick}
            title="View property details"
          >
            <i className="fa-solid fa-eye" style={{ color: '#f5d061' }}></i>
            <span>View Details</span>
          </button>

          <button 
            type="button" 
            className="pro-btn-action pro-btn-pin" 
            onClick={handleMapPin}
            title="Locate hotel on map"
          >
            <i className="fa-solid fa-location-dot" style={{ color: '#d4af37' }}></i>
            <span>Map Pin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
