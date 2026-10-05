import { useCallback, useEffect, useState } from 'react';
import { adminApi, query } from './api';
import { rupees, compactRupees, shortDate, dateTime, ACCOUNT_STATUS, KYC_STATUS, BOOKING_STATUS, managementLabel } from './config';
import { Alert, Drawer, EmptyState, Facts, Icon, Pager, StatusBadge, AuditTimeline, ConfirmDialog, Labelled } from './ui';

export default function OwnersSection({ can, focus }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (focus?.id) setOpenId(focus.id); }, [focus]);
  const load = useCallback(async () => {
    try { setData(await adminApi(`/owners${query({ status, q, page, limit: 20 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [status, q, page]);
  useEffect(() => { load(); }, [load]);

  return <div className="ac-stack">
    <div className="ac-toolbar">
      <label className="ac-search"><Icon name="fa-magnifying-glass" /><input placeholder="Name, email or phone" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select>
      {can('owners.manage') && <button type="button" className="ac-btn primary" onClick={() => setAdding(true)}><Icon name="fa-plus" /> Add owner</button>}
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <section className="ac-card nopad">
      {data && data.items.length === 0 ? <EmptyState icon="fa-user-tie" title="No owners found" />
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Owner</th><th>Status</th><th>KYC</th><th className="num">Properties</th><th className="num">Bookings</th><th className="num">GMV</th><th>Joined</th></tr></thead>
          <tbody>{data?.items.map(o => <tr key={o._id} onClick={() => setOpenId(o._id)}>
            <td><strong className="ac-link">{o.name}</strong><small>{o.email || o.phone}</small></td>
            <td><StatusBadge meta={ACCOUNT_STATUS[o.status]} fallback={o.status} /></td>
            <td><StatusBadge meta={KYC_STATUS[o.kyc]} /></td>
            <td className="num">{o.approvedProperties}/{o.properties}</td>
            <td className="num">{o.bookings}</td>
            <td className="num">{compactRupees(o.gmv)}</td>
            <td>{shortDate(o.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="owners" />}
    </section>
    {openId && <OwnerDrawer id={openId} can={can} onClose={() => setOpenId(null)} onChanged={load} />}
    {adding && can('owners.manage') && <AddOwnerDrawer onClose={() => setAdding(false)} onCreated={owner => {
      setAdding(false); setNotice(`Owner account created for ${owner.email}. They can sign in to the Owner panel with the password you set.`);
      load(); setOpenId(owner._id);
    }} />}
  </div>;
}

function AddOwnerDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onCreated(await adminApi('/owners', { method: 'POST', body: form })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <Drawer title="Add owner" subtitle="Create an owner account with access to the Owner panel." onClose={() => { if (!busy) onClose(); }}>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <form className="ac-stack" onSubmit={submit}>
      <label className="ac-field"><span>Owner name</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={update} /></label>
      <label className="ac-field"><span>Email address</span><input name="email" type="email" autoComplete="email" required maxLength={120} value={form.email} onChange={update} /></label>
      <label className="ac-field"><span>Phone number (optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={update} /></label>
      <label className="ac-field"><span>Password (at least 10 characters)</span><input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={form.password} onChange={update} /></label>
      <p className="ac-muted">Share the email and password with the owner so they can sign in. Property listings and KYC are managed separately.</p>
      <div className="ac-drawer-actions"><button type="button" className="ac-btn ghost" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="ac-btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create owner'}</button></div>
    </form>
  </Drawer>;
}

function OwnerDrawer({ id, can, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await adminApi(`/owners/${id}`)); setError(''); } catch (err) { setError(err.message); } }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(action) {
    setBusy(true); setError('');
    try { await adminApi(`/owners/${id}/status`, { method: 'POST', body: { action, reason } }); setConfirm(null); setReason(''); await load(); onChanged(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const o = data?.owner;
  return <Drawer title={o?.name || 'Owner'} subtitle={o ? `${o.email || o.phone} · joined ${shortDate(o.createdAt)}` : ''} onClose={onClose}
    actions={o && can('owners.manage') && <div className="ac-drawer-actions">
      {o.status !== 'suspended' && <button type="button" className="ac-btn bad" onClick={() => { setReason(''); setConfirm('suspend'); }}>Suspend</button>}
      {o.status !== 'restricted' && o.status !== 'suspended' && <button type="button" className="ac-btn warn" onClick={() => { setReason(''); setConfirm('restrict'); }}>Restrict</button>}
      {['suspended', 'restricted'].includes(o.status) && <button type="button" className="ac-btn good" onClick={() => { setReason(''); setConfirm('activate'); }}>Reactivate</button>}
    </div>}>
    <Alert onClose={() => setError('')}>{error}</Alert>
    {!data ? <p className="ac-muted">Loading…</p> : <>
      <div className="ac-drawer-bar"><StatusBadge meta={ACCOUNT_STATUS[o.status]} fallback={o.status} />{data.application && <StatusBadge meta={KYC_STATUS[data.application.status]} />}{o.statusReason && <span className="ac-tag">Reason: {o.statusReason}</span>}</div>
      <Facts items={[
        ['Properties', `${data.properties.length} (${data.properties.filter(p => p.status === 'approved').length} live)`],
        ['Bookings', data.stats.total],
        ['GMV', rupees(data.stats.gmv)],
        ['Est. payable', rupees(data.stats.estimatedPayable)],
        ['Cancellations', data.stats.cancelled],
        data.application && ['Application', `${data.application.partnerType} · ${data.application.status}`]
      ]} />
      <section className="ac-sub"><h4>Properties</h4>{data.properties.length === 0 ? <p className="ac-muted">None yet.</p> : <ul className="ac-mini-list">{data.properties.map(p => <li key={p._id}><div><strong>{p.name}</strong><small>{p.location} · {rupees(p.price)}</small><small>{managementLabel(p.managementMode)}</small></div><StatusBadge meta={{ approved: { label: 'Live', tone: 'good' }, pending: { label: 'Pending', tone: 'info' }, under_review: { label: 'Changes', tone: 'warn' }, suspended: { label: 'Suspended', tone: 'bad' }, rejected: { label: 'Rejected', tone: 'bad' } }[p.status]} fallback={p.status} /></li>)}</ul>}</section>
      <section className="ac-sub"><h4>Recent bookings</h4>{data.recentBookings.length === 0 ? <p className="ac-muted">None.</p> : <ul className="ac-mini-list">{data.recentBookings.map(b => <li key={b._id}><div><strong>{b.user?.name || b.guest?.name || 'Guest'}</strong><small>{b.property?.name} · {shortDate(b.checkIn)}</small></div><span>{rupees(b.totalPrice)} · <StatusBadge meta={BOOKING_STATUS[b.status]} fallback={b.status} /></span></li>)}</ul>}</section>
      <section className="ac-sub"><h4>Admin history</h4><AuditTimeline entries={data.audit} /></section>
    </>}
    {confirm && <ConfirmDialog title={`${confirm === 'activate' ? 'Reactivate' : confirm === 'restrict' ? 'Restrict' : 'Suspend'} ${o.name}?`} tone={confirm === 'activate' ? 'good' : confirm === 'suspend' ? 'bad' : 'warn'} confirmLabel={confirm === 'activate' ? 'Reactivate' : confirm === 'restrict' ? 'Restrict account' : 'Suspend account'} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => act(confirm)} reason={reason} setReason={setReason} reasonRequired={confirm !== 'activate'}>
      <p>{confirm === 'suspend' ? 'The owner will be locked out of the owner panel immediately. Existing bookings are kept. Their live properties stay listed unless you also suspend them.' : confirm === 'restrict' ? 'The account is flagged as restricted for review. Sign-in still works.' : 'The account returns to active and the owner regains access.'}</p>
    </ConfirmDialog>}
  </Drawer>;
}
