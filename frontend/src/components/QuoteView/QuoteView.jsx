import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { loadRazorpayCheckout } from '../../utils/razorpayCheckout';
import BrandLogo from '../Brand/BrandLogo';
import './QuoteView.css';

const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const longDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function timeLeft(iso, now) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} days`;
}

const STATUS_NOTE = {
  expired: { icon: 'fa-hourglass-end', title: 'This quotation has expired', text: 'Prices and availability may have changed. Ask your host for an updated quotation.' },
  withdrawn: { icon: 'fa-rotate-left', title: 'This quotation is no longer available', text: 'Your host has withdrawn it. Contact them for the latest offer.' },
  rejected: { icon: 'fa-circle-xmark', title: 'You declined this quotation', text: 'Changed your mind? Contact your host and they can send a new one.' }
};

async function call(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/public/quotes/${path}`, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.msg || 'Something went wrong. Please try again.'); error.status = response.status; throw error; }
  return data;
}

export default function QuoteView() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [photoFailed, setPhotoFailed] = useState(false);

  const load = useCallback(async () => {
    try { const data = await call(token); setQuote(data); setName(current => current || data.guestName || ''); setError(''); }
    catch (err) { setError(err.message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { document.title = quote ? `Quotation ${quote.code} · ${quote.property.name}` : 'Your quotation · BookMyVilla'; }, [quote]);

  async function act(path, body, message) {
    setBusy(true); setError(''); setNotice('');
    try { setQuote(await call(`${token}/${path}`, { method: 'POST', body: JSON.stringify(body) })); setMode(null); setNotice(message); }
    catch (err) { setError(err.message); if (err.status === 409 || err.status === 410) load(); }
    finally { setBusy(false); }
  }

  async function pay() {
    setBusy(true); setError(''); setNotice('');
    try {
      const order = await call(`${token}/pay`, { method: 'POST' });
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: 'BookMyVilla', description: order.description, prefill: order.prefill, theme: { color: '#2D433D' },
        handler: async payment => {
          try {
            const result = await call(`${token}/verify`, { method: 'POST', body: JSON.stringify(payment) });
            setQuote(result.quote); setNotice(result.msg);
          } catch (err) { setError(err.message); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      checkout.on('payment.failed', response => { setError(response.error?.description || 'Payment failed. No booking was made; you can try again.'); setBusy(false); });
      checkout.open();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (!quote) {
    return <div className="qv-page"><header className="qv-top"><Link to="/" aria-label="BookMyVilla home"><BrandLogo /></Link></header>
      <main className="qv-main">{error ? <div className="qv-card qv-center"><i className="fa-solid fa-link-slash" aria-hidden="true"></i><h1>We could not open this quotation</h1><p>{error}</p><Link className="qv-btn" to="/explore">Explore stays</Link></div> : <p className="qv-loading" aria-live="polite">Loading your quotation…</p>}</main>
    </div>;
  }

  const left = quote.validUntil ? timeLeft(quote.validUntil, now) : null;
  const canRespond = ['sent', 'viewed'].includes(quote.status) && left;
  const hostDigits = (quote.host.phone || '').replace(/\D/g, '');
  const hostWhatsApp = hostDigits ? `https://wa.me/${hostDigits.length === 10 ? `91${hostDigits}` : hostDigits}?text=${encodeURIComponent(`Hello, about quotation ${quote.code} for ${quote.property.name}.`)}` : '';
  const statusNote = STATUS_NOTE[quote.status];
  const guests = [`${quote.stay.adults} adult${quote.stay.adults === 1 ? '' : 's'}`, quote.stay.children && `${quote.stay.children} child${quote.stay.children === 1 ? '' : 'ren'}`, quote.stay.infants && `${quote.stay.infants} infant${quote.stay.infants === 1 ? '' : 's'}`, quote.stay.pets && `${quote.stay.pets} pet${quote.stay.pets === 1 ? '' : 's'}`].filter(Boolean).join(', ');

  return <div className="qv-page">
    <header className="qv-top"><Link to="/" aria-label="BookMyVilla home"><BrandLogo /></Link><button type="button" className="qv-ghost" onClick={() => window.print()}><i className="fa-solid fa-print" aria-hidden="true"></i> Print / save PDF</button></header>
    <main className="qv-main">
      {quote.replacedBy && <div className="qv-banner info" role="status"><i className="fa-solid fa-circle-info" aria-hidden="true"></i><div>A newer version of this quotation is available. <Link to={quote.replacedBy}>Open the latest quotation</Link></div></div>}
      {!quote.replacedBy && quote.replaced && quote.status === 'withdrawn' && <div className="qv-banner info" role="status"><i className="fa-solid fa-circle-info" aria-hidden="true"></i><div>Your host is preparing an updated quotation and will share the new link.</div></div>}
      {error && <div className="qv-banner error" role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i><div>{error}</div></div>}
      {notice && <div className="qv-banner success" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true"></i><div>{notice}</div></div>}

      <section className="qv-hero">
        {quote.property.photo && !photoFailed && <img src={quote.property.photo} alt={quote.property.name} onError={() => setPhotoFailed(true)} />}
        <div>
          <p className="qv-eyebrow">Quotation {quote.code} · prepared for {quote.guestName}</p>
          <h1>{quote.property.name}</h1>
          <p className="qv-sub"><i className="fa-solid fa-location-dot" aria-hidden="true"></i> {quote.property.location}{quote.property.mapLink && <> · <a href={quote.property.mapLink} target="_blank" rel="noreferrer">Map</a></>}</p>
          {canRespond && <p className="qv-validity"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Valid for {left} (until {dateTime(quote.validUntil)})</p>}
        </div>
      </section>

      {statusNote && !quote.replacedBy && <div className="qv-card qv-status"><i className={`fa-solid ${statusNote.icon}`} aria-hidden="true"></i><div><h2>{statusNote.title}</h2><p>{statusNote.text}</p></div></div>}
      {quote.status === 'converted' && <div className="qv-card qv-status success"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i><div><h2>Your stay is booked</h2><p>{quote.booking?.paymentStatus === 'paid' ? 'Payment received — see you soon!' : 'Your host has confirmed the booking. Follow their instructions to complete payment.'}</p></div></div>}
      {quote.status === 'accepted' && <div className="qv-card qv-status success"><i className="fa-solid fa-handshake" aria-hidden="true"></i><div>
        <h2>You accepted this quotation</h2>
        {quote.onlinePayment ? <p>Pay {rupees(quote.totals.total)} securely online to confirm your stay right away.</p> : <p>Your host will confirm the booking and share payment details with you.</p>}
        {quote.onlinePayment && <button type="button" className="qv-btn" onClick={pay} disabled={busy}><i className="fa-solid fa-lock" aria-hidden="true"></i> {busy ? 'Opening payment…' : `Pay ${rupees(quote.totals.total)}`}</button>}
      </div></div>}

      <div className="qv-grid">
        <section className="qv-card">
          <h2>Your stay</h2>
          <dl className="qv-facts">
            <div><dt>Check-in</dt><dd>{longDate(quote.stay.checkIn)}</dd></div>
            <div><dt>Check-out</dt><dd>{longDate(quote.stay.checkOut)}</dd></div>
            <div><dt>Nights</dt><dd>{quote.stay.nights}</dd></div>
            <div><dt>Guests</dt><dd>{guests}</dd></div>
            <div className="wide"><dt>Accommodation</dt><dd>{quote.room.name}{quote.room.type ? ` · ${quote.room.type}` : ''}{quote.room.capacity ? ` · sleeps ${quote.room.capacity}` : ''}</dd></div>
          </dl>
          {quote.notesToGuest && <><h3>From your host</h3><p className="qv-note">{quote.notesToGuest}</p></>}
          <h3>Cancellation policy</h3>
          <p className="qv-note">{quote.cancellationText}</p>
        </section>

        <section className="qv-card">
          <h2>Price</h2>
          <dl className="qv-lines">
            <div><dt>{rupees(quote.nightlyRate)} × {quote.stay.nights} night{quote.stay.nights === 1 ? '' : 's'}</dt><dd>{rupees(quote.totals.accommodation)}</dd></div>
            {quote.addOns.map(line => <div key={line.name}><dt>{line.name} <small>{line.quantity > 1 ? `× ${line.quantity} ` : ''}{line.unit}</small></dt><dd>{rupees(line.amount)}</dd></div>)}
            {quote.fees.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{rupees(line.amount)}</dd></div>)}
            {quote.discounts.map(line => <div key={line.label} className="discount"><dt>{line.label}</dt><dd>−{rupees(line.amount)}</dd></div>)}
            {quote.totals.tax > 0 && <div><dt>Taxes{quote.accommodationTaxRate ? <small> (stay {quote.accommodationTaxRate}% GST)</small> : null}</dt><dd>{rupees(quote.totals.tax)}</dd></div>}
            <div className="total"><dt>Total</dt><dd>{rupees(quote.totals.total)}</dd></div>
          </dl>
          <dl className="qv-lines small">
            {quote.schedule.balanceAmount > 0 ? <>
              <div><dt>{quote.advancePercent > 0 ? 'Advance to confirm' : 'Due before arrival'}</dt><dd>{rupees(quote.schedule.advanceAmount)}</dd></div>
              <div><dt>Balance by {longDate(quote.schedule.balanceDueDate)}</dt><dd>{rupees(quote.schedule.balanceAmount)}</dd></div>
            </> : <div><dt>Payable to confirm</dt><dd>{rupees(quote.totals.total)}</dd></div>}
            {quote.securityDeposit > 0 && <div><dt>Refundable security deposit (collected separately)</dt><dd>{rupees(quote.securityDeposit)}</dd></div>}
          </dl>

          {canRespond && !mode && <div className="qv-actions">
            <button type="button" className="qv-btn" onClick={() => setMode('accept')}><i className="fa-solid fa-check" aria-hidden="true"></i> Accept quotation</button>
            <button type="button" className="qv-ghost" onClick={() => setMode('decline')}>Decline</button>
          </div>}
          {canRespond && mode === 'accept' && <form className="qv-form" onSubmit={event => { event.preventDefault(); act('accept', { name, agree }, quote.onlinePayment ? 'Thank you! You can now pay to confirm your stay.' : 'Thank you! Your host has been notified and will confirm your booking.'); }}>
            <label>Your full name<input required minLength="2" maxLength="100" value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
            <label className="qv-check"><input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} required /> I have read the price, payment schedule and cancellation policy.</label>
            <div className="qv-actions"><button type="button" className="qv-ghost" onClick={() => setMode(null)}>Back</button><button className="qv-btn" disabled={busy || !agree}>{busy ? 'Sending…' : 'Confirm acceptance'}</button></div>
          </form>}
          {canRespond && mode === 'decline' && <form className="qv-form" onSubmit={event => { event.preventDefault(); act('reject', { reason }, 'Thanks for letting us know. Your host has been notified.'); }}>
            <label>Anything we should know? (optional)<textarea maxLength="300" rows="3" value={reason} onChange={event => setReason(event.target.value)} placeholder="Dates changed, found another place, budget…" /></label>
            <div className="qv-actions"><button type="button" className="qv-ghost" onClick={() => setMode(null)}>Back</button><button className="qv-btn danger" disabled={busy}>Decline quotation</button></div>
          </form>}
        </section>
      </div>

      <section className="qv-card qv-host">
        <div><h2>Questions?</h2><p>{quote.host.name} prepared this quotation for you.</p></div>
        <div className="qv-actions">
          {hostWhatsApp && <a className="qv-btn" href={hostWhatsApp} target="_blank" rel="noreferrer"><i className="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp host</a>}
          {quote.host.phone && <a className="qv-ghost" href={`tel:${quote.host.phone.replace(/[^\d+]/g, '')}`}><i className="fa-solid fa-phone" aria-hidden="true"></i> Call</a>}
        </div>
      </section>
      <p className="qv-fine">Prices are in Indian Rupees. This quotation is not a booking until it is confirmed by your host or paid online.</p>
    </main>
  </div>;
}
