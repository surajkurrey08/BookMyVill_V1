import { useCallback, useEffect, useState } from 'react';
import { api, query } from '../../lib/api';
import { rupees, stayRange, relativeTime, countdown } from '../../lib/format';
import { QUOTE_STATUS } from './salesConfig';
import { Alert, EmptyState, Icon, Pager, StatusChip } from './ui';

const FILTERS = [
  { id: 'open', label: 'Awaiting guest', status: 'sent,viewed' },
  { id: 'accepted', label: 'Accepted', status: 'accepted' },
  { id: 'draft', label: 'Drafts', status: 'draft' },
  { id: 'converted', label: 'Booked', status: 'converted' },
  { id: 'closed', label: 'Expired & declined', status: 'expired,rejected,withdrawn' },
  { id: 'all', label: 'All', status: '' }
];

export default function QuotesList({ meta, refreshKey, onOpenQuote, onNewQuote }) {
  const [filter, setFilter] = useState('open');
  const [propertyId, setPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const status = FILTERS.find(item => item.id === filter).status;
  const load = useCallback(async () => {
    setLoading(true);
    try { setResult(await api(`/owner-quotes${query({ status, propertyId, q, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [status, propertyId, q, page]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const counts = result?.statusCounts || {};
  const countFor = item => item.status ? item.status.split(',').reduce((sum, key) => sum + (counts[key] || 0), 0) : Object.values(counts).reduce((sum, value) => sum + value, 0);

  return <section className="sd-card" aria-busy={loading}>
    <div className="sd-tabs" role="tablist" aria-label="Quotation status">
      {FILTERS.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => { setFilter(item.id); setPage(1); }}>{item.label}<span className="sd-tab-count">{countFor(item)}</span></button>)}
    </div>
    <div className="sd-toolbar">
      <label className="sd-search"><Icon name="fa-magnifying-glass" /><span className="sr-only">Search quotations</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Guest, phone or QT code" /></label>
      <select aria-label="Property" value={propertyId} onChange={event => { setPropertyId(event.target.value); setPage(1); }}><option value="">All properties</option>{meta?.properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
    </div>
    {error && <Alert>{error} <button type="button" className="sd-link" onClick={load}>Retry</button></Alert>}
    {result && result.items.length === 0 && <EmptyState icon="fa-file-invoice" title={q || propertyId ? 'No quotations match' : filter === 'open' ? 'No quotations waiting on guests' : 'Nothing here yet'}
      action={<button type="button" className="sd-btn small" onClick={onNewQuote} disabled={!meta?.properties?.length}><Icon name="fa-file-circle-plus" /> New quotation</button>}>
      Quotations you send appear here with live status — opened, accepted or expired.
    </EmptyState>}
    {result?.items.length > 0 && <div className="sd-table-wrap"><table className="sd-table sd-rows">
      <thead><tr><th scope="col">Quotation</th><th scope="col">Stay</th><th scope="col" className="sd-num">Total</th><th scope="col">Status</th><th scope="col">Guest activity</th><th scope="col">Valid</th></tr></thead>
      <tbody>{result.items.map(item => {
        const open = ['sent', 'viewed'].includes(item.status);
        return <tr key={item._id} onClick={() => onOpenQuote(item._id)}>
          <td data-label="Quotation"><button type="button" className="sd-row-link" onClick={event => { event.stopPropagation(); onOpenQuote(item._id); }}>{item.guest?.name}</button><small>{item.code}{item.inquiry ? ` · ${item.inquiry.code}` : ''}</small></td>
          <td data-label="Stay">{stayRange(item.checkIn, item.checkOut)}<small>{item.property?.name} · {item.roomSnapshot?.name}</small></td>
          <td data-label="Total" className="sd-num">{rupees(item.totals?.total)}</td>
          <td data-label="Status"><StatusChip meta={QUOTE_STATUS[item.status]} />{item.holdInventory && open && <small><Icon name="fa-lock" /> Room held</small>}</td>
          <td data-label="Guest activity">{item.viewCount ? `Opened ${item.viewCount}× · first ${relativeTime(item.firstViewedAt)}` : item.sentAt ? 'Not opened yet' : '—'}</td>
          <td data-label="Valid" className={open && item.validUntil && new Date(item.validUntil) - Date.now() < 86400000 ? 'sd-overdue' : ''}>{open ? countdown(item.validUntil) : item.status === 'draft' ? 'Starts when sent' : '—'}</td>
        </tr>;
      })}</tbody>
    </table></div>}
    {result && <Pager page={result.page} pages={result.pages} total={result.total} onPage={setPage} label="quotations" />}
  </section>;
}
