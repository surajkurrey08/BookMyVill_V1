import { useNavigate, useLocation } from 'react-router-dom';
import './PropertyCard.css';

const PropertyCard = ({ property }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBookNow = (e) => {
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

  return (
    <div className="property-card">
      <div className="card-image">
        <img src={property.image} alt={property.name} />
        <span className="card-tag">{property.tag}</span>
        <div className="card-overlay">
          <button onClick={handleBookNow} className="btn-primary" style={{ textDecoration: 'none', border: 'none', cursor: 'pointer' }}>
            Book Now
          </button>
        </div>
      </div>
      <div className="card-info">
        <div className="card-header">
          <h3>{property.name}</h3>
          <div className="rating-wrapper">
            <span className="rating">★ {property.rating}</span>
            <span className="reviews">({property.reviewsCount || (((String(property._id || property.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 80) + 20)} reviews)</span>
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
