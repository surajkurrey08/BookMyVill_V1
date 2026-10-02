import { useCallback, useEffect, useState } from 'react';
import { adminApi, query } from './api';
import { rupees, shortDate, ACCOUNT_STATUS, BOOKING_STATUS } from './config';
import { Alert, Drawer, EmptyState, Facts, Icon, Pager, StatusBadge, AuditTimeline, ConfirmDialog } from './ui';

export default function CustomersSection({ can, focus }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (focus?.id) setOpenId(focus.id); }, [focus]);
  const load = useCallback(async () => {
    try { setData(await adminApi(`/customers${query({ status, q, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [status, q, page]);
  useEffect(() => { load(); }, [load]);

  return <div className="ac-stack">
    <div className="ac-toolbar">
      <label className="ac-search"><Icon name="fa-magnifying-glass" /><input placeholder="Name, email or phone" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All</option><option value="active">Active</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select>
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <section className="ac-card nopad">
      {data && data.items.length === 0 ? <EmptyState icon="fa-users" title="No customers found" />
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Customer</th><th>Status</th><th className="num">Bookings</th><th className="num">Spend</th><th className="num">Cancellations</th><th>Joined</th></tr></thead>
          <tbody>{data?.items.map(c => <tr key={c._id} onClick={() => setOpenId(c._id)}>
            <td><strong className="ac-link">{c.name}</strong><small>{c.email || c.phone}</small></td>
            <td><StatusBadge meta={ACCOUNT_STATUS[c.status]} fallback={c.status} /></td>
            <td className="num">{c.bookings}</td>
            <td className="num">{rupees(c.spend)}</td>
            <td className="num">{c.cancellations}</td>
            <td>{shortDate(c.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="customers" />}
    </section>
    {openId && <CustomerDrawer id={openId} can={can} onClose={() => setOpenId(null)} onChanged={load} />}
  </div>;
}

function CustomerDrawer({ id, can, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await adminApi(`/customers/${id}`)); setError(''); } catch (err) { setError(err.message); } }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(action) {
    setBusy(true); setError('');
    try { await adminApi(`/customers/${id}/status`, { method: 'POST', body: { action, reason } }); setConfirm(null); setReason(''); await load(); onChanged(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const c = data?.customer;
  return <Drawer title={c?.name || 'Customer'} subtitle={c ? `${c.email || c.phone} · joined ${shortDate(c.createdAt)}` : ''} onClose={onClose}
    actions={c && can('customers.manage') && <div className="ac-drawer-actions">
      {c.status !== 'suspended' && <button type="button" className="ac-btn bad" onClick={() => { setReason(''); setConfirm('suspend'); }}>Suspend</button>}
      {c.status !== 'restricted' && c.status !== 'suspended' && <button type="button" className="ac-btn warn" onClick={() => { setReason(''); setConfirm('restrict'); }}>Restrict</button>}
      {['suspended', 'restricted'].includes(c.status) && <button type="button" className="ac-btn good" onClick={() => { setReason(''); setConfirm('activate'); }}>Reactivate</button>}
    </div>}>
    <Alert onClose={() => setError('')}>{error}</Alert>
    {!data ? <p className="ac-muted">Loading…</p> : <>
      <div className="ac-drawer-bar"><StatusBadge meta={ACCOUNT_STATUS[c.status]} fallback={c.status} />{c.statusReason && <span className="ac-tag">Reason: {c.statusReason}</span>}</div>
      <section className="ac-sub"><h4>Bookings</h4>{data.bookings.length === 0 ? <p className="ac-muted">None.</p> : <ul className="ac-mini-list">{data.bookings.map(b => <li key={b._id}><div><strong>{b.property?.name || 'Property'}</strong><small>{shortDate(b.checkIn)} → {shortDate(b.checkOut)}</small></div><span>{rupees(b.totalPrice)} · <StatusBadge meta={BOOKING_STATUS[b.status]} fallback={b.status} /></span></li>)}</ul>}</section>
      <section className="ac-sub"><h4>Admin history</h4><AuditTimeline entries={data.audit} /></section>
    </>}
    {confirm && <ConfirmDialog title={`${confirm === 'activate' ? 'Reactivate' : confirm === 'restrict' ? 'Restrict' : 'Suspend'} ${c.name}?`} tone={confirm === 'activate' ? 'good' : confirm === 'suspend' ? 'bad' : 'warn'} confirmLabel={confirm === 'activate' ? 'Reactivate' : confirm === 'restrict' ? 'Restrict' : 'Suspend'} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => act(confirm)} reason={reason} setReason={setReason} reasonRequired={confirm !== 'activate'}>
      <p>{confirm === 'suspend' ? 'The customer is locked out of their account immediately.' : confirm === 'restrict' ? 'The account is flagged as restricted for review.' : 'The account returns to active.'}</p>
    </ConfirmDialog>}
  </Drawer>;
}
