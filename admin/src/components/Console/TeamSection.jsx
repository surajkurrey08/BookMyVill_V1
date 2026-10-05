import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api';
import { shortDate, PERMISSION_LABELS } from './config';
import { Alert, EmptyState, Icon, Drawer } from './ui';

export default function TeamSection({ meId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState([]);
  const [adding, setAdding] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', password: '', role: 'data_entry' });
  const load = useCallback(async () => { try { setData(await adminApi('/team')); setError(''); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const loadStaff = useCallback(async () => { try { setStaff(await adminApi('/staff-accounts')); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { loadStaff(); }, [loadStaff]);
  async function addStaff(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await adminApi('/staff-accounts', { method: 'POST', body: staffForm });
      setNotice('Staff account created. Assign properties from Property Management.');
      setAdding(false); setStaffForm({ name: '', email: '', phone: '', password: '', role: 'data_entry' }); await loadStaff();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function changeStaffStatus(person) {
    setBusy(true); setError('');
    try { await adminApi(`/staff-accounts/${person._id}`, { method: 'PATCH', body: { status: person.status === 'suspended' ? 'active' : 'suspended' } }); await loadStaff(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function saveRole() {
    setBusy(true); setError('');
    try {
      await adminApi(`/team/${editing._id}/role`, { method: 'POST', body: { adminRole: editing.adminRole, permissions: editing.adminPermissions } });
      setNotice(`${editing.name || editing.email} updated.`); setEditing(null); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const roleLabel = data ? Object.fromEntries(data.roles.map(r => [r.role, r.label])) : {};

  return <div className="ac-stack">
    <div className="ac-section-head"><div><h2>Admin team & access</h2><p>One admin panel, role-based access. The backend enforces every permission.</p></div></div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <section className="ac-card nopad">
      {!data ? <p className="ac-muted" style={{ padding: 20 }}>Loading…</p> : data.items.length === 0 ? <EmptyState icon="fa-user-shield" title="No admin accounts" />
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>Admin</th><th>Role</th><th className="num">Permissions</th><th>Added</th><th></th></tr></thead>
          <tbody>{data.items.map(a => <tr key={a._id}>
            <td><strong>{a.name}{String(a._id) === String(meId) && <span className="ac-you">You</span>}</strong><small>{a.email}</small></td>
            <td><span className="ac-role-chip">{roleLabel[a.effectiveRole] || a.effectiveRole}</span></td>
            <td className="num">{a.permissions.includes('*') ? 'All' : a.permissions.length}</td>
            <td>{shortDate(a.createdAt)}</td>
            <td className="right"><button type="button" className="ac-btn ghost sm" onClick={() => setEditing({ ...a, adminRole: a.effectiveRole, adminPermissions: a.permissions.includes('*') ? [] : a.permissions })}>Edit access</button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <div className="ac-section-head"><div><h2>Data Entry & Villa Manager accounts</h2><p>Create staff sign-ins, then assign properties from Property Management.</p></div><button type="button" className="ac-btn primary" onClick={() => { setError(''); setAdding(true); }}>Add staff account</button></div>
    <section className="ac-card nopad"><div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>Staff</th><th>Panel</th><th>Status</th><th></th></tr></thead><tbody>{staff.map(person => <tr key={person._id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.role === 'data_entry' ? 'Data Entry' : 'Villa Manager'}</td><td>{person.status}</td><td><button type="button" className="ac-btn ghost sm" disabled={busy} onClick={() => changeStaffStatus(person)}>{person.status === 'suspended' ? 'Activate' : 'Suspend'}</button></td></tr>)}</tbody></table>{staff.length === 0 && <EmptyState icon="fa-users" title="No staff accounts yet" />}</div></section>
    {adding && <Drawer title="Add staff account" subtitle="Staff use this email and password in their assigned panel." onClose={() => { if (!busy) setAdding(false); }}>
      <form onSubmit={addStaff} className="ac-stack"><Alert>{error}</Alert>
        <label className="ac-field"><span>Name</span><input required maxLength={100} value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} /></label>
        <label className="ac-field"><span>Work email</span><input type="email" autoComplete="off" required maxLength={120} value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} /></label>
        <label className="ac-field"><span>Phone (optional)</span><input maxLength={20} value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} /></label>
        <label className="ac-field"><span>Panel</span><select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}><option value="data_entry">Data Entry</option><option value="villa_manager">Villa Manager</option></select></label>
        <label className="ac-field"><span>Password (at least 10 characters)</span><input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} /></label>
        <button type="submit" className="ac-btn primary" disabled={busy}>{busy ? 'Creating?' : 'Create staff account'}</button>
      </form>
    </Drawer>}

    {editing && <Drawer title={`Access · ${editing.name || editing.email}`} subtitle={editing.email} onClose={() => setEditing(null)}
      actions={<div className="ac-drawer-actions"><button type="button" className="ac-btn ghost" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="ac-btn primary" disabled={busy} onClick={saveRole}>Save access</button></div>}>
      <Alert onClose={() => setError('')}>{error}</Alert>
      <label className="ac-field"><span>Role</span>
        <select value={editing.adminRole} onChange={e => setEditing({ ...editing, adminRole: e.target.value })}>
          {data.roles.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
        </select>
      </label>
      <p className="ac-muted">Role grants these permissions:</p>
      <ul className="ac-perm-list">
        {(data.roles.find(r => r.role === editing.adminRole)?.permissions || []).map(p => <li key={p}><Icon name="fa-circle-check" /> {p === '*' ? 'Full access (all permissions)' : PERMISSION_LABELS[p] || p}</li>)}
      </ul>
      {editing.adminRole !== 'super_admin' && <>
        <p className="ac-muted">Extra permissions beyond the role:</p>
        <div className="ac-perm-grid">{data.permissions.map(p => {
          const inRole = (data.roles.find(r => r.role === editing.adminRole)?.permissions || []).includes(p);
          const checked = inRole || editing.adminPermissions.includes(p);
          return <label key={p} className={`ac-perm-toggle ${inRole ? 'locked' : ''}`}>
            <input type="checkbox" checked={checked} disabled={inRole} onChange={e => setEditing({ ...editing, adminPermissions: e.target.checked ? [...editing.adminPermissions, p] : editing.adminPermissions.filter(x => x !== p) })} />
            {PERMISSION_LABELS[p] || p}
          </label>;
        })}</div>
      </>}
    </Drawer>}
  </div>;
}
