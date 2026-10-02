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
  const load = useCallback(async () => { try { setData(await adminApi('/team')); setError(''); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { load(); }, [load]);

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
