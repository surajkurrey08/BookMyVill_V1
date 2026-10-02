import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import './RoomsAvailability.css';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date, count) => { const copy = new Date(`${date}T12:00:00`); copy.setDate(copy.getDate() + count); return localDate(copy); };
const initialStart = localDate(new Date());

export default function RoomsAvailability() {
  const [properties, setProperties] = useState([]);
  const [approvedListings, setApprovedListings] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(addDays(initialStart, 14));
  const [data, setData] = useState(null);
  const [roomForm, setRoomForm] = useState({ name: '', number: '', type: 'Villa Room', capacity: 2, baseRate: '' });
  const [blockForm, setBlockForm] = useState({ roomId: '', start: initialStart, end: addDays(initialStart, 1), reason: '' });
  const [assignedRooms, setAssignedRooms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/owner-pms${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token, ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.msg || 'Request failed.');
    return body;
  }, []);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const [list, importable] = await Promise.all([request('/properties'), request('/approved-listings')]);
      setProperties(list);
      setApprovedListings(importable);
      setPropertyId(current => list.some(item => item._id === current) ? current : (list[0]?._id || ''));
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [request]);

  const loadAvailability = useCallback(async () => {
    if (!propertyId) { setData(null); return; }
    setLoading(true);
    try {
      const result = await request(`/properties/${propertyId}/availability?start=${start}&end=${end}`);
      setData(result);
      setError('');
    } catch (err) { setData(null); setError(err.message); }
    finally { setLoading(false); }
  }, [propertyId, start, end, request]);

  useEffect(() => { loadProperties(); }, [loadProperties]);
  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  const dates = useMemo(() => {
    if (!start || !end || end <= start) return [];
    const days = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
    return Array.from({ length: Math.min(days, 31) }, (_, i) => addDays(start, i));
  }, [start, end]);
  const nightByRoomDate = useMemo(() => new Map((data?.nights || []).map(item => [`${item.room}:${item.date}`, item])), [data]);
  const blocks = useMemo(() => [...new Map((data?.nights || []).filter(item => item.kind === 'block').map(item => [item.reference, item])).values()], [data]);

  async function perform(action, successText) {
    setSaving(true); setError(''); setMessage('');
    try {
      await action();
      setMessage(successText);
      await loadAvailability();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function addRoom(event) {
    event.preventDefault();
    perform(async () => {
      await request(`/properties/${propertyId}/rooms`, { method: 'POST', body: JSON.stringify(roomForm) });
      setRoomForm({ name: '', number: '', type: 'Villa Room', capacity: 2, baseRate: '' });
    }, 'Room added.');
  }

  function blockDates(event) {
    event.preventDefault();
    perform(async () => {
      await request(`/rooms/${blockForm.roomId}/blocks`, { method: 'POST', body: JSON.stringify(blockForm) });
      setBlockForm(current => ({ ...current, reason: '' }));
    }, 'Dates blocked.');
  }

  function assignRoom(bookingId) {
    const roomId = assignedRooms[bookingId];
    if (!roomId) { setError('Choose a room for this booking.'); return; }
    perform(() => request(`/bookings/${bookingId}/assign-room`, { method: 'POST', body: JSON.stringify({ roomId }) }), 'Room assigned to booking.');
  }

  function importListing(applicationId) {
    perform(async () => {
      await request(`/approved-listings/${applicationId}/import`, { method: 'POST' });
      await loadProperties();
    }, 'Approved listing added to your properties.');
  }

  return <div className="pms-panel">
    <div className="pms-intro">
      <div><h2>Rooms & Availability</h2><p>Manage physical rooms, blocked nights, and confirmed reservations for each property.</p></div>
      <label>Property<select value={propertyId} onChange={event => { setPropertyId(event.target.value); setMessage(''); }} disabled={loading && !properties.length}>
        {properties.length === 0 && <option value="">No saved properties</option>}
        {properties.map(property => <option key={property._id} value={property._id}>{property.name} · {property.status}</option>)}
      </select></label>
    </div>

    {error && <div role="alert" className="pms-alert pms-error">{error}</div>}
    {message && <div role="status" className="pms-alert pms-success">{message}</div>}
    {loading && <p className="pms-muted">Loading live availability…</p>}
    {approvedListings.length > 0 && <div className="pms-card"><h3>Approved listings ready to add</h3><p>These approved applications do not yet have a saved property record.</p><div className="pms-list">{approvedListings.map(listing => <div className="pms-list-row" key={listing._id}><div><strong>{listing.propertyName}</strong><small>{listing.city} · {listing.propertyType}</small></div><button type="button" className="pms-primary" disabled={saving} onClick={() => importListing(listing._id)}>Add to Properties</button></div>)}</div></div>}
    {!loading && properties.length === 0 && !error && <div className="pms-card"><h3>No saved property yet</h3><p>Add a property in the Properties tab. Rooms can be added after it is saved.</p></div>}

    {propertyId && <>
      <div className="pms-forms">
        <form className="pms-card" onSubmit={addRoom}>
          <h3>Add a room</h3>
          <div className="pms-fields">
            <label>Room name<input required maxLength="80" value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Valley Suite" /></label>
            <label>Room number<input required maxLength="30" value={roomForm.number} onChange={e => setRoomForm({ ...roomForm, number: e.target.value })} placeholder="101" /></label>
            <label>Type<input required maxLength="60" value={roomForm.type} onChange={e => setRoomForm({ ...roomForm, type: e.target.value })} /></label>
            <label>Guest capacity<input required type="number" min="1" max="50" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} /></label>
            <label>Base rate (₹ / night)<input required type="number" min="0" step="1" value={roomForm.baseRate} onChange={e => setRoomForm({ ...roomForm, baseRate: e.target.value })} /></label>
          </div>
          <button className="pms-primary" disabled={saving}>Add room</button>
        </form>

        <form className="pms-card" onSubmit={blockDates}>
          <h3>Block dates</h3>
          <div className="pms-fields">
            <label>Room<select required value={blockForm.roomId} onChange={e => setBlockForm({ ...blockForm, roomId: e.target.value })}><option value="">Choose room</option>{data?.rooms.filter(room => room.active).map(room => <option key={room._id} value={room._id}>{room.number} · {room.name}</option>)}</select></label>
            <label>From<input required type="date" value={blockForm.start} onChange={e => setBlockForm({ ...blockForm, start: e.target.value })} /></label>
            <label>Until (checkout date)<input required type="date" min={addDays(blockForm.start, 1)} value={blockForm.end} onChange={e => setBlockForm({ ...blockForm, end: e.target.value })} /></label>
            <label>Reason<input maxLength="200" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder="Maintenance / owner stay" /></label>
          </div>
          <button className="pms-primary" disabled={saving || !data?.rooms.length}>Block nights</button>
        </form>
      </div>

      <section className="pms-card">
        <div className="pms-section-head"><div><h3>Availability calendar</h3><p>Dates are nights. The end date is checkout and is excluded.</p></div><div className="pms-range"><label>From<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>Until<input type="date" min={addDays(start, 1)} value={end} onChange={e => setEnd(e.target.value)} /></label></div></div>
        <div className="pms-legend"><span>✓ Available</span><span>× Blocked</span><span>B Reserved</span><span>H Quotation hold</span><span>— Inactive</span></div>
        {dates.length > 0 && data?.rooms.length > 0 ? <div className="pms-calendar-scroll"><table className="pms-calendar"><thead><tr><th>Room</th>{dates.map(date => <th key={date}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</th>)}</tr></thead><tbody>{data.rooms.map(room => <tr key={room._id}><th><strong>{room.number}</strong><small>{room.name} · ₹{room.baseRate.toLocaleString('en-IN')}</small></th>{dates.map(date => { const night = nightByRoomDate.get(`${room._id}:${date}`); const state = !room.active ? 'inactive' : night?.kind || 'available'; return <td key={date}><span className={`pms-night ${state}`} title={night?.reason || (state === 'hold' ? 'Held for a quotation' : state)}>{state === 'available' ? '✓' : state === 'booking' ? 'B' : state === 'block' ? '×' : state === 'hold' ? 'H' : '—'}</span></td>; })}</tr>)}</tbody></table></div> : <p className="pms-muted">{data?.rooms.length ? 'Choose a valid date range.' : 'Add your first room to start the calendar.'}</p>}
        {dates.length === 31 && <p className="pms-muted">Calendar shows up to 31 nights. Narrow the date range to see every night.</p>}
      </section>

      {data?.unassignedBookings.length > 0 && <section className="pms-card"><h3>Confirmed bookings needing a room</h3><p>Assign each booking to an available room. Conflicting nights are rejected by the server.</p><div className="pms-list">{data.unassignedBookings.map(booking => <div className="pms-list-row" key={booking._id}><div><strong>{booking.user?.name || booking.guest?.name || 'Guest'}</strong><small>{localDate(new Date(booking.checkIn))} → {localDate(new Date(booking.checkOut))}</small></div><div className="pms-row-actions"><select aria-label={`Room for ${booking.user?.name || booking.guest?.name || 'guest'}`} value={assignedRooms[booking._id] || ''} onChange={e => setAssignedRooms({ ...assignedRooms, [booking._id]: e.target.value })}><option value="">Choose room</option>{data.rooms.filter(room => room.active).map(room => <option key={room._id} value={room._id}>{room.number} · {room.name}</option>)}</select><button className="pms-primary" type="button" disabled={saving} onClick={() => assignRoom(booking._id)}>Assign</button></div></div>)}</div></section>}

      {blocks.length > 0 && <section className="pms-card"><h3>Blocks in this date range</h3><div className="pms-list">{blocks.map(block => <div className="pms-list-row" key={block.reference}><div><strong>{data.rooms.find(room => room._id === block.room)?.name || 'Room'}</strong><small>{block.reason || 'No reason'} · includes {block.date}</small></div><button type="button" className="pms-secondary" disabled={saving} onClick={() => perform(() => request(`/blocks/${block.reference}`, { method: 'DELETE' }), 'Block removed.')}>Remove block</button></div>)}</div></section>}
    </>}
  </div>;
}
