import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Amenity, Breadcrumb, DateGuestFields, FlowShell, Notice, addDays, bookingApi, icon, longDate, photoUrl, propertyPhotos, queryFor, rupees, today, useProperty } from './shared';

export default function RoomsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { property, bookable } = useProperty(id);
  const [search, setSearch] = useState(() => ({ checkIn: params.get('checkIn') || addDays(today(), 1), checkOut: params.get('checkOut') || addDays(today(), 3), guests: Math.max(1, Number(params.get('guests')) || 2) }));
  const [draft, setDraft] = useState(search);
  const [result, setResult] = useState(null);
  const [hold, setHold] = useState(null);
  const [filter, setFilter] = useState('All Rooms');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const photos = propertyPhotos(property);
  const selected = result?.rooms.find(room => String(room._id) === String(hold?.room?._id || hold?.room)) || hold?.room;
  const filters = ['All Rooms', ...new Set((result?.rooms || []).map(room => room.type || room.name))];
  const shown = useMemo(() => (result?.rooms || []).filter(room => filter === 'All Rooms' || room.type === filter), [filter, result]);
  const detailPath = `/property/${id}?${queryFor(search)}`;

  useEffect(() => {
    if (!bookable) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    bookingApi(`/properties/${id}/rooms?${queryFor(search)}`, { signal: controller.signal })
      .then(data => { setResult(data); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, bookable, search]);

  useEffect(() => {
    const holdId = params.get('hold');
    if (!holdId) return undefined;
    const controller = new AbortController();
    bookingApi(`/holds/${holdId}`, { auth: true, signal: controller.signal })
      .then(data => setHold(data))
      .catch(err => { if (err.name !== 'AbortError') { setHold(null); setError(err.message); } });
    return () => controller.abort();
  }, [params]);

  const updateSearch = event => {
    event.preventDefault();
    if (hold?.holdId) bookingApi(`/holds/${hold.holdId}`, { method: 'DELETE', auth: true }).catch(() => {});
    setHold(null); setFilter('All Rooms'); setSearch(draft); setParams(queryFor(draft));
  };
  const select = async room => {
    if (room.status !== 'available') return;
    setBusy(true); setError('');
    try {
      if (hold?.holdId) await bookingApi(`/holds/${hold.holdId}`, { method: 'DELETE', auth: true });
      const next = await bookingApi('/holds', { method: 'POST', auth: true, body: { propertyId: id, roomId: room._id, ...search } });
      setHold(next);
      setParams(`${queryFor(search)}&hold=${next.holdId}`);
    } catch (err) {
      if (err.status === 401) navigate('/signin', { state: { from: `${window.location.pathname}${window.location.search}` } });
      else setError(err.message);
    } finally { setBusy(false); }
  };

  return <FlowShell><Breadcrumb items={[{ label: 'Explore Stays', to: '/explore' }, { label: property?.name || 'Property', to: detailPath }, { label: 'Select Room' }]} />
    <div className="bf-rooms-layout"><div className="bf-rooms-main">
      <section className="bf-panel bf-compact-property"><img src={photos[0]} alt={property?.name || 'Property'} /><div><div className="bf-section-head"><h1>{property?.name || 'Choose your room'}</h1><Link to={detailPath}>View Property Details {icon('arrow-right')}</Link></div><p className="bf-location">{icon('location-dot')}{property?.location || 'Mahabaleshwar'}</p>{property?.rating && <p className="bf-rating">★ {Number(property.rating).toFixed(1)} {property.reviewsCount ? `(${property.reviewsCount} reviews)` : ''}</p>}<p className="bf-muted">Choose the room that fits your stay. Availability is checked by the property inventory.</p><div className="bf-compact-amenities">{(property?.amenities || []).slice(0, 5).map(label => <Amenity key={label} label={label} />)}</div></div></section>
      <form className="bf-panel bf-update-search" onSubmit={updateSearch}><DateGuestFields {...draft} onChange={setDraft} compact /><button className="bf-primary" type="submit">Update Search</button></form>
      <div className="bf-room-filters" role="group" aria-label="Room categories">{filters.map(name => <button key={name} type="button" className={filter === name ? 'is-active' : ''} onClick={() => setFilter(name)}>{name} ({name === 'All Rooms' ? result?.rooms.length || 0 : result?.rooms.filter(room => room.type === name).length || 0})</button>)}</div>
      <div className="bf-availability-note">{icon('clock')}<div><strong>Rooms are checked for your dates</strong><span>Availability is confirmed by the property before a room is held.</span></div><span>{icon('fire-flame-curved')} Selected rooms are held for 10 minutes.</span></div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <div className="bf-panel bf-loading">Checking available rooms…</div>}
      {!loading && !shown.length && <div className="bf-panel bf-empty"><h2>No rooms available online</h2><p>{bookable ? 'This property has no rooms in its online inventory for these dates. Try another stay or ask the property.' : 'This stay is not available for online room selection.'}</p><Link to="/explore">Explore other stays {icon('arrow-right')}</Link></div>}
      {!loading && shown.map((room, index) => <article className={`bf-panel bf-room-card ${selected?._id === room._id ? 'is-selected' : ''}`} key={room._id}><div className="bf-room-photo"><img src={room.photos?.[0] ? photoUrl(room.photos[0]) : photos[(index + 1) % photos.length]} alt={room.name} /><span>{room.type}</span></div><div className="bf-room-copy"><h2>{room.name}</h2><p className="bf-muted">{room.type} · Room {room.number}</p><div className="bf-room-facts"><span>{icon('users')} {room.capacity} Guests</span>{room.bedType && <span>{icon('bed')} {room.bedType}</span>}{room.view && <span>{icon('mountain')} {room.view}</span>}{room.sizeSqFt && <span>{icon('expand')} {room.sizeSqFt} sq. ft.</span>}</div><h3>Room Inclusions</h3><div className="bf-room-inclusions">{(room.amenities?.length ? room.amenities : property?.amenities || []).slice(0, 6).map(label => <span key={label}>{icon('check')} {label}</span>)}</div></div><div className="bf-room-price"><p className="bf-green">{icon('shield-halved')} {room.status === 'available' ? 'Available for your dates' : room.status === 'temporary_hold' && selected?._id === room._id ? 'Held for you' : room.status.replaceAll('_', ' ')}</p><strong>{rupees(room.baseRate)}<small> / night</small></strong><span>Price before any configured add-ons</span><button type="button" className="bf-primary" onClick={() => select(room)} disabled={busy || (room.status !== 'available' && selected?._id !== room._id)}>{selected?._id === room._id ? 'Selected Room' : room.status === 'available' ? 'Select Room' : 'Unavailable'} {icon('arrow-right')}</button><Link to={detailPath}>View Property Details</Link></div></article>)}
    </div><aside className="bf-rooms-sidebar"><div className="bf-panel bf-booking-summary"><div className="bf-section-head"><h2>Your Booking Summary</h2><Link to={detailPath}>Edit</Link></div><div className="bf-summary-property"><img src={photos[0]} alt="" /><div><strong>{property?.name}</strong><span>{icon('location-dot')} {property?.location}</span></div></div><div className="bf-summary-dates"><span>{icon('calendar-days')}<small>Check-in</small><strong>{longDate(search.checkIn)}</strong></span><span>{icon('calendar-days')}<small>Check-out</small><strong>{longDate(search.checkOut)}</strong></span></div><div className="bf-summary-guests">{icon('user')} {search.guests} Guest{search.guests === 1 ? '' : 's'}, 1 Room</div><div className="bf-summary-selection">{selected ? <><strong>{selected.name}</strong><span>Room held until {new Date(hold.expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span><strong>{rupees(selected.baseRate)} / night</strong></> : <><strong>No room selected yet</strong><span>Please select a room from the available options to continue with your booking.</span></>}</div><button type="button" className="bf-primary bf-full" disabled={!hold || busy} onClick={() => navigate(`/booking/checkout/${hold.holdId}`)}>Continue Booking {icon('arrow-right')}</button><p className="bf-summary-note">{icon('lock')} You won’t be charged yet <span>{icon('shield-halved')} Secure checkout</span></p></div><div className="bf-side-callout bf-cream"><h3>{icon('bed')} Exact Room Selection</h3><p>Choose a room from the property’s current inventory. The hold protects your dates during checkout.</p>{['Select the exact room you want', 'View real room availability', 'Room held for 10 minutes'].map(item => <span key={item}>{icon('circle-check')} {item}</span>)}</div><div className="bf-side-callout bf-mint"><h3>Why Book with BookMyVilla?</h3><span>{icon('shield-halved')} Secure payment</span><span>{icon('clock')} Live inventory</span><span>{icon('headset')} Guest support</span></div></aside></div>
  </FlowShell>;
}
