import { useCallback, useEffect, useState } from 'react';
import { adminApi, query } from './api';
import { rupees, shortDate, PROPERTY_STATUS, ACCOUNT_STATUS } from './config';
import { Alert, Drawer, EmptyState, Facts, Icon, Pager, StatusBadge, AuditTimeline, ConfirmDialog } from './ui';

const TABS = [
  { id: 'review', label: 'Review queue', filter: { view: 'review' } },
  { id: 'approved', label: 'Live', filter: { status: 'approved' } },
  { id: 'suspended', label: 'Suspended', filter: { status: 'suspended' } },
  { id: 'all', label: 'All', filter: {} }
];

const ACTION_META = {
  approve: { label: 'Approve & publish', tone: 'good', needsReason: false, perm: 'properties.approve' },
  request_changes: { label: 'Request changes', tone: 'warn', needsReason: true, perm: 'properties.approve' },
  reject: { label: 'Reject', tone: 'bad', needsReason: true, perm: 'properties.approve' },
  suspend: { label: 'Suspend listing', tone: 'bad', needsReason: true, perm: 'properties.suspend' },
  unsuspend: { label: 'Restore listing', tone: 'good', needsReason: false, perm: 'properties.suspend' }
};
const ACTIONS_FOR = status => ({
  pending: ['approve', 'request_changes', 'reject'],
  under_review: ['approve', 'reject'],
  approved: ['suspend', 'request_changes'],
  suspended: ['unsuspend', 'reject'],
  rejected: ['approve']
}[status] || []);

export default function PropertiesSection({ can, focus }) {
  const [tab, setTab] = useState('review');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (focus?.id) setOpenId(focus.id); }, [focus]);
  const load = useCallback(async () => {
    try { setData(await adminApi(`/properties${query({ ...TABS.find(t => t.id === tab).filter, q, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [tab, q, page]);
  useEffect(() => { load(); }, [load]);
  const counts = data?.statusCounts || {};

  return <div className="ac-stack">
    <div className="ac-tabs">{TABS.map(t => <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); setPage(1); }}>{t.label}{t.id === 'review' && (counts.pending || counts.under_review) ? <span className="ac-pill">{(counts.pending || 0) + (counts.under_review || 0)}</span> : null}</button>)}</div>
    <div className="ac-toolbar"><label className="ac-search"><Icon name="fa-magnifying-glass" /><input placeholder="Property name or location" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <section className="ac-card nopad">
      {data && data.items.length === 0 ? <EmptyState icon="fa-building" title={tab === 'review' ? 'No properties awaiting review' : 'No properties found'}>{tab === 'review' && 'New and edited listings appear here for approval before they go live.'}</EmptyState>
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Property</th><th>Owner</th><th>Type</th><th>Status</th><th className="num">Rate</th><th>Updated</th></tr></thead>
          <tbody>{data?.items.map(p => <tr key={p._id} onClick={() => setOpenId(p._id)}>
            <td><div className="ac-prop-cell">{p.cover ? <img src={p.cover} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="ac-prop-noimg"><Icon name="fa-image" /></span>}<div><strong className="ac-link">{p.name}</strong><small>{p.location} · {p.photoCount} photos</small></div></div></td>
            <td>{p.owner?.name || <span className="ac-muted">Unlinked</span>}</td>
            <td>{p.type}</td>
            <td><StatusBadge meta={PROPERTY_STATUS[p.status]} fallback={p.status} /></td>
            <td className="num">{rupees(p.price)}</td>
            <td>{shortDate(p.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="properties" />}
    </section>
    {openId && <PropertyDrawer id={openId} can={can} onClose={() => setOpenId(null)} onChanged={load} />}
  </div>;
}

function PropertyDrawer({ id, can, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await adminApi(`/properties/${id}`)); setError(''); } catch (err) { setError(err.message); } }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(action) {
    setBusy(true); setError('');
    try { await adminApi(`/properties/${id}/review`, { method: 'POST', body: { action, reason } }); setConfirm(null); setReason(''); await load(); onChanged(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const p = data?.property;
  const checks = data?.checks || {};
  const actions = p ? ACTIONS_FOR(p.status).filter(a => can(ACTION_META[a].perm)) : [];
  const checkRow = (ok, label) => <li className={ok ? 'ok' : 'miss'}><Icon name={ok ? 'fa-circle-check' : 'fa-circle-xmark'} /> {label}</li>;

  return <Drawer title={p?.name || 'Property'} subtitle={p ? `${p.location} · ${p.type}` : ''} onClose={onClose}
    actions={actions.length > 0 && <div className="ac-drawer-actions">{actions.map(a => <button key={a} type="button" className={`ac-btn ${ACTION_META[a].tone}`} onClick={() => { setReason(''); setConfirm(a); }}>{ACTION_META[a].label}</button>)}</div>}>
    <Alert onClose={() => setError('')}>{error}</Alert>
    {!data ? <p className="ac-muted">Loading…</p> : <>
      <div className="ac-drawer-bar"><StatusBadge meta={PROPERTY_STATUS[p.status]} fallback={p.status} /><span className="ac-tag">{data.bookingCount} bookings</span></div>
      {data.impact.futureBookings > 0 && <Alert kind="warn">{data.impact.futureBookings} upcoming confirmed booking{data.impact.futureBookings === 1 ? '' : 's'}{data.impact.checkingInWithin7Days > 0 ? `, ${data.impact.checkingInWithin7Days} checking in within 7 days` : ''}. Suspending hides the listing but keeps these bookings — handle affected guests separately.</Alert>}
      <Facts items={[
        ['Owner', p.owner ? `${p.owner.name} (${p.owner.email || '—'})` : 'Not linked'],
        ['Rate', rupees(p.price)],
        ['Photos', p.photos?.length || 0],
        ['Amenities', (p.amenities?.length || 0)],
        ['Map', p.mapLink ? 'Provided' : 'Missing'],
        ['Created', shortDate(p.createdAt)]
      ]} />
      <section className="ac-sub"><h4>Verification checklist</h4><ul className="ac-checks">
        {checkRow(checks.hasOwner, 'Linked to an owner account')}
        {checkRow(checks.hasLocation, 'Location provided')}
        {checkRow(checks.validPrice, 'Valid nightly rate')}
        {checkRow(checks.hasCover, 'At least one photo')}
        {checkRow(checks.hasAmenities, 'Amenities listed')}
        {checkRow(checks.hasMap, 'Map link provided')}
      </ul></section>
      {p.photos?.length > 0 && <section className="ac-sub"><h4>Photos</h4><div className="ac-photo-strip">{p.photos.slice(0, 8).map((src, i) => <img key={i} src={src} alt={`Photo ${i + 1}`} onError={e => { e.currentTarget.style.display = 'none'; }} />)}</div></section>}
      <section className="ac-sub"><h4>Admin history</h4><AuditTimeline entries={data.audit} /></section>
    </>}
    {confirm && <ConfirmDialog title={`${ACTION_META[confirm].label}?`} tone={ACTION_META[confirm].tone} confirmLabel={ACTION_META[confirm].label} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => run(confirm)} reason={reason} setReason={setReason} reasonRequired={ACTION_META[confirm].needsReason}>
      <p>{confirm === 'approve' ? 'The property goes live and becomes bookable by customers.' : confirm === 'reject' ? 'The property is rejected and stays hidden. The owner should be told why.' : confirm === 'request_changes' ? 'The listing is moved to “changes requested” and hidden until re-approved.' : confirm === 'suspend' ? 'The listing is hidden from customers immediately. Existing bookings are preserved.' : 'The listing is restored and becomes live again.'}</p>
      {data?.impact.futureBookings > 0 && ['suspend', 'reject', 'request_changes'].includes(confirm) && <p className="ac-impact"><Icon name="fa-triangle-exclamation" /> {data.impact.futureBookings} upcoming booking{data.impact.futureBookings === 1 ? '' : 's'} will be affected.</p>}
    </ConfirmDialog>}
  </Drawer>;
}
