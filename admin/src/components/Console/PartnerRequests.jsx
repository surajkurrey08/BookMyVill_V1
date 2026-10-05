import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api';
import { Alert, EmptyState } from './ui';
import { shortDate } from './config';

export default function PartnerRequests({ can }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('applications');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const load = useCallback(async () => {
    try { setData(await adminApi('/partner-requests')); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);

  const updateInquiry = async (id, status) => {
    setBusyId(id); setError('');
    try {
      const saved = await adminApi(`/partner-inquiries/${id}`, { method: 'PATCH', body: { status } });
      setData(previous => ({ ...previous, inquiries: previous.inquiries.map(item => item._id === id ? saved : item) }));
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };

  const items = data?.[tab] || [];
  return <div className="ac-stack">
    <div className="ac-section-head"><div><h2>Owner applications & partnership inquiries</h2><p>Requests submitted from Join Us. Refreshes every 30 seconds.</p></div><button className="ac-btn ghost" type="button" onClick={load}>Refresh requests</button></div>
    {error && <Alert>{error}</Alert>}
    <div className="ac-tabs">
      <button type="button" className={tab === 'applications' ? 'active' : ''} aria-pressed={tab === 'applications'} onClick={() => setTab('applications')}>Applications ({data?.applications.length || 0})</button>
      <button type="button" className={tab === 'inquiries' ? 'active' : ''} aria-pressed={tab === 'inquiries'} onClick={() => setTab('inquiries')}>Inquiries ({data?.inquiries.length || 0})</button>
    </div>
    {!data ? (!error && <p className="ac-muted">Loading requests…</p>) : <section className="ac-card">
      {items.length === 0 ? <EmptyState icon="fa-envelope" title={tab === 'inquiries' ? 'No partnership inquiries yet' : 'No owner applications yet'} /> : <div className="ac-table-wrap"><table className="ac-table">
        <thead><tr><th>Owner & contact</th><th>Request</th><th>Message</th><th>Received</th><th>Status / action</th></tr></thead>
        <tbody>{items.map(item => <tr key={item._id}>
          <td><strong>{item.fullName}</strong><small><a href={`mailto:${item.email}`}>{item.email}</a></small><small><a href={`tel:${item.phone}`}>{item.phone}</a></small></td>
          <td><strong>{tab === 'inquiries' ? 'Partnership inquiry' : item.applicationType === 'owner-registration' ? 'Owner registration' : 'Property listing'}</strong><small>{item.propertyName && item.propertyName !== 'N/A' ? item.propertyName : 'Property details not provided'}</small><small>{item.city}</small></td>
          <td style={{ minWidth: 200, maxWidth: 350, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message || '—'}</td>
          <td>{shortDate(item.createdAt || item.appliedAt)}</td>
          <td>{tab === 'inquiries' ? <select aria-label={`Inquiry status for ${item.fullName}`} value={item.status} disabled={!can('owners.manage') || busyId === item._id} onChange={e => updateInquiry(item._id, e.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select> : <><span className="ac-badge neutral">{item.status}</span><small><a href="/dashboard" className="ac-link">Review application</a></small></>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>}
  </div>;
}
