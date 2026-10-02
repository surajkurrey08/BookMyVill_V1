import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile, query } from '../../lib/api';
import { relativeTime, stayRange, localDateIso } from '../../lib/format';
import { LEAD_STATUS, SOURCES, STAFF_ROLES } from './salesConfig';
import { Alert, EmptyState, Icon, Pager, StatusChip } from './ui';

const VIEWS = [
  { id: 'open', label: 'Open' },
  { id: 'unanswered', label: 'Needs first reply' },
  { id: 'followups', label: 'Follow-up due' },
  { id: 'booked', label: 'Booked' },
  { id: 'lost', label: 'Lost' },
  { id: 'all', label: 'All' }
];

export default function LeadsList({ meta, refreshKey, view, onViewChange, onOpenLead, onNewLead, notify }) {
  const [filters, setFilters] = useState({ q: '', source: '', propertyId: '', assignedTo: '', priority: '', sort: 'recent' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { setFilters(current => ({ ...current, q: search.trim() })); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = { view, ...filters };
  const paramKey = JSON.stringify(params);
  const load = useCallback(async () => {
    setLoading(true);
    try { setResult(await api(`/owner-crm/inquiries${query({ ...JSON.parse(paramKey), page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [paramKey, page]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const setFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const counts = result?.statusCounts || {};
  const openCount = ['new', 'contacted', 'qualified', 'quotation_sent', 'follow_up', 'payment_pending'].reduce((sum, key) => sum + (counts[key] || 0), 0);
  const badge = { open: openCount, unanswered: counts.new || 0, booked: counts.booked || 0, lost: counts.lost || 0 };
  const hasFilters = filters.q || filters.source || filters.propertyId || filters.assignedTo || filters.priority;

  async function exportCsv() {
    try { await downloadFile(`/owner-crm/inquiries/export.csv${query(params)}`, `inquiries-${localDateIso()}.csv`); }
    catch (err) { notify(err.message, 'error'); }
  }

  return <section className="sd-card" aria-busy={loading}>
    <div className="sd-tabs" role="tablist" aria-label="Lead views">
      {VIEWS.map(item => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} className={view === item.id ? 'active' : ''} onClick={() => { onViewChange(item.id); setPage(1); }}>
        {item.label}{badge[item.id] !== undefined && <span className="sd-tab-count">{badge[item.id]}</span>}
      </button>)}
    </div>

    <div className="sd-toolbar">
      <label className="sd-search"><Icon name="fa-magnifying-glass" /><span className="sr-only">Search leads</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, phone, email or INQ code" /></label>
      <select aria-label="Source" value={filters.source} onChange={event => setFilter('source', event.target.value)}><option value="">All sources</option>{Object.entries(SOURCES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
      <select aria-label="Property" value={filters.propertyId} onChange={event => setFilter('propertyId', event.target.value)}><option value="">All properties</option>{meta?.properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
      <select aria-label="Assigned to" value={filters.assignedTo} onChange={event => setFilter('assignedTo', event.target.value)}><option value="">Anyone</option><option value="unassigned">Unassigned</option>{meta?.staff.map(item => <option key={item._id} value={item._id}>{item.name} · {STAFF_ROLES[item.role] || item.role}</option>)}</select>
      <select aria-label="Priority" value={filters.priority} onChange={event => setFilter('priority', event.target.value)}><option value="">Any priority</option><option value="high">High priority</option><option value="normal">Normal</option><option value="low">Low</option></select>
      <select aria-label="Sort by" value={filters.sort} onChange={event => setFilter('sort', event.target.value)}><option value="recent">Recent activity</option><option value="newest">Newest first</option><option value="followup">Next follow-up</option><option value="checkin">Check-in date</option></select>
      <button type="button" className="sd-btn ghost small" onClick={exportCsv} disabled={!result?.total}><Icon name="fa-file-csv" /> Export</button>
    </div>

    {error && <Alert>{error} <button type="button" className="sd-link" onClick={load}>Retry</button></Alert>}

    {result && result.items.length === 0 && <EmptyState icon={hasFilters ? 'fa-filter-circle-xmark' : 'fa-inbox'} title={hasFilters ? 'No leads match these filters' : view === 'unanswered' ? 'Every inquiry has a reply' : view === 'followups' ? 'No follow-ups due' : 'No inquiries here yet'}
      action={hasFilters ? <button type="button" className="sd-btn ghost small" onClick={() => { setSearch(''); setFilters(current => ({ ...current, q: '', source: '', propertyId: '', assignedTo: '', priority: '' })); }}>Clear filters</button> : <button type="button" className="sd-btn small" onClick={onNewLead}><Icon name="fa-plus" /> Record an inquiry</button>}>
      {hasFilters ? 'Try a different search or clear the filters.' : 'Log calls, WhatsApp chats and walk-ins here so no lead is forgotten.'}
    </EmptyState>}

    {result?.items.length > 0 && <div className="sd-table-wrap">
      <table className="sd-table sd-rows">
        <thead><tr><th scope="col">Guest</th><th scope="col">Stay</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Next follow-up</th><th scope="col">Last activity</th><th scope="col">Owner</th></tr></thead>
        <tbody>{result.items.map(item => {
          const overdue = item.nextFollowUpAt && new Date(item.nextFollowUpAt) < new Date();
          return <tr key={item._id} onClick={() => onOpenLead(item._id)}>
            <td data-label="Guest">
              <button type="button" className="sd-row-link" onClick={event => { event.stopPropagation(); onOpenLead(item._id); }}>{item.guestName}</button>
              {item.priority === 'high' && <span className="sd-flag" title="High priority"><Icon name="fa-fire" /> High</span>}
              <small>{item.code} · {item.guestPhone || item.guestEmail}</small>
            </td>
            <td data-label="Stay">{stayRange(item.checkIn, item.checkOut)}<small>{item.property?.name || 'Any property'} · {item.adults + item.children} guests</small></td>
            <td data-label="Source"><Icon name={SOURCES[item.source]?.icon || 'fa-circle'} /> {SOURCES[item.source]?.label}</td>
            <td data-label="Status"><StatusChip meta={LEAD_STATUS[item.status]} /></td>
            <td data-label="Next follow-up" className={overdue ? 'sd-overdue' : ''}>{item.nextFollowUpAt ? <>{overdue && <Icon name="fa-triangle-exclamation" />} {relativeTime(item.nextFollowUpAt)}</> : <span className="sd-muted">None</span>}</td>
            <td data-label="Last activity">{relativeTime(item.lastActivityAt)}</td>
            <td data-label="Owner">{item.assignedTo?.name || <span className="sd-muted">Unassigned</span>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    {result && <Pager page={result.page} pages={result.pages} total={result.total} onPage={setPage} label="leads" />}
  </section>;
}
