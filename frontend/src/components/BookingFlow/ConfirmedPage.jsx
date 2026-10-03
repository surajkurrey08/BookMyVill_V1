import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Amenity, Breadcrumb, FlowShell, Notice, bookingApi, fallbackPhotos, icon, longDate, photoUrl, rupees, token } from './shared';

const formatTime = value => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ConfirmedPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const uploadRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [guestNames, setGuestNames] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [panel, setPanel] = useState('');

  useEffect(() => {
    if (!token()) { navigate('/signin', { state: { from: `/booking/${bookingId}/confirmed` } }); return; }
    bookingApi(`/bookings/${bookingId}/confirmation`, { auth: true })
      .then(result => { setData(result); setArrivalTime(result.booking.guestDetails?.arrivalTime || ''); setGuestNames((result.booking.guestDetails?.additionalGuests || []).join('\n')); setError(''); })
      .catch(err => setError(err.message));
  }, [bookingId, navigate]);

  const update = async body => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await bookingApi(`/bookings/${bookingId}/precheckin`, { method: 'POST', auth: true, body });
      setData(current => ({ ...current, booking: { ...current.booking, guestDetails: { ...current.booking.guestDetails, ...result.guestDetails } } }));
      setNotice('Pre check-in details saved.'); setPanel('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1400000) { setError('Choose a JPG, PNG or WebP image under 1.4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => update({ idProof: reader.result });
    reader.onerror = () => setError('Could not read the image. Please try another file.');
    reader.readAsDataURL(file);
  };
  const action = name => {
    if (name === 'Upload ID Proof') uploadRef.current?.click();
    else if (name === 'Add Guest Details' || name === 'Share Arrival Time' || name === 'View House Rules') setPanel(value => value === name ? '' : name);
    else if (name === 'Get Directions' && data.booking.property?.mapLink) window.open(data.booking.property.mapLink, '_blank', 'noopener,noreferrer');
    else if (name === 'Caretaker Contact' && data.booking.property?.assignedCaretaker?.phone) window.location.href = `tel:${data.booking.property.assignedCaretaker.phone}`;
    else setNotice('Contact the property for these details.');
  };

  const booking = data?.booking;
  const property = booking?.property;
  const room = booking?.room;
  const photo = photoUrl(property?.photos?.[0]) || fallbackPhotos[0];
  const nights = booking ? Math.max(1, Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000)) : 0;
  const precheckin = [
    { title: 'Upload ID Proof', detail: booking?.guestDetails?.idUploaded ? 'ID uploaded securely' : 'Government ID for all guests', icon: 'id-card' },
    { title: 'Add Guest Details', detail: 'Share names & contact details', icon: 'user' },
    { title: 'Share Arrival Time', detail: booking?.guestDetails?.arrivalTime || 'Let us know your estimated arrival', icon: 'car' },
    { title: 'View House Rules', detail: 'Know property guidelines', icon: 'file-lines' },
    { title: 'Get Directions', detail: 'Maps & location details', icon: 'location-dot' },
    { title: 'Caretaker Contact', detail: 'Get property support contact', icon: 'phone' }
  ];
  const manage = [
    { title: 'Download Invoice', detail: 'Print your booking receipt', icon: 'file-invoice', onClick: () => window.print() },
    { title: 'View Booking', detail: 'See full booking details', icon: 'file-lines', onClick: () => navigate(`/trips/${bookingId}`) },
    { title: 'Contact Property', detail: property?.assignedCaretaker?.phone || 'Ask for property contact', icon: 'phone-volume', onClick: () => property?.assignedCaretaker?.phone ? window.location.href = `tel:${property.assignedCaretaker.phone}` : setNotice('Property contact is not available yet.') },
    { title: 'Modify Booking', detail: 'Contact the property to request changes', icon: 'calendar-pen', onClick: () => setNotice('Please contact the property to request a booking change.') },
    { title: 'Cancellation Policy', detail: 'View policy details', icon: 'file-contract', onClick: () => setPanel('Cancellation Policy') },
    { title: 'Need Help?', detail: 'Guest support and service requests', icon: 'circle-question', onClick: () => navigate(`/trips/${bookingId}`) }
  ];

  return <FlowShell><Breadcrumb items={[{ label: 'My Trips', to: '/dashboard' }, { label: 'Booking Confirmed' }]} />
    {error && <Notice tone="error">{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {!booking ? <div className="bf-panel bf-loading">{error ? <Link to="/dashboard">Open My Trips</Link> : 'Loading your confirmed booking…'}</div> : <>
      <section className="bf-confirm-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.92) 35%, rgba(255,255,255,.04) 68%, rgba(4,49,38,.85) 100%), url(${photo})` }}><div className="bf-confirm-copy"><span className="bf-confirm-icon">{icon('check')}</span><h1>Booking Confirmed!</h1><p>Thank you for choosing BookMyVilla. Your stay at {property?.name} is confirmed.</p></div><div className="bf-confirm-facts"><span>{icon('file-lines')}<small>Booking ID</small><strong>{String(booking._id).slice(-8).toUpperCase()}</strong></span><span>{icon('building')}<small>Property</small><strong>{property?.name}</strong></span><span>{icon('calendar-days')}<small>Check-in</small><strong>{longDate(booking.checkIn)}</strong></span><span>{icon('calendar-days')}<small>Check-out</small><strong>{longDate(booking.checkOut)}</strong></span><span>{icon('user')}<small>Guests</small><strong>{booking.guests} Guests</strong></span><span>{icon('bed')}<small>Room</small><strong>{room?.name}</strong></span></div></section>
      <div className="bf-timeline">{[{ label: 'Booking Confirmed', sub: formatTime(booking.createdAt), icon: 'check', done: true }, { label: 'Pre Check-in', sub: 'Complete guest details', icon: 'user' }, { label: 'Upload ID', sub: booking.guestDetails?.idUploaded ? 'Uploaded' : 'Required for check-in', icon: 'id-card', done: booking.guestDetails?.idUploaded }, { label: 'Arrival Time', sub: booking.guestDetails?.arrivalTime || 'Share your ETA', icon: 'clock', done: Boolean(booking.guestDetails?.arrivalTime) }, { label: 'Check-in', sub: longDate(booking.checkIn), icon: 'calendar-days', done: booking.stayStatus === 'in_house' || booking.stayStatus === 'checked_out' }, { label: 'Stay', sub: 'Enjoy your stay', icon: 'bed', done: booking.stayStatus === 'checked_out' }].map((step, index) => <div key={step.label} className={`bf-timeline-step ${step.done ? 'is-done' : ''}`}><span>{icon(step.icon)}</span><strong>{step.label}</strong><small>{step.sub}</small>{index < 5 && <i className="bf-timeline-line" />}</div>)}</div>
      <div className="bf-confirm-layout"><div><section className="bf-panel bf-stay-detail"><h2>Your Stay Details</h2><div className="bf-stay-top"><img src={photo} alt={property?.name} /><div><h3>{property?.name}</h3><p className="bf-location">{icon('location-dot')} {property?.location}</p><p>Your confirmed room and stay dates are shown below.</p><div className="bf-stay-facts"><span>{icon('calendar-days')}<small>Check-in</small><strong>{longDate(booking.checkIn)}</strong></span><span>{icon('calendar-days')}<small>Check-out</small><strong>{longDate(booking.checkOut)}</strong></span><span>{icon('user')}<small>Guests</small><strong>{booking.guests} Guests</strong></span><span>{icon('bed')}<small>Room</small><strong>{room?.name}</strong></span></div></div></div><div className="bf-payment-status"><span>{icon('credit-card')}<small>Payment Status</small><strong>{rupees(data.amountPaid)} Paid <em>Payment Successful</em></strong></span><span>{icon('wallet')}<small>Amount Paid</small><strong>{rupees(data.amountPaid)}</strong><small>({nights} night{nights === 1 ? '' : 's'})</small></span><span>{icon('circle-check')}<small>Remaining Balance</small><strong>{rupees(data.remainingBalance)}</strong><small>Fully Paid</small></span></div></section>
        <section className="bf-panel bf-precheckin"><div className="bf-section-head"><h2>Complete Pre Check-in</h2><p>Save time at the property by completing these steps in advance.</p></div><div className="bf-action-grid">{precheckin.map(item => <button type="button" key={item.title} onClick={() => action(item.title)}><span>{icon(item.icon)}</span><strong>{item.title}</strong><small>{item.detail}</small>{icon('chevron-right')}</button>)}</div><input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="bf-sr-only" aria-label="Upload ID proof" />
          {panel === 'Add Guest Details' && <form className="bf-inline-form" onSubmit={event => { event.preventDefault(); update({ additionalGuests: guestNames.split('\n').map(value => value.trim()).filter(Boolean) }); }}><label>Additional guest names, one per line<textarea value={guestNames} onChange={event => setGuestNames(event.target.value)} placeholder="Full name of each additional guest" /></label><button className="bf-primary" disabled={busy}>Save guest details</button></form>}
          {panel === 'Share Arrival Time' && <form className="bf-inline-form" onSubmit={event => { event.preventDefault(); update({ arrivalTime }); }}><label>Expected arrival time<input type="time" value={arrivalTime} onChange={event => setArrivalTime(event.target.value)} required /></label><button className="bf-primary" disabled={busy}>Save arrival time</button></form>}
          {panel === 'View House Rules' && <div className="bf-inline-form"><h3>House Rules</h3>{property?.stayInfo?.houseRules?.length ? property.stayInfo.houseRules.map(rule => <p key={rule}>{icon('circle-check')} {rule}</p>) : <p>The property has not published house rules yet.</p>}</div>}
        </section><section className="bf-panel bf-before-arrive"><div className="bf-section-head"><h2>Before You Arrive</h2><p>Important details for a smooth stay.</p></div><div>{(property?.amenities || []).slice(0, 4).map(label => <Amenity key={label} label={label} />)}{!(property?.amenities || []).length && <p>Check your trip details or contact the property for arrival information.</p>}</div></section></div>
      <aside><section className="bf-panel bf-manage"><h2>Manage Your Stay</h2>{manage.map(item => <button type="button" key={item.title} onClick={item.onClick}>{icon(item.icon)}<span><strong>{item.title}</strong><small>{item.detail}</small></span>{icon('chevron-right')}</button>)}{panel === 'Cancellation Policy' && <div className="bf-policy-text">{booking.cancellationPolicy || 'Contact the property for cancellation terms.'}</div>}</section><div className="bf-confirm-cta"><h3>All Set for a Memorable Stay!</h3><p>Your escape to {property?.name} is just around the corner.</p><Link to={`/trips/${bookingId}`}>Continue to My Trips {icon('arrow-right')}</Link></div></aside></div>
    </>}
  </FlowShell>;
}
