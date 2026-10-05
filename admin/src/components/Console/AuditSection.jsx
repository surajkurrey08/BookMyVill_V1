import { useCallback, useEffect, useState } from 'react';
import { adminApi, query } from './api';
import { dateTime, auditActionLabel, auditChangeLabel } from './config';
import { Alert, EmptyState, Icon, Pager } from './ui';

const ENTITY_ICON = { property: 'fa-building', owner: 'fa-user-tie', customer: 'fa-users', booking: 'fa-calendar-check', admin: 'fa-user-shield' };

export default function AuditSection() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await adminApi(`/audit${query({ entityType, page, limit: 30 })}`)); setError(''); }
    catch (err) { setError(err.message); }
  }, [entityType, page]);
  useEffect(() => { load(); }, [load]);

  return <div className="ac-stack">
    <div className="ac-toolbar">
      <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }} aria-label="Entity type">
        <option value="">All actions</option><option value="property">Properties</option><option value="owner">Owners</option><option value="customer">Customers</option><option value="booking">Bookings</option><option value="admin">Admin team</option>
      </select>
      <span className="ac-muted">The audit log is append-only. Entries cannot be edited or deleted.</span>
    </div>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <section className="ac-card nopad">
      {data && data.items.length === 0 ? <EmptyState icon="fa-clock-rotate-left" title="No admin actions logged yet" />
        : <div className="ac-table-wrap"><table className="ac-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Change</th><th>Reason</th></tr></thead>
          <tbody>{data?.items.map(e => <tr key={e._id}>
            <td className="nowrap">{dateTime(e.createdAt)}</td>
            <td>{e.actor?.name || e.actorName || 'Admin'}</td>
            <td><span className="ac-action-chip"><Icon name={ENTITY_ICON[e.entityType] || 'fa-circle'} /> {auditActionLabel(e)}</span></td>
            <td>{e.entityLabel || '—'}</td>
            <td>{auditChangeLabel(e) || '—'}</td>
            <td className="ac-reason-cell">{e.reason || '—'}</td>
          </tr>)}</tbody>
        </table></div>}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} label="entries" />}
    </section>
  </div>;
}
