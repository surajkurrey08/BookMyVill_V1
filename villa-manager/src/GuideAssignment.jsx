import { useState } from 'react';
import { Result, useData } from './App';
import { ownerService } from './services/api';
import { Field, money } from './ui';

export default function GuideAssignment({ booking, onSaved }) {
  const state = useData(() => ownerService.guides(booking._id), 'booking-guides:' + booking._id);
  const [selected, setSelected] = useState(booking.guide?.assigned?._id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function assign(event) {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await ownerService.assignGuide(booking._id, selected);
      setNotice('Guide assigned. The guest can see the contact in My Trips.');
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="detail-section form-stack" onSubmit={assign}>
    <h3>Local guide needed</h3>
    <p>{booking.guide.days} day{booking.guide.days === 1 ? '' : 's'} · {money(booking.guide.amount)}</p>
    {booking.guide.assigned && <p><strong>{booking.guide.assigned.name}</strong> · <a href={`tel:${booking.guide.assigned.phone}`}>{booking.guide.assigned.phone}</a></p>}
    <Result state={state}>{state.data && (state.data.guides.length ? <>
      <Field label={`Guide in ${state.data.area || 'this location'}`}><select required value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}>
        <option value="">Choose an active guide</option>
        {state.data.guides.map(g => <option key={g._id} value={g._id}>{g.name} · {g.phone}{g.languages?.length ? ` · ${g.languages.join(', ')}` : ''}</option>)}
      </select></Field>
      <button disabled={busy || !state.data.guides.some(g => g._id === selected)}>{busy ? 'Assigning…' : booking.guide.assigned ? 'Update guide assignment' : 'Assign guide'}</button>
    </> : <p className="help">No active guides in this location. Ask Data Entry to add or activate a guide, then refresh.</p>)}</Result>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
  </form>;
}
