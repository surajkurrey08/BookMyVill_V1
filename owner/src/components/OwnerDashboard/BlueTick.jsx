import { useState } from 'react';
import { api } from '../../lib/api';
import './BlueTick.css';

// "Verified" blue tick on a property card. BookMyVilla-managed properties have it
// automatically; a self-managed owner applies and Admin reviews the request.
export default function BlueTick({ property }) {
  const [verification, setVerification] = useState(property.verification || { status: 'none' });
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = verification.status || 'none';

  if (property.managementMode === 'BOOKMYVILLA_MANAGED' || status === 'verified') {
    return <p className="bt-badge is-verified"><i className="fa-solid fa-circle-check"></i> Verified by BookMyVilla</p>;
  }
  if (!property.canOperate) return null;
  if (status === 'requested') {
    return <p className="bt-badge is-pending"><i className="fa-solid fa-hourglass-half"></i> Blue tick requested · Admin is reviewing</p>;
  }

  async function apply(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/owner-pms/properties/${property._id}/verification`, { method: 'POST', body: { note: note.trim() } });
      setVerification({ status: 'requested' }); setOpen(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="bt-apply">
    {status === 'rejected' && <p className="bt-badge is-rejected"><i className="fa-solid fa-circle-xmark"></i> Not approved{verification.reviewNote ? `: ${verification.reviewNote}` : ''}</p>}
    {!open ? <button type="button" className="bt-btn" onClick={() => setOpen(true)}>
      <i className="fa-solid fa-circle-check"></i> {status === 'rejected' ? 'Apply again for blue tick' : 'Get the blue tick'}
    </button> : <form onSubmit={apply}>
      <p className="bt-help">Verified properties show a blue tick to guests. Admin checks your property details and documents before approving.</p>
      <textarea maxLength={500} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for Admin (e.g. documents ready, best time to visit)" />
      {error && <p className="bt-error">{error}</p>}
      <div className="bt-actions"><button type="button" className="bt-link" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="bt-btn" disabled={busy}>{busy ? 'Sending…' : 'Send to Admin'}</button></div>
    </form>}
  </div>;
}
