import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { launchRazorpayCheckout } from '../../utils/razorpayCheckout';
import { Breadcrumb, FlowShell, Notice, bookingApi, fallbackPhotos, icon, longDate, photoUrl, rupees, token } from './shared';

const readUser = () => { try { return JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}'); } catch { return {}; } };
const addonPhoto = (addon, index) => addon.photo ? photoUrl(addon.photo) : fallbackPhotos[(index + 1) % fallbackPhotos.length];

export default function CheckoutPage() {
  const { holdId } = useParams();
  const navigate = useNavigate();
  const [hold, setHold] = useState(null);
  const [addons, setAddons] = useState([]);
  const [selected, setSelected] = useState([]);
  const [price, setPrice] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [method, setMethod] = useState('UPI');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(() => { const user = readUser(); return { name: user.name || '', phone: user.phone || '', email: user.email || '', arrivalTime: '', idType: 'Aadhaar Card', idNumber: '', specialRequests: '' }; });

  useEffect(() => {
    if (!token()) { navigate('/signin', { state: { from: `/booking/checkout/${holdId}` } }); return undefined; }
    const controller = new AbortController();
    Promise.all([bookingApi(`/holds/${holdId}`, { auth: true, signal: controller.signal }), bookingApi(`/holds/${holdId}/price`, { method: 'POST', auth: true, body: {}, signal: controller.signal })])
      .then(async ([data, initialPrice]) => { setHold(data); setPrice(initialPrice); setAddons(await bookingApi(`/properties/${data.property._id}/add-ons`, { signal: controller.signal })); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [holdId, navigate]);

  useEffect(() => {
    if (!hold) return undefined;
    const controller = new AbortController();
    bookingApi(`/holds/${holdId}/price`, { method: 'POST', auth: true, body: { addOns: selected, promoCode }, signal: controller.signal })
      .then(data => { setPrice(data); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') { setPrice(null); setError(err.message); } });
    return () => controller.abort();
  }, [hold, holdId, selected, promoCode]);

  const toggleAddon = id => setSelected(current => current.some(item => item.addOnId === id) ? current.filter(item => item.addOnId !== id) : [...current, { addOnId: id, quantity: 1 }]);
  const setField = (key, value) => setGuest(current => ({ ...current, [key]: value }));
  const applyPromo = event => { event.preventDefault(); setPromoCode(promoInput.trim().toUpperCase()); };
  const pay = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const order = await bookingApi(`/holds/${holdId}/pay`, { method: 'POST', auth: true, body: { guest, addOns: selected, promoCode } });
      setHold(current => ({ ...current, status: 'payment_pending' }));
      await launchRazorpayCheckout({ order, token: token(), propertyName: hold.property.name, user: guest,
        verifyPath: `/api/customer-booking/holds/${holdId}/verify`,
        onPaid: result => navigate(`/booking/${result.bookingId}/confirmed`, { replace: true }),
        onError: err => { setError(err.message); setBusy(false); },
        onDismiss: () => setBusy(false) });
    } catch (err) {
      if (err.status === 401) navigate('/signin', { state: { from: `/booking/checkout/${holdId}` } });
      else setError(err.message);
      setBusy(false);
    }
  };

  return <FlowShell><Breadcrumb items={[{ label: 'Explore Stays', to: '/explore' }, { label: hold?.property?.name || 'Property', to: hold ? `/property/${hold.property._id}` : undefined }, { label: 'Checkout' }]} />
    <div className="bf-checkout-head"><h1>Complete Your Booking</h1><p>Fill in your details, choose add-ons and make a secure payment to confirm your stay.</p></div>
    {error && <Notice tone="error">{error}</Notice>}
    {loading ? <div className="bf-panel bf-loading">Loading your room hold…</div> : !hold ? <div className="bf-panel bf-empty"><h2>This room hold is unavailable</h2><p>Select an available room to continue.</p><Link to="/explore">Explore stays</Link></div> : <form className="bf-checkout-layout" onSubmit={pay}><div className="bf-checkout-main">
      <section className="bf-panel bf-form-panel"><div className="bf-card-heading"><span>{icon('user')}</span><h2>Guest Details</h2><small>All fields are required unless marked optional</small></div><div className="bf-form-grid bf-three"><label>Full Name<input required autoComplete="name" value={guest.name} onChange={e => setField('name', e.target.value)} placeholder="Enter your full name" /></label><label>Mobile Number<input required type="tel" autoComplete="tel" value={guest.phone} onChange={e => setField('phone', e.target.value)} placeholder="+91 98765 43210" /></label><label>Email Address<input required type="email" autoComplete="email" value={guest.email} onChange={e => setField('email', e.target.value)} placeholder="you@example.com" /></label></div><div className="bf-form-grid bf-two"><label>Additional Guests<input readOnly value={`${Math.max(0, hold.guests - 1)} additional guest${hold.guests === 2 ? '' : 's'} · ${hold.guests} total`} /><small>Includes the primary guest.</small></label><label>Expected Arrival Time<input type="time" value={guest.arrivalTime} onChange={e => setField('arrivalTime', e.target.value)} /><small>Helps the property prepare for your arrival.</small></label></div><div className="bf-form-grid bf-id-grid"><label>Government ID Proof<select value={guest.idType} onChange={e => setField('idType', e.target.value)}><option>Aadhaar Card</option><option>Passport</option><option>Driving Licence</option><option>Voter ID</option></select></label><label className="bf-id-number">ID Number<input required value={guest.idNumber} onChange={e => setField('idNumber', e.target.value)} placeholder="Enter ID number" /><small>Only the last four characters are saved. Bring your ID at check-in.</small></label></div><label className="bf-wide-field">Special Requests <span>(Optional)</span><textarea maxLength={500} rows={2} value={guest.specialRequests} onChange={e => setField('specialRequests', e.target.value)} placeholder="e.g. early check-in, high floor, dietary preferences…" /><small>{guest.specialRequests.length}/500</small></label></section>
      <section className="bf-panel bf-addons"><div className="bf-card-heading"><span>{icon('bell-concierge')}</span><h2>Add-ons</h2><small>Make your stay more special with available services.</small></div>{addons.length ? <div className="bf-addon-grid">{addons.map((addon, index) => <label className={`bf-addon-card ${selected.some(item => item.addOnId === addon._id) ? 'is-selected' : ''}`} key={addon._id}><img src={addonPhoto(addon, index)} alt="" /><span className="bf-addon-copy"><input type="checkbox" disabled={hold.status === 'payment_pending'} checked={selected.some(item => item.addOnId === addon._id)} onChange={() => toggleAddon(addon._id)} /><span><strong>{addon.name}</strong><b>{rupees(addon.price)}</b> <small>/{addon.pricingUnit.replaceAll('_', ' ')}</small><em>{addon.description}</em></span></span></label>)}</div> : <p className="bf-muted">This property has not listed any optional add-ons.</p>}{hold.status === 'payment_pending' && <p className="bf-muted">Your payment order is ready. Add-on choices are locked for this order.</p>}</section>
      <section className="bf-panel bf-payment"><div className="bf-card-heading"><span>{icon('lock')}</span><h2>Payment Method</h2><small>Choose a secure payment method at checkout.</small></div><div className="bf-payment-tabs" role="group" aria-label="Preferred payment method">{['UPI', 'Card', 'Net Banking', 'Wallet'].map(item => <button key={item} type="button" className={method === item ? 'is-active' : ''} onClick={() => setMethod(item)}>{icon(item === 'UPI' ? 'qrcode' : item === 'Card' ? 'credit-card' : item === 'Net Banking' ? 'building-columns' : 'wallet')} {item}</button>)}</div><div className="bf-payment-hint">{icon('shield-halved')} Your payment details are entered securely in Razorpay. Select {method} in the payment window.</div></section>
    </div><aside className="bf-panel bf-checkout-summary"><div className="bf-card-heading"><span>{icon('calendar-check')}</span><h2>Booking Summary</h2></div><div className="bf-summary-property"><img src={photoUrl(hold.property.photos?.[0])} alt="" /><div><strong>{hold.property.name}</strong><span>{icon('location-dot')} {hold.property.location}</span></div></div><div className="bf-summary-room"><img src={photoUrl(hold.room.photos?.[0] || hold.property.photos?.[1] || hold.property.photos?.[0])} alt="" /><div><strong>{hold.room.name}</strong><span>{icon('bed')} {hold.room.type}</span><span>{icon('user')} {hold.guests} Guests</span></div><Link to={`/property/${hold.property._id}/rooms?checkIn=${hold.checkIn}&checkOut=${hold.checkOut}&guests=${hold.guests}`}>Change Room</Link></div><div className="bf-summary-dates"><span>{icon('calendar-days')}<strong>{longDate(hold.checkIn)}</strong></span><span>{icon('arrow-right')}</span><span><strong>{longDate(hold.checkOut)}</strong></span><strong>{hold.nights} Nights</strong></div>{price ? <><div className="bf-price-lines"><div><span>Room Rate <small>{rupees(price.nightlyRate)} × {price.nights} night{price.nights === 1 ? '' : 's'}</small></span><strong>{rupees(price.accommodation)}</strong></div>{price.addOns.map(item => <div key={item.addOnId || item.name}><span>{item.name}<small>{item.quantity} × {rupees(item.unitPrice)}</small></span><strong>{rupees(item.amount)}</strong></div>)}{price.discount > 0 && <div><span>Discount {price.promoCode && `(${price.promoCode})`}</span><strong>−{rupees(price.discount)}</strong></div>}{price.tax > 0 && <div><span>Taxes</span><strong>{rupees(price.tax)}</strong></div>}{price.securityDeposit > 0 && <div><span>Refundable Security Deposit</span><strong>{rupees(price.securityDeposit)}</strong></div>}</div><div className="bf-total-line"><strong>Total Amount</strong><strong>{rupees(price.total)}</strong></div><div className="bf-due-now"><span><strong>Amount Due Now</strong><small>Pay now to confirm your booking</small></span><strong>{rupees(price.amountDueNow)}</strong></div></> : <p>Calculating the final amount…</p>}<div className="bf-promo"><label htmlFor="bf-promo-input">{icon('tag')} Have a Promo Code?</label><div><input id="bf-promo-input" value={promoInput} disabled={hold.status === 'payment_pending'} onChange={e => setPromoInput(e.target.value)} placeholder="Enter promo code" /><button type="button" disabled={hold.status === 'payment_pending'} onClick={applyPromo}>Apply</button></div></div><div className="bf-policy"><strong>{icon('shield-halved')} Cancellation Policy</strong><p>{price?.cancellationPolicy || 'Confirm the cancellation policy before paying.'}</p></div><button type="submit" className="bf-primary bf-full" disabled={busy || !price}>{busy ? 'Opening secure payment…' : hold.status === 'payment_pending' ? 'Resume Secure Payment' : 'Pay & Confirm Booking'} {icon('arrow-right')}</button><div className="bf-trust-row"><span>{icon('shield-halved')} Secure Payment</span><span>{icon('check-circle')} Verified Confirmation</span></div></aside></form>}
  </FlowShell>;
}
