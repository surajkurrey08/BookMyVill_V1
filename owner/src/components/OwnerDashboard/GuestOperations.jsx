import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config';
import './GuestOperations.css';

const dateInput = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const nextDate = (date, days) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return ''; const copy = new Date(`${date}T12:00:00`); copy.setDate(copy.getDate() + days); return dateInput(copy); };
const today = dateInput(new Date());
const roleLabels = { caretaker: 'Caretaker', front_desk: 'Front desk', housekeeping: 'Housekeeping', maintenance: 'Maintenance', manager: 'Manager', sales: 'Sales', reservations: 'Reservations' };
const categoryLabels = { turnover: 'Turnover cleaning', cleaning: 'Cleaning', inspection: 'Inspection', maintenance: 'Maintenance' };
const stayLabels = { expected: 'Expected', in_house: 'In house', checked_out: 'Checked out' };
const isoDay = value => value ? String(value).slice(0, 10) : '';

export default function GuestOperations() {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(nextDate(today, 8));
  const [board, setBoard] = useState(null);
  const [staff, setStaff] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', role: 'housekeeping', phone: '' });
  const [taskForm, setTaskForm] = useState({ roomId: '', title: '', category: 'cleaning', dueDate: today, assignedStaffId: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const loadSequence = useRef(0);

  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/owner-ops${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || 'Request failed.');
    return data;
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/owner-pms/properties`, { headers: { 'x-auth-token': token } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || 'Could not load properties.');
      setProperties(result);
      setPropertyId(current => result.some(item => item._id === current) ? current : (result[0]?._id || ''));
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!propertyId) { setBoard(null); setStaff([]); setTasks([]); setRooms([]); return; }
    setLoading(true);
    setBoard(null); setStaff([]); setTasks([]); setRooms([]);
    try {
      const [nextBoard, nextStaff, nextTasks, nextRooms] = await Promise.all([
        request(`/board/${propertyId}?start=${start}&end=${end}`),
        request(`/staff/${propertyId}`),
        request(`/housekeeping/${propertyId}`),
        request(`/rooms/${propertyId}`)
      ]);
      if (sequence === loadSequence.current) { setBoard(nextBoard); setStaff(nextStaff); setTasks(nextTasks); setRooms(nextRooms); setError(''); }
    } catch (err) { if (sequence === loadSequence.current) { setBoard(null); setError(err.message); } }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [propertyId, start, end, request]);

  useEffect(() => { loadProperties(); }, [loadProperties]);
  useEffect(() => { reload(); }, [reload]);

  async function perform(action, success) {
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
    <div className="ops-heading"><div><h2>Guest Operations</h2><p>Arrivals, departures, staff coordination, and room turnover for each property.</p></div><label>Property<select value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="">Choose property</option>{properties.map(property => <option value={property._id} key={property._id}>{property.name}</option>)}</select></label></div>
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
      </div>

      <section className="ops-card">
        <div className="ops-section-head"><div><h3>Stay board</h3><p>Confirmed reservations. Assign a room in Rooms & Availability before check-in.</p></div><div className="ops-date-range"><label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label>Until<input type="date" min={nextDate(start, 1)} value={end} onChange={event => setEnd(event.target.value)} /></label></div></div>
        {board?.bookings.length === 0 && <p className="ops-muted">No confirmed stays in this date range.</p>}
        <div className="ops-stays">{board?.bookings.map(booking => <article className="ops-stay" key={booking._id}>
          <div><strong>{booking.user?.name || booking.guest?.name || 'Guest'}</strong><small>{booking.user?.phone || booking.user?.email || booking.guest?.phone || booking.guest?.email || 'Contact unavailable'}</small></div>
          <div><span className="ops-field-label">Room</span><strong>{booking.room ? `${booking.room.number} · ${booking.room.name}` : 'Not assigned'}</strong></div>
          <div><span className="ops-field-label">Stay</span><strong>{bookingDate(booking.checkIn)} → {bookingDate(booking.checkOut)}</strong></div>
          <div><span className={`ops-status ${stayState(booking)}`}>{stayLabels[stayState(booking)]}</span></div>
          <div className="ops-actions">{stayState(booking) === 'expected' && <button type="button" disabled={busy || !booking.room} onClick={() => perform(() => request(`/bookings/${booking._id}/check-in`, { method: 'POST' }), 'Guest checked in.')}>Check in</button>}{stayState(booking) === 'in_house' && <button type="button" disabled={busy} onClick={() => perform(() => request(`/bookings/${booking._id}/check-out`, { method: 'POST' }), 'Guest checked out.')}>Check out</button>}{stayState(booking) === 'checked_out' && <small>Completed {isoDay(booking.actualCheckOut)}</small>}</div>
        </article>)}</div>
      </section>

      <div className="ops-columns">
        <section className="ops-card"><h3>Add staff member</h3><p>Directory and task assignment only. Staff login is not created here.</p><form className="ops-form" onSubmit={saveStaff}><label>Name<input required maxLength="100" value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value })} /></label><label>Role<select value={staffForm.role} onChange={event => setStaffForm({ ...staffForm, role: event.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Phone (optional)<input maxLength="20" value={staffForm.phone} onChange={event => setStaffForm({ ...staffForm, phone: event.target.value })} /></label><button type="submit" disabled={busy}>Add staff</button></form><div className="ops-list">{staff.map(person => <div className="ops-list-row" key={person._id}><div><strong>{person.name}</strong><small>{roleLabels[person.role]}{person.phone ? ` · ${person.phone}` : ''}</small></div><button className="ops-secondary" type="button" disabled={busy} onClick={() => perform(() => request(`/staff-member/${person._id}`, { method: 'PATCH', body: JSON.stringify({ active: !person.active }) }), person.active ? 'Staff member deactivated.' : 'Staff member activated.')}>{person.active ? 'Deactivate' : 'Activate'}</button></div>)}{staff.length === 0 && <p className="ops-muted">No staff added for this property.</p>}</div></section>

        <section className="ops-card"><h3>Create room task</h3><p>Checkout automatically creates a turnover cleaning task.</p><form className="ops-form" onSubmit={saveTask}><label>Room<select required value={taskForm.roomId} onChange={event => setTaskForm({ ...taskForm, roomId: event.target.value })}><option value="">Choose room</option>{rooms.map(room => <option value={room._id} key={room._id}>{room.number} · {room.name}</option>)}</select></label><label>Task title<input required maxLength="120" value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Inspect bathroom and restock linen" /></label><label>Category<select value={taskForm.category} onChange={event => setTaskForm({ ...taskForm, category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Due date<input required type="date" value={taskForm.dueDate} onChange={event => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label><label>Assign to<select value={taskForm.assignedStaffId} onChange={event => setTaskForm({ ...taskForm, assignedStaffId: event.target.value })}><option value="">Unassigned</option>{staff.filter(person => person.active).map(person => <option key={person._id} value={person._id}>{person.name} · {roleLabels[person.role]}</option>)}</select></label><label>Notes<textarea maxLength="500" value={taskForm.notes} onChange={event => setTaskForm({ ...taskForm, notes: event.target.value })} /></label><button type="submit" disabled={busy || !rooms.length}>Create task</button></form></section>
      </div>

      <section className="ops-card"><h3>Housekeeping queue</h3>{tasks.length === 0 ? <p className="ops-muted">No room tasks yet.</p> : <div className="ops-task-list">{tasks.map(task => <article className="ops-task" key={task._id}><div><strong>{task.title}</strong><small>{task.room?.number || 'Room'} · {categoryLabels[task.category]} · Due {task.dueDate}{task.notes ? ` · ${task.notes}` : ''}</small></div><div className="ops-task-controls"><label>Assigned to<select value={task.assignedStaff?._id || ''} disabled={busy} onChange={event => perform(() => request(`/housekeeping-task/${task._id}`, { method: 'PATCH', body: JSON.stringify({ assignedStaffId: event.target.value || null }) }), 'Task assignment updated.')}><option value="">Unassigned</option>{staff.filter(person => person.active || person._id === task.assignedStaff?._id).map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select></label><label>Status<select value={task.status} disabled={busy} onChange={event => perform(() => request(`/housekeeping-task/${task._id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }), 'Task status updated.')}><option value="open">Open</option>{task.status !== 'done' && <option value="in_progress">In progress</option>}<option value="done">Done</option></select></label></div></article>)}</div>}</section>
    </>}
  </div>;
}
