import { Link } from 'react-router-dom';
import './PropertyCard.css';

const PropertyCard = ({ property }) => {
  return (
    <div className="property-card">
      <div className="card-image">
        <img src={property.image} alt={property.name} />
        <span className="card-tag">{property.tag}</span>
        <div className="card-overlay">
          <Link to={`/property/${property._id || property.id}`} className="btn-primary" style={{ textDecoration: 'none' }}>
            Book Now
          </Link>
        </div>
      </div>
      <div className="card-info">
        <div className="card-header">
          <h3>{property.name}</h3>
          <div className="rating-wrapper">
            <span className="rating">★ {property.rating}</span>
            <span className="reviews">({property.reviewsCount || Math.floor(Math.random() * 80) + 20} reviews)</span>
          </div>
        </div>
        <p className="location">{property.location}</p>
        <div className="card-footer">
          <span className="type">{property.type}</span>
          <span className="price"><b>{property.price}</b> / night</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
