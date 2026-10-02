import { useCallback, useEffect, useState } from 'react';
import { adminApi, query } from './api';
import { rupees, shortDate, dateTime, BOOKING_STATUS, PAYMENT_STATUS, STAY_STATUS } from './config';
import { Alert, Drawer, EmptyState, Facts, Icon, Pager, StatusBadge, AuditTimeline, Labelled } from './ui';

const VIEWS = [
  { id: '', label: 'All' },
  { id: 'refund_review', label: 'Refund review' },
  { id: 'unpaid', label: 'Unpaid' }
];

export default function BookingsSection({ can, focus }) {
  const [view, setView] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (focus?.id) setOpenId(focus.id); }, [focus]);
  const load = useCallback(async () => {
    try { setData(await adminApi(`/bookings${query({ view, status, q, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [view, status, q, page]);
  useEffect(() => { load(); }, [load]);

  return <div className="ac-stack">
    <div className="ac-tabs">{VIEWS.map(v => <button key={v.id} type="button" className={view === v.id ? 'active' : ''} onClick={() => { setView(v.id); setPage(1); }}>{v.label}</button>)}</div>
    <div className="ac-toolbar">
      <label className="ac-search"><Icon name="fa-magnifying-glass" /><input placeholder="Guest name, booking ID or phone" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">Any status</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select>
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <section className="ac-card nopad">
      {data && data.items.length === 0 ? <EmptyState icon="fa-calendar-check" title="No bookings found" />
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Guest</th><th>Property</th><th>Stay</th><th className="num">Amount</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>{data?.items.map(b => <tr key={b._id} onClick={() => setOpenId(b._id)}>
            <td><strong className="ac-link">{b.user?.name || b.guest?.name || 'Guest'}</strong><small>{b.user?.email || b.guest?.phone || ''}</small></td>
            <td>{b.property?.name || '—'}<small>{b.property?.location}</small></td>
            <td>{shortDate(b.checkIn)} → {shortDate(b.checkOut)}{b.stayStatus && b.stayStatus !== 'expected' && <small><StatusBadge meta={STAY_STATUS[b.stayStatus]} fallback={b.stayStatus} /></small>}</td>
            <td className="num">{rupees(b.totalPrice)}</td>
            <td><StatusBadge meta={PAYMENT_STATUS[b.paymentStatus]} fallback={b.paymentStatus} /></td>
            <td><StatusBadge meta={BOOKING_STATUS[b.status]} fallback={b.status} /></td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="bookings" />}
    </section>
    {openId && <BookingDrawer id={openId} can={can} onClose={() => setOpenId(null)} />}
  </div>;
}

function BookingDrawer({ id, can, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await adminApi(`/bookings/${id}`)); setError(''); } catch (err) { setError(err.message); } }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addNote(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await adminApi(`/bookings/${id}/note`, { method: 'POST', body: { note: note.trim() } }); setNote(''); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const b = data?.booking;
  return <Drawer title={b ? (b.user?.name || b.guest?.name || 'Guest') : 'Booking'} subtitle={b ? `${b.property?.name || ''} · ${rupees(b.totalPrice)}` : ''} onClose={onClose}>
    <Alert onClose={() => setError('')}>{error}</Alert>
    {!data ? <p className="ac-muted">Loading…</p> : <>
      <div className="ac-drawer-bar"><StatusBadge meta={BOOKING_STATUS[b.status]} fallback={b.status} /><StatusBadge meta={PAYMENT_STATUS[b.paymentStatus]} fallback={b.paymentStatus} />{b.stayStatus && <StatusBadge meta={STAY_STATUS[b.stayStatus]} fallback={b.stayStatus} />}<span className="ac-tag">#{String(b._id).slice(-6)}</span></div>
      <Facts items={[
        ['Guest', `${b.user?.name || b.guest?.name || 'Guest'} · ${b.user?.phone || b.guest?.phone || '—'}`],
        ['Property', b.property?.name],
        ['Owner', b.property?.owner?.name || '—'],
        ['Room', b.room ? `${b.room.name} ${b.room.number || ''}` : 'Whole property'],
        ['Stay', `${shortDate(b.checkIn)} → ${shortDate(b.checkOut)}`],
        ['Guests', b.guests],
        ['Amount', rupees(b.totalPrice)],
        ['Source', b.source || 'website'],
        b.securityDepositAmount ? ['Security deposit', rupees(b.securityDepositAmount)] : null,
        b.refundStatus && b.refundStatus !== 'none' ? ['Refund', `${b.refundStatus} ${b.refundAmount ? rupees(b.refundAmount) : ''}`] : null
      ]} />
      {data.requests.length > 0 && <section className="ac-sub"><h4>Guest requests</h4><ul className="ac-mini-list">{data.requests.map(r => <li key={r._id}><div><strong>{r.kind === 'issue' ? 'Issue' : 'Request'} · {r.category}</strong><small>{r.code}</small></div><span>{r.status}</span></li>)}</ul></section>}
      <section className="ac-sub"><h4>Booking timeline</h4>{(b.actionHistory || []).length === 0 ? <p className="ac-muted">No events recorded.</p> : <ol className="ac-timeline">{[...b.actionHistory].reverse().map((e, i) => <li key={i}><span className="ac-timeline-dot"><Icon name="fa-circle" /></span><div><strong>{e.action}</strong>{e.reason && <p>{e.reason}</p>}<small>{e.performedBy} · {dateTime(e.timestamp)}</small></div></li>)}</ol>}</section>
      <section className="ac-sub"><h4>Admin notes & actions</h4><AuditTimeline entries={data.audit} />
        {can('bookings.note') && <form className="ac-note-form" onSubmit={addNote}><Labelled label="Add internal note (audit trail)"><textarea rows="2" maxLength="500" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Called guest, confirmed early check-in with owner." /></Labelled><button className="ac-btn primary sm" disabled={busy || !note.trim()}>Add note</button></form>}
      </section>
    </>}
  </Drawer>;
}
