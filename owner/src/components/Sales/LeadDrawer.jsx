import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { rupees, dateTime, relativeTime, stayRange, guestCount, longDate, localDateTimeInput, whatsappLink, mailLink } from '../../lib/format';
import { LEAD_STATUS, QUOTE_STATUS, SOURCES, LOST_REASONS, CHANNELS, ACTIVITY, STAFF_ROLES } from './salesConfig';
import { Alert, Drawer, EmptyState, Icon, Labelled, StatusChip } from './ui';

const NEXT_STATUSES = ['new', 'contacted', 'qualified', 'quotation_sent', 'follow_up', 'payment_pending', 'booked', 'lost'];
const LOG_TYPES = { note: 'Internal note', call: 'Call', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', meeting: 'Meeting / visit' };
const inOneDay = () => localDateTimeInput(new Date(Date.now() + 86400000));

export default function LeadDrawer({ inquiryId, meta, onClose, onChanged, onEdit, onNewQuote, onOpenQuote, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusForm, setStatusForm] = useState(null);
  const [log, setLog] = useState({ type: 'call', direction: 'outbound', body: '' });
  const [followUp, setFollowUp] = useState({ dueAt: inOneDay(), channel: 'call', note: '', assignedTo: '' });
  const [completing, setCompleting] = useState(null);
  const logBox = useRef(null);

  const load = useCallback(async () => {
    try { setData(await api(`/owner-crm/inquiries/${inquiryId}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [inquiryId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function run(action) {
    setBusy(true); setError('');
    try { await action(); await load(); onChanged(); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  }

  const inquiry = data?.inquiry;
  const title = inquiry ? inquiry.guestName : 'Inquiry';
  if (!data) return <Drawer title={title} onClose={onClose}>{error ? <Alert>{error}</Alert> : <p className="sd-muted">Loading inquiry…</p>}</Drawer>;

  const closed = ['booked', 'lost'].includes(inquiry.status);
  const pendingFollowUps = data.followUps.filter(item => item.status === 'pending');
  const history = data.guestHistory;
  const greeting = `Hello ${inquiry.guestName.split(' ')[0]}, thank you for your inquiry${inquiry.property ? ` about ${inquiry.property.name}` : ''}.`;
  const startLog = type => { setLog({ type, direction: 'outbound', body: '' }); setTimeout(() => logBox.current?.focus(), 50); };

  async function changeStatus(event) {
    event.preventDefault();
    const ok = await run(() => api(`/owner-crm/inquiries/${inquiry._id}/status`, { method: 'POST', body: statusForm }));
    if (ok) setStatusForm(null);
  }

  return <Drawer title={title} subtitle={`${inquiry.code} · received ${dateTime(inquiry.createdAt)}`} onClose={onClose} wide>
    <Alert onClose={() => setError('')}>{error}</Alert>

    <div className="sd-drawer-bar">
      <StatusChip meta={LEAD_STATUS[inquiry.status]} />
      {inquiry.priority === 'high' && <span className="sd-flag"><Icon name="fa-fire" /> High priority</span>}
      <span className="sd-tag"><Icon name={SOURCES[inquiry.source]?.icon || 'fa-circle'} /> {SOURCES[inquiry.source]?.label}{inquiry.sourceDetail ? ` · ${inquiry.sourceDetail}` : ''}</span>
      {history.completedStays > 0 && <span className="sd-tag positive"><Icon name="fa-rotate" /> Returning guest · {history.completedStays} stay{history.completedStays === 1 ? '' : 's'}</span>}
      {history.cancelled > 0 && <span className="sd-tag"><Icon name="fa-ban" /> {history.cancelled} cancelled booking{history.cancelled === 1 ? '' : 's'}</span>}
      {history.otherInquiries > 0 && <span className="sd-tag"><Icon name="fa-clone" /> {history.otherInquiries} other inquir{history.otherInquiries === 1 ? 'y' : 'ies'}</span>}
    </div>

    <div className="sd-action-row">
      {inquiry.guestPhone && <a className="sd-btn ghost small" href={`tel:${inquiry.guestPhone.replace(/[^\d+]/g, '')}`} onClick={() => startLog('call')}><Icon name="fa-phone" /> Call</a>}
      {inquiry.guestPhone && <a className="sd-btn ghost small" href={whatsappLink(inquiry.guestPhone, greeting)} target="_blank" rel="noreferrer" onClick={() => startLog('whatsapp')}><Icon name="fa-brands fa-whatsapp" /> WhatsApp</a>}
      {inquiry.guestEmail && <a className="sd-btn ghost small" href={mailLink(inquiry.guestEmail, 'Your stay inquiry', greeting)} onClick={() => startLog('email')}><Icon name="fa-envelope" /> Email</a>}
      <button type="button" className="sd-btn ghost small" onClick={() => onEdit(inquiry)}><Icon name="fa-pen" /> Edit</button>
      <button type="button" className="sd-btn ghost small" onClick={() => setStatusForm({ status: inquiry.status === 'new' ? 'contacted' : inquiry.status, lostReason: '', lostNote: '', note: '' })}><Icon name="fa-arrow-right-arrow-left" /> Move stage</button>
      <button type="button" className="sd-btn small" onClick={() => onNewQuote(inquiry)} disabled={!meta?.properties?.length}><Icon name="fa-file-circle-plus" /> New quotation</button>
    </div>
    <p className="sd-hint"><Icon name="fa-circle-info" /> Call, WhatsApp and email open on your device. Log what was discussed below so the whole team can see it.</p>

    {statusForm && <form className="sd-subcard" onSubmit={changeStatus}>
      <div className="sd-grid three">
        <Labelled label="Move to"><select value={statusForm.status} onChange={event => setStatusForm({ ...statusForm, status: event.target.value })}>{NEXT_STATUSES.map(status => <option key={status} value={status} disabled={status === inquiry.status}>{LEAD_STATUS[status].label}</option>)}</select></Labelled>
        {statusForm.status === 'lost' ? <>
          <Labelled label="Why was it lost? *"><select required value={statusForm.lostReason} onChange={event => setStatusForm({ ...statusForm, lostReason: event.target.value })}><option value="">Choose a reason</option>{Object.entries(LOST_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
          <Labelled label="Detail"><input maxLength="300" value={statusForm.lostNote} onChange={event => setStatusForm({ ...statusForm, lostNote: event.target.value })} placeholder="e.g. budget ₹15k/night" /></Labelled>
        </> : <Labelled label="Note" className="span2"><input maxLength="300" value={statusForm.note} onChange={event => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Optional" /></Labelled>}
      </div>
      {statusForm.status === 'booked' && <p className="sd-hint">Use this when the stay was booked outside a quotation. Converting a quotation marks the lead booked automatically.</p>}
      <div className="sd-form-actions"><button type="button" className="sd-btn ghost small" onClick={() => setStatusForm(null)}>Cancel</button><button className="sd-btn small" disabled={busy || statusForm.status === inquiry.status}>Update stage</button></div>
    </form>}

    <section className="sd-section">
      <h3>Stay request</h3>
      <dl className="sd-facts">
        <div><dt>Dates</dt><dd>{stayRange(inquiry.checkIn, inquiry.checkOut)}{inquiry.flexibleDates ? ' (flexible)' : ''}</dd></div>
        <div><dt>Guests</dt><dd>{guestCount(inquiry)}</dd></div>
        <div><dt>Property</dt><dd>{inquiry.property?.name || 'Not decided'}</dd></div>
        <div><dt>Budget</dt><dd>{inquiry.budgetMin || inquiry.budgetMax ? `${inquiry.budgetMin ? rupees(inquiry.budgetMin) : 'Up to'}${inquiry.budgetMin && inquiry.budgetMax ? ' – ' : ' '}${inquiry.budgetMax ? rupees(inquiry.budgetMax) : '+'}` : 'Not shared'}</dd></div>
        <div><dt>Contact</dt><dd>{[inquiry.guestPhone, inquiry.guestEmail].filter(Boolean).join(' · ')}</dd></div>
        <div><dt>Assigned to</dt><dd>{inquiry.assignedTo ? `${inquiry.assignedTo.name} · ${STAFF_ROLES[inquiry.assignedTo.role] || ''}` : 'Unassigned'}</dd></div>
      </dl>
      {inquiry.requirements?.length > 0 && <div className="sd-tags">{inquiry.requirements.map(item => <span key={item} className="sd-tag">{item}</span>)}</div>}
      {inquiry.message && <blockquote className="sd-quote">{inquiry.message}</blockquote>}
      {inquiry.status === 'lost' && <p className="sd-hint"><Icon name="fa-circle-xmark" /> Lost: {LOST_REASONS[inquiry.lostReason] || inquiry.lostReason}{inquiry.lostNote ? ` — ${inquiry.lostNote}` : ''}</p>}
      {inquiry.booking && <p className="sd-hint positive"><Icon name="fa-calendar-check" /> Booking {inquiry.booking.status}, payment {inquiry.booking.paymentStatus} · {rupees(inquiry.booking.totalPrice)}</p>}
    </section>

    <section className="sd-section">
      <div className="sd-section-head"><h3>Quotations</h3></div>
      {data.quotes.length === 0 ? <EmptyState icon="fa-file-invoice" title="No quotation yet" action={<button type="button" className="sd-btn small" onClick={() => onNewQuote(inquiry)} disabled={!meta?.properties?.length}>Create quotation</button>}>Price the stay with add-ons and offers, then share it on WhatsApp or email.</EmptyState>
        : <ul className="sd-list">{data.quotes.map(quote => <li key={quote._id}>
          <button type="button" className="sd-list-btn" onClick={() => onOpenQuote(quote._id)}>
            <div><strong>{quote.code} · {rupees(quote.totals?.total)}</strong><small>{quote.property?.name} · {quote.roomSnapshot?.name} · {stayRange(quote.checkIn, quote.checkOut)}</small></div>
            <div className="sd-list-meta"><StatusChip meta={QUOTE_STATUS[quote.status]} />{quote.viewCount > 0 && <small>Opened {quote.viewCount}×</small>}</div>
          </button>
        </li>)}</ul>}
    </section>

    <section className="sd-section">
      <div className="sd-section-head"><h3>Follow-ups</h3>{inquiry.nextFollowUpAt && <span className={new Date(inquiry.nextFollowUpAt) < new Date() ? 'sd-overdue' : 'sd-muted'}>Next {relativeTime(inquiry.nextFollowUpAt)}</span>}</div>
      {pendingFollowUps.length > 0 && <ul className="sd-list">{pendingFollowUps.map(item => <li key={item._id} className={new Date(item.dueAt) < new Date() ? 'overdue' : ''}>
        <div className="sd-list-row">
          <div><strong><Icon name={CHANNELS[item.channel]?.icon || 'fa-bell'} /> {CHANNELS[item.channel]?.label} · {dateTime(item.dueAt)}</strong><small>{item.note || 'No note'}{item.assignedTo ? ` · ${item.assignedTo.name}` : ''}</small></div>
          <button type="button" className="sd-btn ghost small" onClick={() => setCompleting({ id: item._id, outcome: '', next: '' })}>Mark done</button>
        </div>
        {completing?.id === item._id && <form className="sd-subcard" onSubmit={async event => {
          event.preventDefault();
          const ok = await run(() => api(`/owner-crm/follow-ups/${item._id}`, { method: 'PATCH', body: { action: 'complete', outcome: completing.outcome, nextDueAt: completing.next ? new Date(completing.next).toISOString() : undefined } }));
          if (ok) setCompleting(null);
        }}>
          <div className="sd-grid two">
            <Labelled label="Outcome"><input maxLength="300" value={completing.outcome} onChange={event => setCompleting({ ...completing, outcome: event.target.value })} placeholder="What happened?" /></Labelled>
            <Labelled label="Schedule next (optional)"><input type="datetime-local" value={completing.next} onChange={event => setCompleting({ ...completing, next: event.target.value })} /></Labelled>
          </div>
          <div className="sd-form-actions"><button type="button" className="sd-btn ghost small" onClick={() => setCompleting(null)}>Cancel</button><button className="sd-btn small" disabled={busy}>Complete follow-up</button></div>
        </form>}
      </li>)}</ul>}
      {closed ? <p className="sd-muted">Reopen this inquiry to schedule follow-ups.</p> : <form className="sd-subcard" onSubmit={async event => {
        event.preventDefault();
        const ok = await run(() => api(`/owner-crm/inquiries/${inquiry._id}/follow-ups`, { method: 'POST', body: { ...followUp, dueAt: new Date(followUp.dueAt).toISOString(), assignedTo: followUp.assignedTo || null } }));
        if (ok) setFollowUp({ dueAt: inOneDay(), channel: 'call', note: '', assignedTo: '' });
      }}>
        <div className="sd-grid four">
          <Labelled label="When"><input type="datetime-local" required value={followUp.dueAt} onChange={event => setFollowUp({ ...followUp, dueAt: event.target.value })} /></Labelled>
          <Labelled label="How"><select value={followUp.channel} onChange={event => setFollowUp({ ...followUp, channel: event.target.value })}>{Object.entries(CHANNELS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></Labelled>
          <Labelled label="Who"><select value={followUp.assignedTo} onChange={event => setFollowUp({ ...followUp, assignedTo: event.target.value })}><option value="">Me</option>{meta?.staff.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Labelled>
          <Labelled label="Reminder note"><input maxLength="300" value={followUp.note} onChange={event => setFollowUp({ ...followUp, note: event.target.value })} placeholder="Share pool photos" /></Labelled>
        </div>
        <div className="sd-form-actions"><span className="sd-hint">Reminders appear in Follow-ups and Needs attention; no automatic message is sent.</span><button className="sd-btn small" disabled={busy}>Schedule follow-up</button></div>
      </form>}
    </section>

    <section className="sd-section">
      <h3>Conversation & history</h3>
      <form className="sd-subcard" onSubmit={async event => {
        event.preventDefault();
        const ok = await run(() => api(`/owner-crm/inquiries/${inquiry._id}/activities`, { method: 'POST', body: log }));
        if (ok) setLog(current => ({ ...current, body: '' }));
      }}>
        <div className="sd-grid two">
          <Labelled label="Type"><select value={log.type} onChange={event => setLog({ ...log, type: event.target.value })}>{Object.entries(LOG_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
          {log.type !== 'note' && <Labelled label="Direction"><select value={log.direction} onChange={event => setLog({ ...log, direction: event.target.value })}><option value="outbound">We contacted the guest</option><option value="inbound">Guest contacted us</option></select></Labelled>}
        </div>
        <Labelled label={log.type === 'note' ? 'Note (never shown to the guest)' : 'What was discussed'}><textarea ref={logBox} rows="2" maxLength="2000" required value={log.body} onChange={event => setLog({ ...log, body: event.target.value })} /></Labelled>
        <div className="sd-form-actions"><button className="sd-btn small" disabled={busy || !log.body.trim()}>Add to timeline</button></div>
      </form>
      <ol className="sd-timeline">{data.activities.map(item => <li key={item._id} className={`dir-${item.direction}`}>
        <span className="sd-timeline-icon"><Icon name={ACTIVITY[item.type]?.icon || 'fa-circle'} /></span>
        <div>
          <strong>{ACTIVITY[item.type]?.label || item.type}{item.meta?.to ? `: ${LEAD_STATUS[item.meta.from]?.label || item.meta.from} → ${LEAD_STATUS[item.meta.to]?.label || item.meta.to}` : ''}</strong>
          {item.body && <p>{item.body}</p>}
          <small>{item.actorType === 'guest' ? 'Guest' : item.actorType === 'system' ? 'System' : item.actor?.name || 'You'} · {item.direction === 'inbound' ? 'from guest · ' : item.direction === 'outbound' ? 'to guest · ' : ''}{dateTime(item.createdAt)}</small>
        </div>
      </li>)}</ol>
      {inquiry.checkIn && <p className="sd-muted">Check-in {longDate(inquiry.checkIn)}.</p>}
    </section>
  </Drawer>;
}
