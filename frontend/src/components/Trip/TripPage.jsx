import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { stayApi, isSignedIn } from '../../lib/stayApi';
import BrandLogo from '../Brand/BrandLogo';
import './Trip.css';

const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const longDate = value => new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = value => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const REQUEST_CATEGORIES = [
  { value: 'towels', label: 'Towels / linen', icon: 'fa-bath' },
  { value: 'water', label: 'Drinking water', icon: 'fa-bottle-water' },
  { value: 'housekeeping', label: 'Room cleaning', icon: 'fa-broom' },
  { value: 'food', label: 'Food / meals', icon: 'fa-utensils' },
  { value: 'extra_bed', label: 'Extra bed', icon: 'fa-bed' },
  { value: 'taxi', label: 'Taxi / cab', icon: 'fa-taxi' },
  { value: 'amenities', label: 'Amenities', icon: 'fa-pump-soap' },
  { value: 'checkout_help', label: 'Checkout help', icon: 'fa-right-from-bracket' },
  { value: 'other', label: 'Something else', icon: 'fa-ellipsis' }
];
const ISSUE_CATEGORIES = [
  { value: 'ac', label: 'AC / cooling', icon: 'fa-snowflake' },
  { value: 'cleaning', label: 'Cleanliness', icon: 'fa-broom' },
  { value: 'water', label: 'Water', icon: 'fa-droplet' },
  { value: 'wifi', label: 'Wi-Fi', icon: 'fa-wifi' },
  { value: 'noise', label: 'Noise', icon: 'fa-volume-high' },
  { value: 'pool', label: 'Pool', icon: 'fa-water-ladder' },
  { value: 'staff', label: 'Staff', icon: 'fa-user' },
  { value: 'billing', label: 'Billing', icon: 'fa-receipt' },
  { value: 'safety', label: 'Safety', icon: 'fa-shield-halved' },
  { value: 'other', label: 'Other issue', icon: 'fa-ellipsis' }
];
const REQUEST_STATUS = {
  open: { label: 'Requested', icon: 'fa-paper-plane', tone: 'blue' },
  acknowledged: { label: 'Seen by property', icon: 'fa-eye', tone: 'blue' },
  in_progress: { label: 'Being handled', icon: 'fa-person-running', tone: 'amber' },
  completed: { label: 'Done', icon: 'fa-circle-check', tone: 'green' },
  declined: { label: 'Not possible', icon: 'fa-circle-xmark', tone: 'muted' },
  cancelled: { label: 'Cancelled', icon: 'fa-ban', tone: 'muted' }
};
const whatsapp = (phone, text) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('request');
  const [form, setForm] = useState({ category: 'towels', description: '', photos: [] });
  const [busy, setBusy] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [review, setReview] = useState(null);

  const load = useCallback(async () => {
    try { setTrip(await stayApi(`/stay/trips/${id}`)); setError(''); }
    catch (err) { setError(err.message); if (err.status === 401) navigate('/signin'); }
  }, [id, navigate]);
  useEffect(() => { if (!isSignedIn()) { navigate('/signin'); return; } load(); }, [load, navigate]);
  useEffect(() => { document.title = trip ? `Your stay · ${trip.property.name}` : 'Your stay · BookMyVilla'; }, [trip]);

  const categories = tab === 'issue' ? ISSUE_CATEGORIES : REQUEST_CATEGORIES;
  useEffect(() => { setForm(current => ({ ...current, category: categories[0].value })); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitRequest(event) {
    event.preventDefault();
    if (form.description.trim().length < 3) { setError('Please describe what you need.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await stayApi('/stay/requests', { method: 'POST', body: { bookingId: id, kind: tab, category: form.category, description: form.description.trim(), photos: form.photos } });
      setForm({ category: categories[0].value, description: '', photos: [] });
      setNotice(tab === 'issue' ? 'Reported. The property has been notified.' : 'Sent to the property. You will see updates here.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function cancelRequest(requestId) {
    setBusy(true); setError('');
    try { await stayApi(`/stay/requests/${requestId}/cancel`, { method: 'POST' }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_400_000) { setError('Please choose an image under 1.4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(current => ({ ...current, photos: [...current.photos, reader.result].slice(0, 3) }));
    reader.readAsDataURL(file);
  }

  async function submitReview(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: trip.property._id, rating: review.rating, reviewText: review.text.trim() || 'Great stay!', guestName: 'Verified guest' })
      });
      if (!response.ok) throw new Error('Could not submit your review.');
      setReview(null); setNotice('Thank you for your review!');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (!trip) {
    return <div className="trip-page"><TripHeader /><main className="trip-main">
      {error ? <div className="trip-card trip-center"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i><h1>We could not open this trip</h1><p>{error}</p><Link className="trip-btn" to="/dashboard">My trips</Link></div> : <p className="trip-loading" aria-live="polite">Loading your stay…</p>}
    </main></div>;
  }

  const { booking, property, stay, deposit, refund, timeline, requests, can } = trip;
  const statusLabel = booking.status === 'cancelled' ? 'Cancelled' : booking.stayStatus === 'checked_out' ? 'Stay complete' : booking.stayStatus === 'in_house' ? 'You are checked in' : booking.paymentStatus === 'paid' ? 'Confirmed' : 'Payment pending';
  const directions = property.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.name} ${property.location}`)}`;

  return <div className="trip-page">
    <TripHeader />
    <main className="trip-main">
      {error && <div className="trip-banner error" role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i><div>{error}</div><button type="button" onClick={() => setError('')} aria-label="Dismiss"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button></div>}
      {notice && <div className="trip-banner success" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true"></i><div>{notice}</div><button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button></div>}

      <section className="trip-hero">
        {property.photo && <img src={property.photo} alt={property.name} onError={event => { event.currentTarget.style.display = 'none'; }} />}
        <div>
          <span className={`trip-status ${booking.status === 'cancelled' ? 'muted' : booking.stayStatus === 'in_house' ? 'live' : 'ok'}`}><i className="fa-solid fa-circle" aria-hidden="true"></i> {statusLabel}</span>
          <h1>{property.name}</h1>
          <p className="trip-loc"><i className="fa-solid fa-location-dot" aria-hidden="true"></i> {property.location}</p>
          <p className="trip-dates">{longDate(booking.checkIn)} → {longDate(booking.checkOut)} · {booking.nights} night{booking.nights === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}{booking.roomLabel ? ` · ${booking.roomLabel}` : ''}</p>
        </div>
      </section>

      <section className="trip-card">
        <h2>Your booking</h2>
        <ol className="trip-timeline">
          {timeline.map(step => <li key={step.key} className={`state-${step.state}`}>
            <span className="trip-dot"><i className={`fa-solid ${step.state === 'done' ? 'fa-check' : step.state === 'current' ? 'fa-circle' : 'fa-circle'}`} aria-hidden="true"></i></span>
            <span>{step.label}</span>
          </li>)}
        </ol>
      </section>

      <div className="trip-grid">
        <section className="trip-card">
          <h2>Getting there & settling in</h2>
          <ul className="trip-essentials">
            <li><span className="ikon"><i className="fa-solid fa-clock" aria-hidden="true"></i></span><div><strong>Check-in {stay.checkInTime}</strong><small>Checkout by {stay.checkOutTime}</small></div></li>
            <li><a href={directions} target="_blank" rel="noreferrer"><span className="ikon"><i className="fa-solid fa-diamond-turn-right" aria-hidden="true"></i></span><div><strong>Directions</strong><small>Open in Maps</small></div><i className="fa-solid fa-arrow-up-right-from-square go" aria-hidden="true"></i></a></li>
            {stay.caretaker && <li className="split">
              <span className="ikon"><i className="fa-solid fa-user-shield" aria-hidden="true"></i></span>
              <div><strong>{stay.caretaker.name}</strong><small>Your caretaker</small></div>
              <div className="trip-contact">{stay.caretaker.phone && <><a className="trip-mini" href={`tel:${stay.caretaker.phone.replace(/[^\d+]/g, '')}`} aria-label="Call caretaker"><i className="fa-solid fa-phone" aria-hidden="true"></i></a><a className="trip-mini" href={whatsapp(stay.caretaker.phone, `Hello, regarding my stay at ${property.name}.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp caretaker"><i className="fa-brands fa-whatsapp" aria-hidden="true"></i></a></>}</div>
            </li>}
            {stay.wifi && <li className="split">
              <span className="ikon"><i className="fa-solid fa-wifi" aria-hidden="true"></i></span>
              <div><strong>Wi-Fi · {stay.wifi.name}</strong><small>{stay.wifi.password ? (showWifi ? `Password: ${stay.wifi.password}` : 'Password hidden') : 'Ask your caretaker for the password'}</small></div>
              {stay.wifi.password && <button type="button" className="trip-mini" onClick={() => setShowWifi(value => !value)} aria-label={showWifi ? 'Hide password' : 'Show password'}><i className={`fa-solid ${showWifi ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i></button>}
            </li>}
          </ul>
          {stay.arrivalNotes && <div className="trip-note"><strong>Arrival notes</strong><p>{stay.arrivalNotes}</p></div>}
          {stay.houseRules.length > 0 && <div className="trip-note"><strong>House rules</strong><ul className="trip-rules">{stay.houseRules.map(rule => <li key={rule}><i className="fa-solid fa-check" aria-hidden="true"></i> {rule}</li>)}</ul></div>}
          {stay.foodInfo && <div className="trip-note"><strong>Food</strong><p>{stay.foodInfo}</p></div>}
        </section>

        <section className="trip-card">
          <h2>Payment & deposit</h2>
          <dl className="trip-lines">
            <div><dt>Booking total</dt><dd>{rupees(booking.totalPrice)}</dd></div>
            <div><dt>Paid</dt><dd>{rupees(booking.amountPaid)}</dd></div>
            {booking.amountPaid < booking.totalPrice && booking.status !== 'cancelled' && <div className="due"><dt>Due</dt><dd>{rupees(booking.totalPrice - booking.amountPaid)}</dd></div>}
          </dl>
          {deposit && <div className={`trip-track ${deposit.status}`}>
            <strong><i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Refundable deposit {rupees(deposit.amount)}</strong>
            <p>{deposit.status === 'held' ? 'Held during your stay. Refunded after checkout inspection, minus any damages.' : 'Checkout done — your deposit refund is being processed. You will be notified of the final amount.'}</p>
          </div>}
          {refund && <div className="trip-track refund">
            <strong><i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Refund {rupees(refund.amount)}</strong>
            <p>{refund.status === 'completed' ? 'Your refund has been processed.' : 'Your cancellation refund is under review. Contact support if you have questions.'}</p>
          </div>}
          {can.review && <button type="button" className="trip-btn ghost full" onClick={() => setReview({ rating: 5, text: '' })}><i className="fa-solid fa-star" aria-hidden="true"></i> Rate your stay</button>}
        </section>
      </div>

      <section className="trip-card">
        <div className="trip-card-head"><h2>Requests & help</h2></div>
        {requests.length > 0 && <ul className="trip-requests">{requests.map(item => {
          const meta = REQUEST_STATUS[item.status];
          const cat = [...REQUEST_CATEGORIES, ...ISSUE_CATEGORIES].find(c => c.value === item.category);
          return <li key={item._id}>
            <span className="req-ikon"><i className={`fa-solid ${cat?.icon || (item.kind === 'issue' ? 'fa-triangle-exclamation' : 'fa-bell')}`} aria-hidden="true"></i></span>
            <div className="req-body">
              <strong>{item.kind === 'issue' ? 'Issue: ' : ''}{cat?.label || item.category}</strong>
              <p>{item.description}</p>
              {item.eta && ['acknowledged', 'in_progress'].includes(item.status) && <small className="req-eta"><i className="fa-solid fa-clock" aria-hidden="true"></i> Expected in {item.eta}</small>}
              {item.updates.filter(u => u.note && u.byRole === 'owner').slice(-1).map((u, i) => <small key={i} className="req-reply"><i className="fa-solid fa-reply" aria-hidden="true"></i> “{u.note}”</small>)}
              <small className="req-time">{item.code} · {dateTime(item.createdAt)}</small>
            </div>
            <div className="req-side">
              <span className={`req-chip ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} aria-hidden="true"></i> {meta.label}</span>
              {['open', 'acknowledged'].includes(item.status) && <button type="button" className="trip-link" onClick={() => cancelRequest(item._id)} disabled={busy}>Cancel</button>}
            </div>
          </li>;
        })}</ul>}

        {(can.request || can.reportIssue) ? <div className="trip-new-request">
          <div className="trip-seg" role="tablist" aria-label="Request type">
            {can.request && <button type="button" role="tab" aria-selected={tab === 'request'} className={tab === 'request' ? 'active' : ''} onClick={() => setTab('request')}><i className="fa-solid fa-bell" aria-hidden="true"></i> Request a service</button>}
            {can.reportIssue && <button type="button" role="tab" aria-selected={tab === 'issue'} className={tab === 'issue' ? 'active' : ''} onClick={() => setTab('issue')}><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Report an issue</button>}
          </div>
          <form className="trip-form" onSubmit={submitRequest}>
            <div className="trip-cats">
              {categories.map(cat => <button type="button" key={cat.value} className={`trip-cat ${form.category === cat.value ? 'on' : ''}`} onClick={() => setForm({ ...form, category: cat.value })}><i className={`fa-solid ${cat.icon}`} aria-hidden="true"></i> {cat.label}</button>)}
            </div>
            <label className="trip-field"><span>{tab === 'issue' ? 'What is wrong?' : 'What do you need?'}</span>
              <textarea rows="3" maxLength="1000" required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder={tab === 'issue' ? 'e.g. The AC in the master bedroom is not cooling since last night.' : 'e.g. Please send 2 extra towels and 4 water bottles.'} />
            </label>
            {form.photos.length > 0 && <div className="trip-photos">{form.photos.map((src, i) => <div key={i} className="trip-thumb"><img src={src} alt={`Attachment ${i + 1}`} /><button type="button" onClick={() => setForm({ ...form, photos: form.photos.filter((_, j) => j !== i) })} aria-label="Remove photo"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button></div>)}</div>}
            <div className="trip-form-actions">
              {form.photos.length < 3 && <label className="trip-btn ghost small"><i className="fa-solid fa-camera" aria-hidden="true"></i> Add photo<input type="file" accept="image/*" hidden onChange={addPhoto} /></label>}
              <button className="trip-btn" disabled={busy}>{busy ? 'Sending…' : tab === 'issue' ? 'Report issue' : 'Send request'}</button>
            </div>
          </form>
        </div> : <p className="trip-muted">{booking.status === 'cancelled' ? 'This booking was cancelled.' : 'Your stay is complete. Contact support if you need anything.'}</p>}
      </section>

      <section className="trip-card trip-support">
        <div><h2>Need help?</h2><p>Our support team is here for payment, booking or stay questions.</p></div>
        <a className="trip-btn ghost" href={whatsapp('919000000000', `Support request for booking ${booking._id}`)} target="_blank" rel="noreferrer"><i className="fa-brands fa-whatsapp" aria-hidden="true"></i> Chat with support</a>
      </section>

      <Link className="trip-back-link" to="/dashboard"><i className="fa-solid fa-arrow-left" aria-hidden="true"></i> All my trips</Link>
    </main>

    {review && <div className="trip-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setReview(null); }}>
      <form className="trip-modal" onSubmit={submitReview}>
        <h2>Rate your stay</h2>
        <p className="trip-muted">at {property.name}</p>
        <div className="trip-stars" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={review.rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= review.rating ? 'on' : ''} onClick={() => setReview({ ...review, rating: n })}><i className="fa-solid fa-star" aria-hidden="true"></i></button>)}
        </div>
        <label className="trip-field"><span>Tell other travellers about it (optional)</span><textarea rows="3" maxLength="1000" value={review.text} onChange={event => setReview({ ...review, text: event.target.value })} /></label>
        <div className="trip-form-actions"><button type="button" className="trip-btn ghost" onClick={() => setReview(null)}>Not now</button><button className="trip-btn" disabled={busy}>Submit review</button></div>
      </form>
    </div>}
  </div>;
}

function TripHeader() {
  return <header className="trip-top"><Link to="/" aria-label="BookMyVilla home"><BrandLogo /></Link><Link className="trip-top-link" to="/dashboard"><i className="fa-solid fa-suitcase-rolling" aria-hidden="true"></i> My trips</Link></header>;
}
