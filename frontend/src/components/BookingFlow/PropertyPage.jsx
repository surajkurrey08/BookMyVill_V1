import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Amenity, Breadcrumb, DateGuestFields, FlowShell, Notice, addDays, bookingApi, icon, propertyPhotos, queryFor, rupees, today, useProperty } from './shared';

export default function PropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { property, loading, error, bookable } = useProperty(id);
  const [search, setSearch] = useState(() => ({ checkIn: params.get('checkIn') || addDays(today(), 1), checkOut: params.get('checkOut') || addDays(today(), 3), guests: Math.max(1, Number(params.get('guests')) || 2) }));
  const [rooms, setRooms] = useState([]);
  const [roomError, setRoomError] = useState('');
  const [activePhoto, setActivePhoto] = useState(0);
  const [activeTab, setActiveTab] = useState('Overview');
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]').some(value => String(value) === String(id)); } catch { return false; } });
  const [copied, setCopied] = useState(false);
  const photos = propertyPhotos(property);
  const amenities = Array.isArray(property?.amenities) ? property.amenities : [];
  const roomRates = rooms.filter(room => room.baseRate > 0).map(room => room.baseRate);
  const startingRate = roomRates.length ? Math.min(...roomRates) : Number(String(property?.priceValue ?? property?.price ?? 0).replace(/[^\d.]/g, '')) || 0;
  const canBook = bookable && rooms.some(room => room.status === 'available');
  const route = `/property/${id}/rooms?${queryFor(search)}`;

  useEffect(() => {
    if (!bookable) return undefined;
    const controller = new AbortController();
    bookingApi(`/properties/${id}/rooms?${queryFor(search)}`, { signal: controller.signal })
      .then(data => { setRooms(data.rooms); setRoomError(''); })
      .catch(err => { if (err.name !== 'AbortError') { setRooms([]); setRoomError(err.message); } });
    return () => controller.abort();
  }, [id, bookable, search]);

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); }
  };
  const toggleSaved = () => {
    try {
      const current = JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]');
      const next = saved ? current.filter(value => String(value) !== String(id)) : [...new Set([...current, id])];
      localStorage.setItem('bookmyvilla-explore-favorites', JSON.stringify(next));
    } catch { /* Browser storage can be unavailable in private sessions. */ }
    setSaved(value => !value);
  };
  const goRooms = roomId => navigate(`${route}${roomId ? `&room=${roomId}` : ''}`, { state: { property } });
  const tabTargets = { Overview: 'bf-overview', Rooms: 'bf-rooms', Amenities: 'bf-amenities', 'Property Highlights': 'bf-highlights', 'House Rules': 'bf-rules', 'Nearby Places': 'bf-nearby', 'Guest Reviews': 'bf-reviews' };

  return <FlowShell>
    <Breadcrumb items={[{ label: 'Explore Stays', to: '/explore' }, { label: property?.name || 'Property' }]} />
    {error && <Notice tone="error">{error}</Notice>}
    {loading && !property ? <div className="bf-panel bf-loading">Loading this stay…</div> : !property ? <div className="bf-panel bf-empty"><h1>Stay not found</h1><Link to="/explore">Explore stays</Link></div> : <>
      <div className="bf-detail-grid">
        <div className="bf-detail-main">
          <div className="bf-gallery"><div className="bf-gallery-primary"><img src={photos[activePhoto % photos.length]} alt={property.name} /><span className="bf-rating-badge">{property.rating ? `★ ${Number(property.rating).toFixed(1)}${property.reviewsCount ? ` (${property.reviewsCount})` : ''}` : 'Explore this stay'}</span><button type="button" className="bf-gallery-next" aria-label="Next photo" onClick={() => setActivePhoto(index => (index + 1) % photos.length)}>{icon('chevron-right')}</button><span className="bf-gallery-count">{activePhoto + 1} / {photos.length}</span></div><div className="bf-gallery-stack">{[1, 2, 3].map((offset, index) => <button type="button" key={offset} onClick={() => setActivePhoto((activePhoto + offset) % photos.length)} aria-label={`View photo ${index + 2}`}><img src={photos[(activePhoto + offset) % photos.length]} alt={`${property.name} view ${index + 2}`} />{index === 2 && <span className="bf-more-photos">{icon('images')} View photos</span>}</button>)}</div></div>
          <div className="bf-amenity-strip" id="bf-amenities">{(amenities.length ? amenities : ['Property photos', 'Guest support']).slice(0, 5).map(label => <Amenity key={label} label={label} />)}</div>
        </div>
        <aside className="bf-panel bf-property-booking"><div className="bf-title-actions"><h1>{property.name}</h1><div><button type="button" onClick={toggleSaved} aria-label={saved ? 'Remove saved stay' : 'Save stay'}>{icon('heart')} <span>{saved ? 'Saved' : 'Save'}</span></button><button type="button" onClick={share}>{icon('share-nodes')} <span>{copied ? 'Copied' : 'Share'}</span></button></div></div><p className="bf-location">{icon('location-dot')}{property.location || 'Mahabaleshwar'}</p>{property.rating && <p className="bf-rating">★ <strong>{Number(property.rating).toFixed(1)}</strong> {property.reviewsCount ? `(${property.reviewsCount} reviews)` : ''}</p>}<p className="bf-muted bf-property-intro">Explore {property.name} in {property.location || 'Mahabaleshwar'}, review its rooms, and choose dates for your stay.</p><DateGuestFields {...search} onChange={setSearch} /><div className="bf-price-action"><div><strong>{rupees(startingRate)}</strong><span> / night</span><small>Starting price</small></div><button type="button" className="bf-primary" onClick={() => goRooms()}>Check Availability {icon('arrow-right')}</button></div><div className="bf-trust-row"><span>{icon('shield-halved')} Secure booking</span><span>{icon('calendar-days')} Real availability</span><span>{icon('headset')} Guest support</span></div></aside>
      </div>
      <nav className="bf-tabs" aria-label="Property sections">{Object.entries(tabTargets).map(([tab, target]) => <a key={tab} href={`#${target}`} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</a>)}</nav>
      <div className="bf-overview-layout" id="bf-overview"><section className="bf-panel bf-about"><h2>About This Stay</h2><p>{property.description || `${property.name} is a ${property.type || 'stay'} in ${property.location || 'Mahabaleshwar'}. Browse the available rooms and choose the dates that work for your trip.`}</p><div className="bf-about-facts"><span>{icon('hotel')}<small>Property Type</small><strong>{property.type || 'Stay'}</strong></span><span>{icon('location-dot')}<small>Location</small><strong>{property.location}</strong></span><span>{icon('calendar-check')}<small>Check-in</small><strong>{property.stayInfo?.checkInTime || 'Confirm with property'}</strong></span><span>{icon('calendar-xmark')}<small>Check-out</small><strong>{property.stayInfo?.checkOutTime || 'Confirm with property'}</strong></span></div></section>
      <section className="bf-panel bf-choose" id="bf-rooms"><div className="bf-section-head"><div><h2>Choose Your Stay</h2><p>Explore rooms available for your dates.</p></div><Link to={route}>View All Rooms {icon('arrow-right')}</Link></div>{roomError && <Notice tone="error">{roomError}</Notice>}{rooms.length ? <div className="bf-room-teasers">{rooms.slice(0, 3).map((room, index) => <article key={room._id} className="bf-teaser"><img src={photos[(index + 1) % photos.length]} alt={room.name} /><div><h3>{room.name}</h3><p>{icon('users')} {room.capacity} guests <span>{icon('bed')} {room.type}</span></p><div className="bf-teaser-bottom"><strong>{rupees(room.baseRate)}<small> / night</small></strong><button type="button" className="bf-primary" onClick={() => goRooms(room._id)} disabled={room.status !== 'available'}>{room.status === 'available' ? 'Select Room' : 'Unavailable'} {icon('arrow-right')}</button></div></div></article>)}</div> : <div className="bf-empty-inline">{bookable ? 'No rooms are configured for this property yet.' : 'Online room booking is not available for this stay yet.'}</div>}</section></div>
      <div className="bf-info-grid"><section className="bf-panel" id="bf-highlights"><h2>Property Highlights</h2>{(amenities.length ? amenities.slice(0, 3) : ['Explore the property gallery']).map(label => <p key={label}>{icon('circle-check')} {label}</p>)}</section><section className="bf-panel"><h2>Amenities</h2>{amenities.length ? amenities.slice(0, 6).map(label => <p key={label}>{icon('circle-check')} {label}</p>) : <p>Ask the property about available amenities.</p>}</section><section className="bf-panel" id="bf-rules"><h2>House Rules</h2>{property.stayInfo?.houseRules?.length ? property.stayInfo.houseRules.map(rule => <p key={rule}>{icon('circle-check')} {rule}</p>) : <p>House rules will be shared by the property.</p>}</section><section className="bf-panel" id="bf-nearby"><h2>Nearby Places</h2><p>{icon('location-dot')} {property.location || 'Mahabaleshwar'}</p>{property.mapLink && <a href={property.mapLink} target="_blank" rel="noreferrer">Get Directions {icon('arrow-right')}</a>}</section><section className="bf-panel" id="bf-reviews"><h2>Guest Reviews</h2>{property.reviews?.length ? property.reviews.slice(0, 2).map(review => <p key={review._id}>★ {review.rating} · {review.guestName}: {review.reviewText}</p>) : <p>Guest reviews are not available yet.</p>}</section></div>
      {!canBook && bookable && <Notice>There are no rooms available for the selected dates. Try different dates in the booking form.</Notice>}
    </>}
  </FlowShell>;
}
