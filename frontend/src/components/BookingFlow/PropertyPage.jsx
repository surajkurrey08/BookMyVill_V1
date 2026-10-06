import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Gallery from './Gallery';
import { Amenity, Breadcrumb, DateGuestFields, FlowShell, Notice, addDays, bookingApi, icon, propertyPhotos, queryFor, rupees, today, token, useProperty } from './shared';

// Blue tick: verified by BookMyVilla (managed villas, or owners Admin has verified).
export function VerifiedTick() {
  return <span className="bf-verified" title="Verified by BookMyVilla" aria-label="Verified by BookMyVilla">{icon('circle-check')}<span>Verified</span></span>;
}

export default function PropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { property, loading, error, bookable } = useProperty(id);
  const [search, setSearch] = useState(() => ({ checkIn: params.get('checkIn') || addDays(today(), 1), checkOut: params.get('checkOut') || addDays(today(), 3), guests: Math.max(1, Number(params.get('guests')) || 2) }));
  const [rooms, setRooms] = useState([]);
  const [roomError, setRoomError] = useState('');
  const [activeTab, setActiveTab] = useState('Overview');
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]').some(value => String(value) === String(id)); } catch { return false; } });
  const [copied, setCopied] = useState(false);
  const photos = propertyPhotos(property);
  const amenities = Array.isArray(property?.amenities) ? property.amenities : [];
  const roomRates = rooms.filter(room => room.baseRate > 0).map(room => room.baseRate);
  const startingRate = roomRates.length ? Math.min(...roomRates) : Number(String(property?.priceValue ?? property?.price ?? 0).replace(/[^\d.]/g, '')) || 0;
  // Whole-villa properties are one bookable unit: no room step, book it straight from here.
  const unit = rooms.length === 1 ? rooms[0] : null;
  const nights = Math.max(1, Math.round((new Date(`${search.checkOut}T12:00:00`) - new Date(`${search.checkIn}T12:00:00`)) / 86400000) || 1);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const villaStatus = !unit ? null : unit.status === 'available' ? { tone: 'ok', text: 'Available for your dates' } : unit.status === 'capacity_exceeded' ? { tone: 'warn', text: `This villa sleeps up to ${unit.capacity} guests` } : { tone: 'warn', text: 'Already booked for these dates — try other dates' };
  const bookVilla = async () => {
    if (!unit || unit.status !== 'available') return;
    const here = `/property/${id}?${queryFor(search)}`;
    if (!token()) { navigate('/signin', { state: { from: here } }); return; }
    setBooking(true); setBookError('');
    try {
      const hold = await bookingApi('/holds', { method: 'POST', auth: true, body: { propertyId: id, roomId: unit._id, ...search } });
      navigate(`/booking/checkout/${hold.holdId}`);
    } catch (err) {
      if (err.status === 401) navigate('/signin', { state: { from: here } });
      else setBookError(err.message);
    } finally { setBooking(false); }
  };

  useEffect(() => {
    if (!bookable) return undefined;
    const controller = new AbortController();
    bookingApi(`/properties/${id}/rooms?${queryFor(search)}`, { signal: controller.signal })
      .then(data => { setRooms(data.rooms.filter(room => room.active !== false)); setRoomError(''); })
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
  const tabTargets = { Overview: 'bf-overview', 'The Villa': 'bf-rooms', Amenities: 'bf-amenities', 'Property Highlights': 'bf-highlights', 'House Rules': 'bf-rules', 'Nearby Places': 'bf-nearby', 'Guest Reviews': 'bf-reviews' };

  return <FlowShell>
    <Breadcrumb items={[{ label: 'Explore Stays', to: '/explore' }, { label: property?.name || 'Property' }]} />
    {error && <Notice tone="error">{error}</Notice>}
    {loading && !property ? <div className="bf-panel bf-loading">Loading this stay…</div> : !property ? <div className="bf-panel bf-empty"><h1>Stay not found</h1><Link to="/explore">Explore stays</Link></div> : <>
      <div className="bf-detail-grid">
        <div className="bf-detail-main">
          <Gallery photos={photos} name={property.name} badge={<span className="bf-rating-badge">{property.rating ? `★ ${Number(property.rating).toFixed(1)}${property.reviewsCount ? ` (${property.reviewsCount})` : ''}` : property.verified ? <>{icon('circle-check')} Verified stay</> : 'Explore this stay'}</span>} />
          <div className="bf-amenity-strip" id="bf-amenities">{(amenities.length ? amenities : ['Property photos', 'Guest support']).slice(0, 5).map(label => <Amenity key={label} label={label} />)}</div>
        </div>
        <aside className="bf-panel bf-property-booking"><div className="bf-title-actions"><h1>{property.name}{property.verified && <VerifiedTick />}</h1><div><button type="button" onClick={toggleSaved} aria-label={saved ? 'Remove saved stay' : 'Save stay'}>{icon('heart')} <span>{saved ? 'Saved' : 'Save'}</span></button><button type="button" onClick={share}>{icon('share-nodes')} <span>{copied ? 'Copied' : 'Share'}</span></button></div></div><p className="bf-location">{icon('location-dot')}{property.location || 'Mahabaleshwar'}</p>{property.rating && <p className="bf-rating">★ <strong>{Number(property.rating).toFixed(1)}</strong> {property.reviewsCount ? `(${property.reviewsCount} reviews)` : ''}</p>}<p className="bf-muted bf-property-intro">Explore {property.name} in {property.location || 'Mahabaleshwar'}, choose dates and guests for your stay.</p><DateGuestFields {...search} onChange={setSearch} /><>
        <div className="bf-price-action"><div><strong>{rupees(unit?.baseRate ?? startingRate)}</strong><span> / night</span><small>Entire villa{unit ? ` · up to ${unit.capacity} guests` : ''}</small></div><button type="button" className="bf-primary" onClick={bookVilla} disabled={booking || !unit || unit.status !== 'available'}>{booking ? 'Holding villa…' : 'Book Entire Villa'} {icon('arrow-right')}</button></div>
        {villaStatus && <p className={`bf-villa-status bf-villa-${villaStatus.tone}`}>{icon(villaStatus.tone === 'ok' ? 'circle-check' : 'circle-exclamation')} <span>{villaStatus.text}{unit.status === 'available' && <small>{nights} night{nights === 1 ? '' : 's'} · {rupees(unit.baseRate * nights)} before add-ons</small>}</span></p>}
        {bookError && <Notice tone="error">{bookError}</Notice>}
      </><div className="bf-trust-row"><span>{icon('shield-halved')} Secure booking</span><span>{icon('calendar-days')} Real availability</span><span>{icon('headset')} Guest support</span></div></aside>
      </div>
      <nav className="bf-tabs" aria-label="Property sections">{Object.entries(tabTargets).map(([tab, target]) => <a key={tab} href={`#${target}`} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</a>)}</nav>
      <div className="bf-overview-layout" id="bf-overview"><section className="bf-panel bf-about"><h2>About This Stay</h2><p>{property.description || `${property.name} is a ${property.type || 'stay'} in ${property.location || 'Mahabaleshwar'}. Book the whole villa for your group and choose the dates that work for your trip.`}</p><div className="bf-about-facts"><span>{icon('hotel')}<small>Property Type</small><strong>{property.type || 'Stay'} · entire place</strong></span>{property.details?.guestCapacity && <span>{icon('users')}<small>Guests</small><strong>Up to {property.details.guestCapacity}</strong></span>}{property.details?.bedrooms !== undefined && <span>{icon('bed')}<small>Bedrooms</small><strong>{property.details.bedrooms}</strong></span>}{property.details?.bathrooms !== undefined && <span>{icon('bath')}<small>Bathrooms</small><strong>{property.details.bathrooms}</strong></span>}<span>{icon('location-dot')}<small>Location</small><strong>{property.location}</strong></span><span>{icon('calendar-check')}<small>Check-in</small><strong>{property.arrival?.checkInTime || 'Confirm with property'}</strong></span><span>{icon('calendar-xmark')}<small>Check-out</small><strong>{property.arrival?.checkOutTime || 'Confirm with property'}</strong></span></div></section>
      <section className="bf-panel bf-choose" id="bf-rooms"><div className="bf-section-head"><div><h2>The Whole Villa Is Yours</h2><p>Book the entire villa — private for your group, no shared rooms.</p></div></div>{roomError && <Notice tone="error">{roomError}</Notice>}{unit ? <article className="bf-teaser bf-villa-unit"><img src={photos[1 % photos.length]} alt={property.name} /><div><h3>Entire {String(property.type || 'villa').toLowerCase()}</h3><p>{icon('users')} Up to {unit.capacity} guests <span>{icon('house')} Private stay</span></p><div className="bf-teaser-bottom"><strong>{rupees(unit.baseRate)}<small> / night</small></strong><button type="button" className="bf-primary" onClick={bookVilla} disabled={booking || unit.status !== 'available'}>{unit.status === 'available' ? 'Book Entire Villa' : 'Unavailable'} {icon('arrow-right')}</button></div></div></article> : <div className="bf-empty-inline">{bookable ? 'Online booking opens once this villa is set up for whole-villa stays.' : 'Online booking is not available for this stay yet.'}</div>}</section></div>
      <div className="bf-info-grid"><section className="bf-panel" id="bf-highlights"><h2>Property Highlights</h2>{(amenities.length ? amenities.slice(0, 3) : ['Explore the property gallery']).map(label => <p key={label}>{icon('circle-check')} {label}</p>)}</section><section className="bf-panel"><h2>Amenities</h2>{amenities.length ? amenities.slice(0, 6).map(label => <p key={label}>{icon('circle-check')} {label}</p>) : <p>Ask the property about available amenities.</p>}</section><section className="bf-panel" id="bf-rules"><h2>House Rules</h2>{property.arrival?.houseRules?.length ? property.arrival.houseRules.map(rule => <p key={rule}>{icon('circle-check')} {rule}</p>) : <p>House rules will be shared by the property.</p>}</section><section className="bf-panel" id="bf-nearby"><h2>Nearby Places</h2><p>{icon('location-dot')} {property.location || 'Mahabaleshwar'}</p>{property.mapLink && <a href={property.mapLink} target="_blank" rel="noreferrer">Get Directions {icon('arrow-right')}</a>}</section><section className="bf-panel" id="bf-reviews"><h2>Guest Reviews</h2>{property.reviews?.length ? property.reviews.slice(0, 2).map(review => <p key={review._id}>★ {review.rating} · {review.guestName}: {review.reviewText}</p>) : <p>Guest reviews are not available yet.</p>}</section></div>
    </>}
  </FlowShell>;
}
