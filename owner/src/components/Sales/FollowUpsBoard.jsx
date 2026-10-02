import { useCallback, useEffect, useState } from 'react';
import { api, query } from '../../lib/api';
import { dateTime, relativeTime, localDateTimeInput, whatsappLink } from '../../lib/format';
import { CHANNELS, LEAD_STATUS } from './salesConfig';
import { Alert, EmptyState, Icon, Labelled, Pager, StatusChip } from './ui';

const VIEWS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' }
];

export default function FollowUpsBoard({ meta, refreshKey, onOpenLead, onChanged, notify }) {
  const [view, setView] = useState('overdue');
  const [assignedTo, setAssignedTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setResult(await api(`/owner-crm/follow-ups${query({ view, assignedTo, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [view, assignedTo, page]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function act(item, body, message) {
    setBusy(true);
    try {
      await api(`/owner-crm/follow-ups/${item._id}`, { method: 'PATCH', body });
      setEditing(null);
      notify(message);
      await load();
      onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const counts = result?.counts || {};
  return <section className="sd-card">
    <div className="sd-tabs" role="tablist" aria-label="Follow-up views">
      {VIEWS.map(item => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} className={`${view === item.id ? 'active' : ''} ${item.id === 'overdue' && counts.overdue ? 'warn' : ''}`} onClick={() => { setView(item.id); setPage(1); setEditing(null); }}>
        {item.label}{counts[item.id] !== undefined && <span className="sd-tab-count">{counts[item.id]}</span>}
      </button>)}
    </div>
    <div className="sd-toolbar">
      <select aria-label="Assigned to" value={assignedTo} onChange={event => { setAssignedTo(event.target.value); setPage(1); }}><option value="">Everyone</option><option value="unassigned">Unassigned (you)</option>{meta?.staff.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
      <span className="sd-hint">Reminders are in-app only; messages are sent from your phone.</span>
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    {result && result.items.length === 0 && <EmptyState icon={view === 'overdue' ? 'fa-circle-check' : 'fa-bell-slash'} title={view === 'overdue' ? 'No overdue follow-ups' : view === 'today' ? 'Nothing else due today' : view === 'upcoming' ? 'No follow-ups scheduled' : 'No completed follow-ups yet'}>
      {view === 'upcoming' ? 'Schedule a follow-up from any inquiry so promising leads are not forgotten.' : 'You are up to date.'}
    </EmptyState>}
    {result?.items.length > 0 && <ul className="sd-list spaced">{result.items.map(item => {
      const lead = item.inquiry;
      const overdue = item.status === 'pending' && new Date(item.dueAt) < new Date();
      return <li key={item._id} className={overdue ? 'overdue' : ''}>
        <div className="sd-list-row">
          <div>
            <strong><Icon name={CHANNELS[item.channel]?.icon || 'fa-bell'} /> {lead?.guestName || 'Guest'} · {CHANNELS[item.channel]?.label}</strong>
            <small>{item.status === 'pending' ? `${dateTime(item.dueAt)} (${relativeTime(item.dueAt)})` : `${item.status === 'done' ? 'Done' : 'Cancelled'} ${dateTime(item.completedAt)}${item.completedBy ? ` by ${item.completedBy.name}` : ''}`}{item.assignedTo ? ` · ${item.assignedTo.name}` : ''}</small>
            {item.note && <small>Note: {item.note}</small>}
            {item.outcome && <small>Outcome: {item.outcome}</small>}
          </div>
          <div className="sd-list-meta">
            {lead && <StatusChip meta={LEAD_STATUS[lead.status]} />}
            <div className="sd-inline-actions">
              {lead?.guestPhone && <a className="sd-btn ghost small" href={`tel:${lead.guestPhone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${lead.guestName}`}><Icon name="fa-phone" /></a>}
              {lead?.guestPhone && <a className="sd-btn ghost small" href={whatsappLink(lead.guestPhone, `Hello ${lead.guestName.split(' ')[0]}, `)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.guestName}`}><Icon name="fa-brands fa-whatsapp" /></a>}
              {lead && <button type="button" className="sd-btn ghost small" onClick={() => onOpenLead(lead._id)}>Open lead</button>}
              {item.status === 'pending' && <button type="button" className="sd-btn small" onClick={() => setEditing({ id: item._id, mode: 'complete', outcome: '', next: '' })}>Done</button>}
              {item.status === 'pending' && <button type="button" className="sd-btn ghost small" onClick={() => setEditing({ id: item._id, mode: 'reschedule', dueAt: localDateTimeInput(new Date(Date.now() + 86400000)) })}>Reschedule</button>}
            </div>
          </div>
        </div>
        {editing?.id === item._id && editing.mode === 'complete' && <form className="sd-subcard" onSubmit={event => { event.preventDefault(); act(item, { action: 'complete', outcome: editing.outcome, nextDueAt: editing.next ? new Date(editing.next).toISOString() : undefined }, 'Follow-up completed.'); }}>
          <div className="sd-grid two">
            <Labelled label="Outcome"><input maxLength="300" value={editing.outcome} onChange={event => setEditing({ ...editing, outcome: event.target.value })} placeholder="e.g. Guest will confirm by Friday" /></Labelled>
            <Labelled label="Next follow-up (optional)"><input type="datetime-local" value={editing.next} onChange={event => setEditing({ ...editing, next: event.target.value })} /></Labelled>
          </div>
          <div className="sd-form-actions"><button type="button" className="sd-btn ghost small" onClick={() => act(item, { action: 'cancel', outcome: editing.outcome }, 'Follow-up cancelled.')} disabled={busy}>Cancel follow-up</button><button className="sd-btn small" disabled={busy}>Save</button></div>
        </form>}
        {editing?.id === item._id && editing.mode === 'reschedule' && <form className="sd-subcard" onSubmit={event => { event.preventDefault(); act(item, { action: 'reschedule', dueAt: new Date(editing.dueAt).toISOString() }, 'Follow-up rescheduled.'); }}>
          <div className="sd-grid two"><Labelled label="New time"><input type="datetime-local" required value={editing.dueAt} onChange={event => setEditing({ ...editing, dueAt: event.target.value })} /></Labelled></div>
          <div className="sd-form-actions"><button type="button" className="sd-btn ghost small" onClick={() => setEditing(null)}>Close</button><button className="sd-btn small" disabled={busy}>Reschedule</button></div>
        </form>}
      </li>;
    })}</ul>}
    {result && <Pager page={result.page} pages={result.pages} total={result.total} onPage={setPage} label="follow-ups" />}
  </section>;
}
