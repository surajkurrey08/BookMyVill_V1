import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, query } from './api';
import { rupees, shortDate, PROPERTY_STATUS, MANAGEMENT_STATUS, staffName } from './config';
import PropertyManagement from './PropertyManagement';
import OwnerSetupLink from './OwnerSetupLink';
import { Alert, Drawer, EmptyState, Facts, Icon, Pager, StatusBadge, AuditTimeline, ConfirmDialog } from './ui';

const TABS = [
  { id: 'review', label: 'Review queue', filter: { view: 'review' } },
  { id: 'approved', label: 'Live', filter: { status: 'approved' } },
  { id: 'suspended', label: 'Suspended', filter: { status: 'suspended' } },
  { id: 'all', label: 'All', filter: {} },
  { id: 'verification', label: 'Blue tick requests', filter: null }
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

// Self-managed owners asking for the "Verified" blue tick on a property.
function VerificationRequests({ can }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const allowed = can('properties.approve');
  const load = useCallback(async () => { try { setItems(await adminApi('/verification-requests')); setError(''); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { load(); }, [load]);
  async function review(property, action, note = '') {
    setBusy(property._id); setError('');
    try { await adminApi(`/properties/${property._id}/verification`, { method: 'POST', body: { action, note } }); setNotice(action === 'approve' ? `${property.name} now shows the Verified blue tick.` : `Verification for ${property.name} was not approved.`); setRejecting(null); setReason(''); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  return <>
    <p className="ac-muted">BookMyVilla-managed villas get the blue tick automatically. Self-managed owners apply here; approve only after checking the property and the owner's documents.</p>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <section className="ac-card nopad">
      {!items ? <p className="ac-muted">Loading requests…</p> : items.length === 0 ? <EmptyState icon="fa-circle-check" title="No blue tick requests">Requests from self-managed owners appear here.</EmptyState>
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Property</th><th>Owner</th><th>Owner's note</th><th>Requested</th><th>Decision</th></tr></thead>
          <tbody>{items.map(p => <tr key={p._id}>
            <td><div className="ac-prop-cell">{p.cover ? <img src={p.cover} alt="" /> : <span className="ac-prop-noimg"><Icon name="fa-image" /></span>}<div><strong>{p.name}</strong><small>{p.location} · {PROPERTY_STATUS[p.status]?.label || p.status}</small></div></div></td>
            <td>{p.owner?.name || '—'}<small>{p.owner?.phone || p.owner?.email}</small></td>
            <td>{p.verification?.note || <span className="ac-muted">—</span>}</td>
            <td>{shortDate(p.verification?.requestedAt)}</td>
            <td>{allowed ? <div className="ac-row-actions"><button type="button" className="ac-btn good" disabled={busy === p._id} onClick={() => review(p, 'approve')}><Icon name="fa-circle-check" /> Approve</button><button type="button" className="ac-btn ghost" disabled={busy === p._id} onClick={() => { setReason(''); setRejecting(p); }}>Reject</button></div> : <span className="ac-muted">View only</span>}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    {rejecting && <ConfirmDialog title={`Reject blue tick for ${rejecting.name}?`} tone="warn" confirmLabel="Reject request" busy={busy === rejecting._id} onClose={() => setRejecting(null)} onConfirm={() => review(rejecting, 'reject', reason)} reason={reason} setReason={setReason} reasonRequired>
      <p>The owner sees this reason and can apply again after fixing it.</p>
    </ConfirmDialog>}
  </>;
}

export default function PropertiesSection({ can, focus }) {
  const [tab, setTab] = useState('review');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [managementMode, setManagementMode] = useState('');
  const [assignment, setAssignment] = useState('');
  const [loading, setLoading] = useState(true);
  const request = useRef(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (focus?.id) setOpenId(focus.id); }, [focus]);
  const load = useCallback(async () => {
    request.current?.abort();
    if (tab === 'verification') { setLoading(false); return; }
    const controller = new AbortController(); request.current = controller; setLoading(true);
    try { setData(await adminApi(`/properties${query({ ...TABS.find(t => t.id === tab).filter, q, page, limit: 20, managementMode, ...(assignment === 'manager' && { assignedVillaManager: 'unassigned' }), ...(assignment === 'data-entry' && { assignedDataEntryUser: 'unassigned' }) })}`, { signal: controller.signal })); setError(''); }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [tab, q, page, managementMode, assignment]);
  useEffect(() => { load(); return () => request.current?.abort(); }, [load]);
  const counts = data?.statusCounts || {};

  return <div className="ac-stack">
    <div className="ac-tabs">{TABS.map(t => <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); setPage(1); }}>{t.label}{t.id === 'review' && (counts.pending || counts.under_review) ? <span className="ac-pill">{(counts.pending || 0) + (counts.under_review || 0)}</span> : null}</button>)}</div>
    {tab === 'verification' ? <VerificationRequests can={can} /> : <>
    <div className="ac-toolbar"><label className="ac-search"><Icon name="fa-magnifying-glass" /><input placeholder="Property name or location" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select aria-label="Management filter" value={managementMode} onChange={e => { setManagementMode(e.target.value); setPage(1); if (assignment === 'manager' && e.target.value !== 'BOOKMYVILLA_MANAGED') setAssignment(''); }}>
        <option value="">All management modes</option><option value="SELF_MANAGED">Self Managed</option><option value="BOOKMYVILLA_MANAGED">Managed by BookMyVilla</option>
      </select>
      <select aria-label="Assignment filter" value={assignment} onChange={e => { setAssignment(e.target.value); setPage(1); if (e.target.value === 'manager') setManagementMode('BOOKMYVILLA_MANAGED'); }}>
        <option value="">All assignments</option><option value="manager">Unassigned Villa Manager</option><option value="data-entry">Unassigned Data Entry</option>
      </select>
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <section className="ac-card nopad">
      {loading ? <p className="ac-muted">Loading properties…</p> : data && data.items.length === 0 ? <EmptyState icon="fa-building" title={tab === 'review' ? 'No properties awaiting review' : 'No properties found'}>{tab === 'review' && 'New and edited listings appear here for approval before they go live.'}</EmptyState>
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Property</th><th>Owner</th><th>Management</th><th>Type</th><th>Status</th><th className="num">Rate</th><th>Updated</th></tr></thead>
          <tbody>{data?.items.map(p => <tr key={p._id} onClick={() => setOpenId(p._id)}>
            <td><div className="ac-prop-cell">{p.cover ? <img src={p.cover} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="ac-prop-noimg"><Icon name="fa-image" /></span>}<div><strong className="ac-link">{p.name}</strong><small>{p.location} · {p.photoCount} photos</small></div></div></td>
            <td>{p.owner?.name || <span className="ac-muted">Unlinked</span>}</td>
            <td><StatusBadge meta={MANAGEMENT_STATUS[p.managementMode || 'SELF_MANAGED']} /><small className={p.managementMode === 'BOOKMYVILLA_MANAGED' && !p.assignedVillaManager ? 'ac-delta down' : ''}>Villa Manager: {staffName(p.assignedVillaManager)}</small><small>Data Entry: {staffName(p.assignedDataEntryUser)}</small></td>
            <td>{p.type}</td>
            <td><StatusBadge meta={PROPERTY_STATUS[p.status]} fallback={p.status} /></td>
            <td className="num">{rupees(p.price)}</td>
            <td>{shortDate(p.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="properties" />}
    </section>
    </>}
    {openId && <PropertyDrawer key={openId} id={openId} can={can} onClose={() => setOpenId(null)} onChanged={load} />}
  </div>;
}

function PropertyDrawer({ id, can, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const fresh = await adminApi(`/properties/${id}`); setData(fresh); setError(''); return fresh; } catch (err) { setError(err.message); } }, [id]);
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
      {data.operations && <section className="ac-sub"><h4>Unassigned operations</h4><p className="ac-muted">Assign a Villa Manager to handle these existing records.</p>{Object.entries(data.operations).map(([kind,items]) => <div key={kind}><strong>{kind}: {items.length}</strong>{items.map(item => <p key={item._id} className="ac-muted">#{item._id.slice(-8)} ? {item.title || item.description || item.guest?.name || 'Booking'} ? {item.stage || item.status || item.stayStatus}</p>)}</div>)}</section>}
      {p.status === 'approved' && p.managementMode === 'SELF_MANAGED' && p.owner?.email && !p.owner.ownerPasswordSetAt && can('owners.manage') && <OwnerSetupLink key={p.owner._id} owner={p.owner} />}
      <PropertyManagement property={p} can={can} onChanged={async () => { if (!await load()) throw new Error('Property refresh failed.'); await onChanged(); }} />
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
