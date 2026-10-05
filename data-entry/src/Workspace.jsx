import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { entryApi } from './api';
import { useAuth } from './App';
import { Alert, Badge, date, Empty, Icon, Loading, titleCase } from './ui';
const STATUS_LABELS = ['ASSIGNED', 'DRAFT', 'IN_PROGRESS', 'INCOMPLETE', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED'];
export function Dashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => { const c = new AbortController(); entryApi.list({ limit: 5 }, c.signal).then(d => { setData(d); setError(''); }).catch(e => { if (e.name !== 'AbortError') { setData(null); setError(e.message); } }); return () => c.abort(); }, [reload]);
  useEffect(() => { const fresh = () => setReload(n => n + 1); window.addEventListener('focus', fresh); return () => window.removeEventListener('focus', fresh); }, []);
  const counts = data?.counts || {};
  const metrics = [['Assigned properties', data?.assigned || 0, ''], ['Pending entry', (counts.ASSIGNED || 0) + (counts.DRAFT || 0) + (counts.IN_PROGRESS || 0), 'pending'], ['Incomplete', counts.INCOMPLETE || 0, 'INCOMPLETE'], ['Changes required', counts.CHANGES_REQUIRED || 0, 'CHANGES_REQUIRED'], ['Ready for review', counts.READY_FOR_REVIEW || 0, 'READY_FOR_REVIEW'], ['Completed', counts.COMPLETED || 0, 'COMPLETED']];
  return <><div className="page-heading"><div><h1>Your listing workspace</h1><p>Finish the details. Check the listing. Send it for review.</p></div><Link className="button primary" to="/properties">Open assigned properties<Icon name="arrow" /></Link></div><Alert>{error}</Alert>{error && <button className="button ghost" onClick={() => { setError(''); setReload(n => n + 1); }}>Retry</button>}
    {!data ? <Loading /> : <><section className="metrics" aria-label="Listing workload">{metrics.map(([label, value, status]) => <Link key={label} to={`/properties${status ? `?dataStatus=${status}` : ''}`}><span>{label}</span><strong>{value}</strong></Link>)}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Recently updated assignments</h2><p>Your latest listing work, with its next step.</p></div><Link to="/properties">View all</Link></div>{data.items.length ? <PropertyTable items={data.items} /> : <Empty title="No assigned properties yet">Admin assignments will appear here automatically. Ask your Admin to assign a property to your staff account.</Empty>}</section>
    <div className="workflow-note"><Icon name="review" /><p>Saved drafts stay private. Submit a complete listing for review; Admin decides when it goes live.</p></div></>}
  </>;
}
export function PropertyList({ mode = '' }) {
  const { data: meta } = useAuth();
  const initial = new URLSearchParams(window.location.search).get('dataStatus') || '';
  const [filters, setFilters] = useState({ q: '', type: '', location: '', dataStatus: initial, reviewStatus: '', completion: '' });
  const [page, setPage] = useState(1); const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [tick, setTick] = useState(0);
  useEffect(() => { setFilters({ q: '', type: '', location: '', dataStatus: initial, reviewStatus: '', completion: '' }); setPage(1); }, [mode, initial]);
  useEffect(() => {
    const c = new AbortController(); setLoading(true);
    const timer = setTimeout(() => entryApi.list({ ...filters, page, limit: 15, ...(mode === 'queue' && { queue: 'true' }) }, c.signal).then(d => { setData(d); setError(''); }).catch(e => { if (e.name !== 'AbortError') { setData(null); setError(e.message); } }).finally(() => { if (!c.signal.aborted) setLoading(false); }), 250);
    return () => { clearTimeout(timer); c.abort(); };
  }, [filters, page, tick, mode]);
  useEffect(() => { const fresh = () => setTick(t => t + 1); window.addEventListener('focus', fresh); return () => window.removeEventListener('focus', fresh); }, []);
  const change = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const title = { queue: 'Data entry queue', media: 'Listing media', review: 'Review status' }[mode] || 'Assigned properties';
  return <><div className="page-heading"><div><h1>{title}</h1><p>{mode === 'review' ? 'Track submissions and read the changes requested by Admin.' : mode === 'media' ? 'Open a listing to upload, categorize and arrange its photos.' : 'Only properties currently assigned to your account appear here.'}</p></div><button className="button ghost" onClick={() => setTick(n => n + 1)}>Refresh assignments</button></div>
    <section className="panel"><div className="filters"><label className="search-label"><span>Property or owner</span><input placeholder="Search property or owner" value={filters.q} onChange={e => change('q', e.target.value)} /></label><label><span>Location</span><input placeholder="City or location" value={filters.location} onChange={e => change('location', e.target.value)} /></label><label><span>Property type</span><select value={filters.type} onChange={e => change('type', e.target.value)}><option value="">All types</option>{meta.propertyTypes.map(t => <option key={t}>{t}</option>)}</select></label><label><span>Data status</span><select value={filters.dataStatus} onChange={e => change('dataStatus', e.target.value)}><option value="">All data statuses</option><option value="pending">Pending entry</option>{STATUS_LABELS.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}</select></label><label><span>Review status</span><select value={filters.reviewStatus} onChange={e => change('reviewStatus', e.target.value)}><option value="">All review statuses</option>{['pending', 'under_review', 'approved', 'rejected', 'suspended'].map(s => <option key={s} value={s}>{titleCase(s)}</option>)}</select></label><label><span>Completion</span><select value={filters.completion} onChange={e => change('completion', e.target.value)}><option value="">Any completion</option><option value="complete">Complete</option><option value="incomplete">Incomplete</option></select></label></div>
    <Alert>{error}</Alert>{error && <button className="button ghost" onClick={() => setTick(n => n + 1)}>Retry</button>}{loading ? <Loading /> : data?.items.length ? <PropertyTable items={data.items} mode={mode} /> : <Empty title="No properties found">{Object.values(filters).some(Boolean) ? 'Try clearing a filter or changing your search.' : 'Admin assignments will appear automatically. Refresh after a new assignment.'}</Empty>}
    {data && <div className="pager"><span>{data.total} assigned result{data.total === 1 ? '' : 's'} · Page {data.page} of {data.pages}</span><div><button className="button ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><button className="button ghost" disabled={page >= data.pages || loading} onClick={() => setPage(page + 1)}>Next</button></div></div>}</section>
  </>;
}
function PropertyTable({ items, mode }) {
  return <div className="table-wrap"><table><thead><tr><th>Property / owner</th><th>Type & location</th><th>Data status</th><th>Completion</th><th>Review</th><th>Updated</th><th>Action</th></tr></thead><tbody>{items.map(p => <tr key={p._id}><td><Link className="property-name" to={`/properties/${p._id}`}>{p.name || 'Untitled property'}</Link><small>{p.owner?.name || 'Owner reference unavailable'}</small></td><td>{p.type}<small>{p.location}</small></td><td><Badge value={p.dataStatus} /></td><td><span className="completion-number">{p.completion}%</span><progress max="100" value={p.completion} aria-label={`${p.name} completion`} /></td><td><Badge value={p.reviewStatus} />{mode === 'review' && p.reviewReason && <small className="review-reason">{p.reviewReason}</small>}</td><td className="date-cell">{date(p.updatedAt)}</td><td><Link className="button ghost compact" to={`/properties/${p._id}/${mode === 'media' ? 'media' : p.canEdit ? 'edit' : ''}`}>{mode === 'media' ? 'Manage media' : p.canEdit ? 'Continue entry' : 'View listing'}<Icon name="arrow" width="16" /></Link></td></tr>)}</tbody></table></div>;
}
export function Profile() {
  const { data } = useAuth();
  return <><div className="page-heading"><div><h1>Staff profile</h1><p>Your account and listing permissions.</p></div></div><section className="panel profile"><dl><dt>Name</dt><dd>{data.user.name}</dd><dt>Work email</dt><dd>{data.user.email}</dd><dt>Role</dt><dd>Data Entry</dd><dt>Account</dt><dd><Badge value={data.user.status} /></dd><dt>Access</dt><dd>Read and edit assigned listing content; submit for Admin review.</dd></dl><p className="muted">Account details and property assignments are managed by Admin.</p></section></>;
}
