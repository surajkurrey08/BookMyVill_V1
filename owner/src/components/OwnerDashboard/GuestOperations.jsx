import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { canOperateProperty, managementLabel } from '../../lib/propertyAccess';
import ManagementNotice from './ManagementNotice';
import './GuestOperations.css';

const dateInput = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const nextDate = (date, days) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return ''; const copy = new Date(`${date}T12:00:00`); copy.setDate(copy.getDate() + days); return dateInput(copy); };
const today = dateInput(new Date());
const roleLabels = { caretaker: 'Caretaker', front_desk: 'Front desk', housekeeping: 'Housekeeping', maintenance: 'Maintenance', manager: 'Manager', sales: 'Sales', reservations: 'Reservations' };
const categoryLabels = { turnover: 'Turnover cleaning', cleaning: 'Cleaning', inspection: 'Inspection', maintenance: 'Maintenance' };
const stayLabels = { expected: 'Expected', in_house: 'In house', checked_out: 'Checked out' };
const REQUEST_STATUS = {
  open: { label: 'New', tone: 'new' }, acknowledged: { label: 'Seen', tone: 'seen' }, in_progress: { label: 'In progress', tone: 'progress' },
  completed: { label: 'Completed', tone: 'done' }, declined: { label: 'Declined', tone: 'muted' }, cancelled: { label: 'Cancelled by guest', tone: 'muted' }
};
const CATEGORY_LABELS = {
  towels: 'Towels / linen', water: 'Water', housekeeping: 'Cleaning', food: 'Food', extra_bed: 'Extra bed', taxi: 'Taxi', amenities: 'Amenities', checkout_help: 'Checkout help',
  ac: 'AC / cooling', cleaning: 'Cleanliness', wifi: 'Wi-Fi', noise: 'Noise', pool: 'Pool', staff: 'Staff', billing: 'Billing', safety: 'Safety', maintenance: 'Maintenance', other: 'Other'
};
const requestCategory = value => CATEGORY_LABELS[value] || value;
const isoDay = value => value ? String(value).slice(0, 10) : '';

export default function GuestOperations({ properties, propertyId, onPropertyChange }) {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(nextDate(today, 8));
  const [board, setBoard] = useState(null);
  const [staff, setStaff] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestAction, setRequestAction] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', role: 'housekeeping', phone: '' });
  const [taskForm, setTaskForm] = useState({ roomId: '', title: '', category: 'cleaning', dueDate: today, assignedStaffId: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const loadSequence = useRef(0);

  const request = useCallback((path, { body, ...options } = {}) => api('/owner-ops' + path, { ...options, body: typeof body === 'string' ? JSON.parse(body) : body }), []);

  const selectedProperty = properties.find(property => property._id === propertyId);
  const canWrite = canOperateProperty(selectedProperty) && canOperateProperty(board?.property) && board?.property._id === propertyId && !loading;

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!propertyId) { setBoard(null); setStaff([]); setTasks([]); setRooms([]); setRequests([]); return; }
    setLoading(true);
    setBoard(null); setStaff([]); setTasks([]); setRooms([]); setRequests([]);
    try {
      const [nextBoard, nextStaff, nextTasks, nextRooms, nextRequests] = await Promise.all([
        request(`/board/${propertyId}?start=${start}&end=${end}`),
        request(`/staff/${propertyId}`),
        request(`/housekeeping/${propertyId}`),
        request(`/rooms/${propertyId}`),
        request(`/guest-requests/${propertyId}`)
      ]);
      if (sequence === loadSequence.current) { setBoard(nextBoard); setStaff(nextStaff); setTasks(nextTasks); setRooms(nextRooms); setRequests(nextRequests.requests || []); setError(''); }
    } catch (err) { if (sequence === loadSequence.current) { setBoard(null); setError(err.message); } }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [propertyId, start, end, request]);

  useEffect(() => { reload(); return () => { loadSequence.current++; }; }, [reload]);
  useEffect(() => { setMessage(''); setError(''); setRequestAction(null); setStaffForm({ name: '', role: 'housekeeping', phone: '' }); setTaskForm({ roomId: '', title: '', category: 'cleaning', dueDate: today, assignedStaffId: '', notes: '' }); }, [propertyId]);

  async function perform(action, success) {
    if (!canWrite) { setError('Operational changes are not available for this property.'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await action();
      setMessage(result?.warning ? `${success} ${result.warning}` : success);
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function saveStaff(event) {
    event.preventDefault();
    perform(async () => {
      const result = await request(`/staff/${propertyId}`, { method: 'POST', body: JSON.stringify(staffForm) });
      setStaffForm({ name: '', role: 'housekeeping', phone: '' });
      return result;
    }, 'Staff member added.');
  }

  function saveTask(event) {
    event.preventDefault();
    perform(async () => {
      const result = await request(`/housekeeping/${propertyId}`, { method: 'POST', body: JSON.stringify(taskForm) });
      setTaskForm(current => ({ ...current, title: '', notes: '' }));
      return result;
    }, 'Housekeeping task added.');
  }

  const stayState = booking => booking.stayStatus || 'expected';
  const bookingDate = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return <div className="ops-panel">
    <div className="ops-heading"><div><h2>Guest Operations</h2><p>Arrivals, departures, staff coordination, and room turnover for each property.</p></div><label>Property<select value={propertyId} disabled={busy} onChange={event => { if (event.target.value === propertyId) return; onPropertyChange(event.target.value); setBoard(null); setStaff([]); setTasks([]); setRooms([]); setRequests([]); }}><option value="">Choose property</option>{properties.map(property => <option value={property._id} key={property._id}>{property.name} · {managementLabel(property)}</option>)}</select></label></div>
    <ManagementNotice property={board?.property._id === propertyId ? board.property : selectedProperty} className="ops-alert" />
    {error && <div className="ops-alert ops-error" role="alert">{error}</div>}
    {message && <div className="ops-alert ops-success" role="status">{message}</div>}
    {loading && <p className="ops-muted">Loading guest operations…</p>}
    {!loading && !propertyId && !error && <div className="ops-card"><h3>No saved property yet</h3><p>Add or import a property before managing guest operations.</p></div>}

    {propertyId && <>
      <div className="ops-summary">
        <div className="ops-kpi"><span>Arrivals today</span><strong>{board?.summary.arrivalsToday ?? '—'}</strong></div>
        <div className="ops-kpi"><span>Scheduled departures today</span><strong>{board?.summary.departuresToday ?? '—'}</strong></div>
        <div className="ops-kpi"><span>Stays in house</span><strong>{board?.summary.inHouse ?? '—'}</strong></div>
        <div className="ops-kpi"><span>Open room tasks</span><strong>{board?.summary.openTasks ?? '—'}</strong></div>
        <div className="ops-kpi"><span>Open guest requests</span><strong>{board?.summary.openRequests ?? '—'}</strong></div>
      </div>

      <section className="ops-card">
        <div className="ops-section-head"><div><h3>Guest requests & issues</h3><p>Raised by guests from their stay page. Update the status and the guest sees it live.</p></div></div>
        {requests.length === 0 ? <p className="ops-muted">No guest requests yet.</p> : <div className="ops-request-list">{requests.map(item => {
          const meta = REQUEST_STATUS[item.status] || {};
          const open = ['open', 'acknowledged', 'in_progress'].includes(item.status);
          const latestNote = (item.updates || []).filter(u => u.note).slice(-1)[0];
          return <article className={`ops-request ${item.kind === 'issue' ? 'issue' : ''} ${item.priority === 'high' ? 'high' : ''}`} key={item._id}>
            <div className="ops-request-main">
              <div className="ops-request-top">
                <strong>{item.kind === 'issue' ? '⚠ Issue' : 'Request'} · {requestCategory(item.category)}</strong>
                <span className={`ops-req-status ${meta.tone || ''}`}>{meta.label || item.status}</span>
              </div>
              <p>{item.description}</p>
              <small>{item.code} · {item.booking?.guest?.name || 'Guest'} · {bookingDate(item.createdAt)}{item.eta ? ` · ETA ${item.eta}` : ''}{latestNote ? ` · “${latestNote.note}”` : ''}</small>
              {item.photos?.length > 0 && <div className="ops-request-photos">{item.photos.map((src, i) => <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Attachment ${i + 1}`} /></a>)}</div>}
            </div>
            {open && canWrite && <div className="ops-request-actions">
              {requestAction?.id === item._id ? <form className="ops-request-form" onSubmit={event => {
                event.preventDefault();
                perform(() => request(`/guest-request/${item._id}`, { method: 'PATCH', body: JSON.stringify({ status: requestAction.status, note: requestAction.note, eta: requestAction.eta, escalated: Boolean(requestAction.escalated) }) }), 'Guest request updated.').then(() => setRequestAction(null));
              }}>
                <select value={requestAction.status} onChange={event => setRequestAction({ ...requestAction, status: event.target.value })} aria-label="New status">
                  <option value="acknowledged">Acknowledge</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="declined">Can't do</option>
                </select>
                <input placeholder="ETA e.g. 15 min" maxLength="80" value={requestAction.eta} onChange={event => setRequestAction({ ...requestAction, eta: event.target.value })} />
                <input placeholder="Note to guest (optional)" maxLength="500" value={requestAction.note} onChange={event => setRequestAction({ ...requestAction, note: event.target.value })} />
                <label><input type="checkbox" checked={Boolean(requestAction.escalated)} onChange={event => setRequestAction({ ...requestAction, escalated: event.target.checked })} />Escalate to Admin</label>
                <div className="ops-request-form-btns"><button type="button" className="ops-secondary" onClick={() => setRequestAction(null)}>Cancel</button><button type="submit" disabled={busy || !canWrite}>Update</button></div>
              </form> : <button type="button" disabled={busy || !canWrite} onClick={() => setRequestAction({ id: item._id, status: item.status === 'open' ? 'acknowledged' : 'in_progress', note: '', eta: item.eta || '', escalated: Boolean(item.escalated) })}>Update status</button>}
            </div>}
          </article>;
        })}</div>}
      </section>

      <section className="ops-card">
        <div className="ops-section-head"><div><h3>Stay board</h3><p>Confirmed reservations. Assign a room in Rooms & Availability before check-in.</p></div><div className="ops-date-range"><label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label>Until<input type="date" min={nextDate(start, 1)} value={end} onChange={event => setEnd(event.target.value)} /></label></div></div>
        {board?.bookings.length === 0 && <p className="ops-muted">No confirmed stays in this date range.</p>}
        <div className="ops-stays">{board?.bookings.map(booking => <article className="ops-stay" key={booking._id}>
          <div><strong>{booking.user?.name || booking.guest?.name || 'Guest'}</strong><small>{booking.user?.phone || booking.user?.email || booking.guest?.phone || booking.guest?.email || 'Contact unavailable'}</small></div>
          <div><span className="ops-field-label">Room</span><strong>{booking.room ? `${booking.room.number} · ${booking.room.name}` : 'Not assigned'}</strong></div>
          <div><span className="ops-field-label">Stay</span><strong>{bookingDate(booking.checkIn)} → {bookingDate(booking.checkOut)}</strong></div>
          <div><span className={`ops-status ${stayState(booking)}`}>{stayLabels[stayState(booking)]}</span></div>
          <div className="ops-actions">{stayState(booking) === 'expected' && <button type="button" disabled={busy || !canWrite || !booking.room} onClick={() => perform(() => request(`/bookings/${booking._id}/check-in`, { method: 'POST' }), 'Guest checked in.')}>Check in</button>}{stayState(booking) === 'in_house' && <button type="button" disabled={busy || !canWrite} onClick={() => perform(() => request(`/bookings/${booking._id}/check-out`, { method: 'POST' }), 'Guest checked out.')}>Check out</button>}{stayState(booking) === 'checked_out' && <small>Completed {isoDay(booking.actualCheckOut)}</small>}</div>
        </article>)}</div>
      </section>

      <div className="ops-columns">
        <section className="ops-card"><h3>Add staff member</h3><p>Directory and task assignment only. Staff login is not created here.</p><form className="ops-form" onSubmit={saveStaff}><fieldset disabled={!canWrite || busy} style={{ display: 'contents' }}><label>Name<input required maxLength="100" value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value })} /></label><label>Role<select value={staffForm.role} onChange={event => setStaffForm({ ...staffForm, role: event.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Phone (optional)<input maxLength="20" value={staffForm.phone} onChange={event => setStaffForm({ ...staffForm, phone: event.target.value })} /></label><button type="submit" disabled={busy || !canWrite}>Add staff</button></fieldset></form><div className="ops-list">{staff.map(person => <div className="ops-list-row" key={person._id}><div><strong>{person.name}</strong><small>{roleLabels[person.role]}{person.phone ? ` · ${person.phone}` : ''}</small></div><button className="ops-secondary" type="button" disabled={busy || !canWrite} onClick={() => perform(() => request(`/staff-member/${person._id}`, { method: 'PATCH', body: JSON.stringify({ active: !person.active }) }), person.active ? 'Staff member deactivated.' : 'Staff member activated.')}>{person.active ? 'Deactivate' : 'Activate'}</button></div>)}{staff.length === 0 && <p className="ops-muted">No staff added for this property.</p>}</div></section>

        <section className="ops-card"><h3>Create room task</h3><p>Checkout automatically creates a turnover cleaning task.</p><form className="ops-form" onSubmit={saveTask}><fieldset disabled={!canWrite || busy} style={{ display: 'contents' }}><label>Room<select required value={taskForm.roomId} onChange={event => setTaskForm({ ...taskForm, roomId: event.target.value })}><option value="">Choose room</option>{rooms.map(room => <option value={room._id} key={room._id}>{room.number} · {room.name}</option>)}</select></label><label>Task title<input required maxLength="120" value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Inspect bathroom and restock linen" /></label><label>Category<select value={taskForm.category} onChange={event => setTaskForm({ ...taskForm, category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Due date<input required type="date" value={taskForm.dueDate} onChange={event => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label><label>Assign to<select value={taskForm.assignedStaffId} onChange={event => setTaskForm({ ...taskForm, assignedStaffId: event.target.value })}><option value="">Unassigned</option>{staff.filter(person => person.active).map(person => <option key={person._id} value={person._id}>{person.name} · {roleLabels[person.role]}</option>)}</select></label><label>Notes<textarea maxLength="500" value={taskForm.notes} onChange={event => setTaskForm({ ...taskForm, notes: event.target.value })} /></label><button type="submit" disabled={busy || !canWrite || !rooms.length}>Create task</button></fieldset></form></section>
      </div>

      <section className="ops-card"><h3>Housekeeping queue</h3>{tasks.length === 0 ? <p className="ops-muted">No room tasks yet.</p> : <div className="ops-task-list">{tasks.map(task => <article className="ops-task" key={task._id}><div><strong>{task.title}</strong><small>{task.room?.number || 'Room'} · {categoryLabels[task.category]} · Due {task.dueDate}{task.notes ? ` · ${task.notes}` : ''}</small></div><div className="ops-task-controls"><label>Assigned to<select value={task.assignedStaff?._id || ''} disabled={busy || !canWrite} onChange={event => perform(() => request(`/housekeeping-task/${task._id}`, { method: 'PATCH', body: JSON.stringify({ assignedStaffId: event.target.value || null }) }), 'Task assignment updated.')}><option value="">Unassigned</option>{staff.filter(person => person.active || person._id === task.assignedStaff?._id).map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select></label><label>Readiness<select value={task.stage || 'dirty'} disabled={busy || !canWrite} onChange={event => perform(() => request(`/housekeeping-task/${task._id}`, { method: 'PATCH', body: JSON.stringify({ stage: event.target.value }) }), 'Readiness updated.')}><option value="dirty">Dirty</option><option value="cleaning">Cleaning</option><option value="inspection">Inspection</option><option value="ready">Ready</option></select></label><fieldset disabled={busy || !canWrite || task.stage === 'ready'}><legend>Readiness checks</legend>{['Bedroom','Bathroom','Linen','Towels','Kitchen','Floor','Amenities','Pool','Damage check'].map(check => <label key={check}><input type="checkbox" checked={(task.checklist || []).includes(check)} onChange={event => perform(() => request(`/housekeeping-task/${task._id}`, { method: 'PATCH', body: JSON.stringify({ checklist: event.target.checked ? [...(task.checklist || []), check] : (task.checklist || []).filter(value => value !== check) }) }), 'Readiness check saved.')} />{check}</label>)}</fieldset></div></article>)}</div>}</section>
    </>}
  </div>;
}
