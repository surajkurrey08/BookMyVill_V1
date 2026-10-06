import { useEffect, useState } from 'react';
import { adminApi } from './api';
import { Alert, Labelled } from './ui';
import { rupees } from './config';

export default function GuideAssignment({ booking, onSaved }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(booking.guide.assigned?._id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminApi(`/bookings/${booking._id}/guides`, { signal: controller.signal }).then(result => { setData(result); setError(''); }).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [booking._id, attempt]);
  async function assign(event) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await adminApi(`/bookings/${booking._id}/guide`, { method: 'POST', body: { guideId: selected } }); await onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="ac-sub">
    <h4>Local guide requested</h4>
    <p>{booking.guide.days} day{booking.guide.days === 1 ? '' : 's'} · {rupees(booking.guide.amount)}</p>
    {booking.guide.assigned && <p><strong>{booking.guide.assigned.name}</strong> · <a href={`tel:${booking.guide.assigned.phone}`}>{booking.guide.assigned.phone}</a></p>}
    {error && <Alert>{error}<button type="button" className="ac-btn ghost" onClick={() => setAttempt(value => value + 1)}>Retry guide list</button></Alert>}
    {!data && !error ? <p className="ac-muted" role="status">Loading guides…</p> : data?.guides.length ? <form className="ac-note-form" onSubmit={assign}>
      <Labelled label={`Guide in ${data.area || 'this location'}`}><select required disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose an active guide</option>{data.guides.map(g => <option key={g._id} value={g._id}>{g.name} · {g.phone}</option>)}</select></Labelled>
      <button className="ac-btn primary" disabled={busy || !data.guides.some(g => g._id === selected)}>{busy ? 'Assigning…' : 'Assign guide'}</button>
    </form> : data && <p className="ac-muted">No active guides here. Ask Data Entry to add or activate one, then retry.</p>}
    <p className="ac-muted">The guest sees the assigned guide contact in My Trips.</p>
  </section>;
}
