import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { GUEST_SITE_URL } from '../../config';
import { rupees, dateTime, longDate, countdown, guestCount, whatsappLink, mailLink } from '../../lib/format';
import { QUOTE_STATUS, ACTIVITY, PRICING_UNITS } from './salesConfig';
import { Alert, Drawer, Icon, Labelled, Modal, StatusChip } from './ui';

function shareText(quote, link) {
  const first = quote.guest.name.split(' ')[0];
  const payment = quote.schedule.balanceAmount > 0
    ? `${quote.advancePercent > 0 ? `Advance ${rupees(quote.schedule.advanceAmount)} to confirm, ` : ''}balance ${rupees(quote.schedule.balanceAmount)} by ${longDate(quote.schedule.balanceDueDate)}.`
    : 'Full payment confirms the booking.';
  return [
    `Hello ${first}, here is your quotation ${quote.code} for ${quote.property?.name}.`,
    `${quote.roomSnapshot?.name} · ${longDate(quote.checkIn)} → ${longDate(quote.checkOut)} (${quote.nights} night${quote.nights === 1 ? '' : 's'}), ${guestCount(quote)}.`,
    `Total: ${rupees(quote.totals.total)}. ${payment}`,
    quote.validUntil ? `Valid until ${new Date(quote.validUntil).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : '',
    `View and accept: ${link}`
  ].filter(Boolean).join('\n');
}

function PrintDocument({ quote }) {
  return <div className="sd-print-root">
    <article className="sd-print-doc">
      <header><div><h1>{quote.property?.name}</h1><p>{quote.property?.location}</p></div><div className="right"><strong>Quotation {quote.code}</strong><p>Issued {longDate(quote.sentAt || quote.createdAt)}</p>{quote.validUntil && <p>Valid until {dateTime(quote.validUntil)}</p>}</div></header>
      <section className="grid"><div><h2>Guest</h2><p>{quote.guest.name}</p><p>{[quote.guest.phone, quote.guest.email].filter(Boolean).join(' · ')}</p></div><div><h2>Stay</h2><p>{quote.roomSnapshot?.name} ({quote.roomSnapshot?.type})</p><p>{longDate(quote.checkIn)} → {longDate(quote.checkOut)} · {quote.nights} night{quote.nights === 1 ? '' : 's'}</p><p>{guestCount(quote)}</p></div></section>
      <table>
        <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Accommodation · {quote.roomSnapshot?.name}</td><td className="num">{quote.nights} nights</td><td className="num">{rupees(quote.nightlyRate)}</td><td className="num">{rupees(quote.totals.accommodation)}</td></tr>
          {quote.addOns.map(line => <tr key={line.addOn}><td>{line.name} <small>({PRICING_UNITS[line.pricingUnit]?.toLowerCase()})</small></td><td className="num">{line.quantity}</td><td className="num">{rupees(line.unitPrice)}</td><td className="num">{rupees(line.amount)}</td></tr>)}
          {quote.fees.map((line, index) => <tr key={index}><td>{line.label}</td><td className="num">1</td><td className="num">{rupees(line.amount)}</td><td className="num">{rupees(line.amount)}</td></tr>)}
          {quote.promotion?.discountAmount > 0 && <tr><td>Offer {quote.promotion.code}</td><td></td><td></td><td className="num">−{rupees(quote.promotion.discountAmount)}</td></tr>}
          {quote.manualDiscount?.amount > 0 && <tr><td>Special discount</td><td></td><td></td><td className="num">−{rupees(quote.manualDiscount.amount)}</td></tr>}
        </tbody>
        <tfoot>
          {quote.totals.tax > 0 && <tr><td colSpan="3">Taxes{quote.accommodationTaxRate ? ` (accommodation ${quote.accommodationTaxRate}%)` : ''}</td><td className="num">{rupees(quote.totals.tax)}</td></tr>}
          <tr className="total"><td colSpan="3">Total payable</td><td className="num">{rupees(quote.totals.total)}</td></tr>
        </tfoot>
      </table>
      <section className="grid">
        <div><h2>Payment schedule</h2>{quote.schedule.balanceAmount > 0 ? <><p>{quote.advancePercent > 0 ? `Advance to confirm: ${rupees(quote.schedule.advanceAmount)}` : 'Nothing due now'}</p><p>Balance {rupees(quote.schedule.balanceAmount)} by {longDate(quote.schedule.balanceDueDate)}</p></> : <p>Full payment of {rupees(quote.totals.total)} confirms the booking.</p>}{quote.securityDeposit > 0 && <p>Refundable security deposit: {rupees(quote.securityDeposit)} (collected separately)</p>}</div>
        <div><h2>Cancellation policy</h2><p>{quote.cancellationText}</p></div>
      </section>
      {quote.notesToGuest && <section><h2>Notes</h2><p className="pre">{quote.notesToGuest}</p></section>}
    </article>
  </div>;
}

export default function QuoteDrawer({ quoteId, onClose, onChanged, onEdit, onRevised, onOpenLead, notify, refreshKey }) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [printing, setPrinting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try { setQuote(await api(`/owner-quotes/${quoteId}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [quoteId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!printing) return undefined;
    document.body.classList.add('sd-printing');
    const finish = () => setPrinting(false);
    window.addEventListener('afterprint', finish);
    const timer = setTimeout(() => window.print(), 60);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', finish); document.body.classList.remove('sd-printing'); };
  }, [printing]);

  async function run(action, success) {
    setBusy(true); setError('');
    try { const result = await action(); await load(); onChanged(); if (success) notify(typeof success === 'function' ? success(result) : success); return result; }
    catch (err) { setError(err.message); return null; }
    finally { setBusy(false); }
  }

  const logShare = channel => api(`/owner-quotes/${quoteId}/share`, { method: 'POST', body: { channel } }).then(load).catch(() => {});

  if (!quote) return <Drawer title="Quotation" onClose={onClose}>{error ? <Alert>{error}</Alert> : <p className="sd-muted">Loading quotation…</p>}</Drawer>;

  const link = `${GUEST_SITE_URL}${quote.publicPath}`;
  const message = shareText(quote, link);
  const open = ['sent', 'viewed', 'accepted'].includes(quote.status);
  const shareable = open;
  const timeLeft = quote.validUntil ? countdown(quote.validUntil, now) : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      notify('Quotation link copied.');
    } catch {
      window.prompt('Copy this link', link);
    }
    logShare('link');
  }

  return <Drawer title={`${quote.code} · ${quote.guest.name}`} subtitle={`${quote.property?.name} · ${quote.roomSnapshot?.name}`} onClose={onClose} wide>
    <Alert onClose={() => setError('')}>{error}</Alert>
    <div className="sd-drawer-bar">
      <StatusChip meta={QUOTE_STATUS[quote.status]} />
      {open && quote.validUntil && <span className={`sd-tag ${new Date(quote.validUntil) - now < 3 * 3600000 ? 'warn' : ''}`}><Icon name="fa-hourglass-half" /> {timeLeft}</span>}
      {open && quote.heldNights > 0 && <span className="sd-tag positive"><Icon name="fa-lock" /> Room held · {quote.heldNights} night{quote.heldNights === 1 ? '' : 's'}</span>}
      {open && quote.holdInventory && quote.heldNights === 0 && <span className="sd-tag warn"><Icon name="fa-lock-open" /> Hold lapsed</span>}
      {quote.viewCount > 0 && <span className="sd-tag"><Icon name="fa-eye" /> Opened {quote.viewCount}× · last {dateTime(quote.lastViewedAt)}</span>}
      {quote.inquiry && <button type="button" className="sd-tag link" onClick={() => onOpenLead(quote.inquiry._id)}><Icon name="fa-address-card" /> {quote.inquiry.code}</button>}
    </div>

    {quote.status === 'draft' && <div className="sd-action-row">
      <button type="button" className="sd-btn" disabled={busy} onClick={() => run(() => api(`/owner-quotes/${quote._id}/send`, { method: 'POST', body: {} }), 'Quotation finalised. Share it with the guest below.')}><Icon name="fa-paper-plane" /> Finalise & get link</button>
      <button type="button" className="sd-btn ghost" onClick={() => onEdit(quote)}><Icon name="fa-pen" /> Edit draft</button>
      <button type="button" className="sd-btn ghost danger" disabled={busy} onClick={() => setConfirm('delete')}><Icon name="fa-trash-can" /> Delete</button>
    </div>}

    {shareable && <section className="sd-share">
      <h3>Share with {quote.guest.name.split(' ')[0]}</h3>
      <div className="sd-action-row">
        {quote.guest.phone && <a className="sd-btn" href={whatsappLink(quote.guest.phone, message)} target="_blank" rel="noreferrer" onClick={() => logShare('whatsapp')}><Icon name="fa-brands fa-whatsapp" /> WhatsApp</a>}
        {quote.guest.email && <a className="sd-btn ghost" href={mailLink(quote.guest.email, `Your quotation ${quote.code} · ${quote.property?.name}`, message)} onClick={() => logShare('email')}><Icon name="fa-envelope" /> Email</a>}
        <button type="button" className="sd-btn ghost" onClick={copyLink}><Icon name="fa-link" /> Copy link</button>
        <button type="button" className="sd-btn ghost" onClick={() => { setPrinting(true); logShare('print'); }}><Icon name="fa-print" /> Print / PDF</button>
      </div>
      <p className="sd-hint"><Icon name="fa-circle-info" /> WhatsApp and email open on your device with the message ready. The guest page shows the price, policy and an Accept button{quote.onlinePayment ? ' with online payment' : ''}.</p>
    </section>}

    {open && <div className="sd-action-row">
      <button type="button" className={`sd-btn ${quote.status === 'accepted' ? '' : 'ghost'}`} disabled={busy} onClick={() => setConfirm('convert')}><Icon name="fa-calendar-check" /> Convert to booking</button>
      <button type="button" className="sd-btn ghost" disabled={busy || Boolean(quote.revisedBy)} onClick={() => setConfirm('revise')}><Icon name="fa-code-branch" /> Revise</button>
      <button type="button" className="sd-btn ghost danger" disabled={busy} onClick={() => setConfirm('withdraw')}><Icon name="fa-rotate-left" /> Withdraw</button>
    </div>}
    {['expired', 'rejected', 'withdrawn'].includes(quote.status) && <div className="sd-action-row">
      {quote.revisedBy ? <p className="sd-hint">Replaced by {quote.revisedBy.code} ({QUOTE_STATUS[quote.revisedBy.status]?.label}).</p>
        : <button type="button" className="sd-btn" disabled={busy} onClick={() => setConfirm('revise')}><Icon name="fa-code-branch" /> Revise with current rates</button>}
      {quote.status === 'rejected' && quote.rejectReason && <p className="sd-hint">Guest said: “{quote.rejectReason}”</p>}
    </div>}
    {quote.status === 'converted' && quote.booking && <Alert kind="success">Booking created {dateTime(quote.convertedAt)} · payment {quote.booking.paymentStatus}{quote.booking.room ? '' : ' · room needs assignment in Rooms & Availability'}. {quote.booking.paymentStatus !== 'paid' && 'Record the payment in Payments & Reports when it arrives.'}</Alert>}
    {quote.status === 'accepted' && <Alert kind="success">{quote.acceptedName || quote.guest.name} accepted on {dateTime(quote.acceptedAt)}. Convert it to secure the booking{quote.heldNights ? ' before the hold ends' : ''}.</Alert>}

    <section className="sd-section">
      <h3>Price</h3>
      <dl className="sd-lines">
        <div><dt>{rupees(quote.nightlyRate)} × {quote.nights} night{quote.nights === 1 ? '' : 's'}{quote.nightlyRate !== quote.baseNightlyRate && <small> (base {rupees(quote.baseNightlyRate)})</small>}</dt><dd>{rupees(quote.totals.accommodation)}</dd></div>
        {quote.addOns.map(line => <div key={line.addOn}><dt>{line.name} <small>× {line.quantity}</small></dt><dd>{rupees(line.amount)}</dd></div>)}
        {quote.fees.map((line, index) => <div key={index}><dt>{line.label}</dt><dd>{rupees(line.amount)}</dd></div>)}
        {quote.promotion?.discountAmount > 0 && <div className="discount"><dt>Offer {quote.promotion.code}</dt><dd>−{rupees(quote.promotion.discountAmount)}</dd></div>}
        {quote.manualDiscount?.amount > 0 && <div className="discount"><dt>Extra discount <small>{quote.manualDiscount.reason}</small></dt><dd>−{rupees(quote.manualDiscount.amount)}</dd></div>}
        {quote.totals.tax > 0 && <div><dt>Taxes</dt><dd>{rupees(quote.totals.tax)}</dd></div>}
        <div className="total"><dt>Total</dt><dd>{rupees(quote.totals.total)}</dd></div>
      </dl>
      <dl className="sd-facts">
        <div><dt>Stay</dt><dd>{longDate(quote.checkIn)} → {longDate(quote.checkOut)}</dd></div>
        <div><dt>Guests</dt><dd>{guestCount(quote)}</dd></div>
        <div><dt>Payment</dt><dd>{quote.schedule.balanceAmount > 0 ? `${rupees(quote.schedule.advanceAmount)} now, ${rupees(quote.schedule.balanceAmount)} by ${longDate(quote.schedule.balanceDueDate)}` : 'Full payment to confirm'}</dd></div>
        <div><dt>Security deposit</dt><dd>{quote.securityDeposit ? rupees(quote.securityDeposit) : 'None'}</dd></div>
        <div className="wide"><dt>Cancellation</dt><dd>{quote.cancellationText}</dd></div>
        {quote.internalNotes && <div className="wide"><dt>Internal note</dt><dd>{quote.internalNotes}</dd></div>}
      </dl>
    </section>

    <section className="sd-section">
      <h3>History</h3>
      <ol className="sd-timeline">{quote.activities.map(item => <li key={item._id} className={`dir-${item.direction}`}>
        <span className="sd-timeline-icon"><Icon name={ACTIVITY[item.type]?.icon || 'fa-circle'} /></span>
        <div><strong>{ACTIVITY[item.type]?.label || item.type}</strong>{item.body && <p>{item.body}</p>}<small>{item.actorType === 'guest' ? 'Guest' : item.actorType === 'system' ? 'System' : item.actor?.name || 'You'} · {dateTime(item.createdAt)}</small></div>
      </li>)}</ol>
    </section>

    {confirm === 'convert' && <Modal title="Convert to a confirmed booking?" onClose={() => setConfirm(null)}>
      <p>This creates a <strong>confirmed booking</strong> for {quote.roomSnapshot?.name}, {longDate(quote.checkIn)} → {longDate(quote.checkOut)}, total <strong>{rupees(quote.totals.total)}</strong> with payment pending. The room nights are reserved immediately{quote.promotion?.code ? ` and one use of ${quote.promotion.code} is counted` : ''}.</p>
      <p className="sd-muted">Do this when the guest has confirmed with you directly. Record the payment in Payments & Reports once you receive it.</p>
      <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setConfirm(null)}>Not yet</button><button type="button" className="sd-btn" disabled={busy} onClick={async () => { const result = await run(() => api(`/owner-quotes/${quote._id}/convert`, { method: 'POST' }), value => value.warning || 'Booking created and room reserved.'); if (result) setConfirm(null); }}>Create booking</button></div>
    </Modal>}
    {confirm === 'withdraw' && <Modal title={`Withdraw ${quote.code}?`} onClose={() => setConfirm(null)}>
      <p>The guest will see that this quotation is no longer available{quote.heldNights ? ' and the held nights are released' : ''}.</p>
      <Labelled label="Reason (internal)"><input maxLength="200" value={withdrawReason} onChange={event => setWithdrawReason(event.target.value)} /></Labelled>
      <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setConfirm(null)}>Keep it</button><button type="button" className="sd-btn danger" disabled={busy} onClick={async () => { const result = await run(() => api(`/owner-quotes/${quote._id}/withdraw`, { method: 'POST', body: { reason: withdrawReason } }), 'Quotation withdrawn.'); if (result) setConfirm(null); }}>Withdraw</button></div>
    </Modal>}
    {confirm === 'revise' && <Modal title={`Revise ${quote.code}?`} onClose={() => setConfirm(null)}>
      <p>A new draft is created with today's rates and availability.{open ? ` ${quote.code} is withdrawn so the guest can only act on the new version.` : ''}</p>
      <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="sd-btn" disabled={busy} onClick={async () => { const result = await run(() => api(`/owner-quotes/${quote._id}/revise`, { method: 'POST' }), value => `Draft ${value.code} created.${value.warnings?.length ? ` ${value.warnings.join(' ')}` : ''}`); if (result) { setConfirm(null); onRevised(result); } }}>Create revision</button></div>
    </Modal>}
    {confirm === 'delete' && <Modal title={`Delete draft ${quote.code}?`} onClose={() => setConfirm(null)}>
      <p>The draft has never been shared with the guest. This cannot be undone.</p>
      <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="sd-btn danger" disabled={busy} onClick={async () => { const result = await run(() => api(`/owner-quotes/${quote._id}`, { method: 'DELETE' }), 'Draft deleted.'); if (result) { setConfirm(null); onClose(); } }}>Delete draft</button></div>
    </Modal>}
    {printing && createPortal(<PrintDocument quote={quote} />, document.body)}
  </Drawer>;
}
