import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api';
import { Alert, EmptyState, Icon } from './ui';
import { shortDate } from './config';

function formatDateTime(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return shortDate(dateString);
  }
}

function parseEnquiryMessage(msg = '') {
  // Typical format:
  // "Customer Enquiry for [Villa] ([Location]). Stay: [N] night(s) (Check-in: [D], Check-out: [D]) for [G] guest(s). Requirements: [Notes]"
  const stayMatch = msg.match(/Stay:\s*([^\.]+?)(?=\.\s*Requirements|\.|$)/i);
  const reqMatch = msg.match(/Requirements:\s*(.*)$/i);
  const notesMatch = msg.match(/Notes:\s*(.*)$/i);

  const stayInfo = stayMatch ? stayMatch[1].trim() : '';
  const requirements = reqMatch ? reqMatch[1].trim() : (notesMatch ? notesMatch[1].trim() : '');

  return {
    stayInfo,
    requirements: requirements || (stayInfo ? '' : msg)
  };
}

export default function EnquiriesSection({ can }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi('/partner-requests');
      setInquiries(Array.isArray(res?.inquiries) ? res.inquiries : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load customer enquiries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // 20s auto-refresh
    window.addEventListener('focus', load);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const updateStatus = async (id, status) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await adminApi(`/partner-inquiries/${id}`, {
        method: 'PATCH',
        body: { status }
      });
      setInquiries(prev => prev.map(item => item._id === id ? { ...item, status: updated.status } : item));
    } catch (err) {
      setError(err.message || 'Could not update inquiry status.');
    } finally {
      setBusyId(null);
    }
  };

  const cleanPhone = (phone = '') => phone.replace(/\D/g, '').slice(-10);

  const getWhatsAppUrl = (item) => {
    const phone = cleanPhone(item.phone);
    const guest = item.fullName || 'Guest';
    const villa = item.propertyName || 'the villa';
    const msg = encodeURIComponent(
      `Hello ${guest}, thank you for your enquiry on BookMyVilla regarding ${villa}. We have received your stay dates and requirements. How can we assist you with your booking and customized tariff package?`
    );
    return `https://wa.me/91${phone}?text=${msg}`;
  };

  const counts = {
    all: inquiries.length,
    new: inquiries.filter(i => i.status === 'new').length,
    contacted: inquiries.filter(i => i.status === 'contacted').length,
    closed: inquiries.filter(i => i.status === 'closed').length
  };

  const filtered = inquiries.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.fullName || '').toLowerCase().includes(q) ||
      (item.phone || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.propertyName || '').toLowerCase().includes(q) ||
      (item.city || '').toLowerCase().includes(q) ||
      (item.message || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="ac-stack">
      {/* Top Header */}
      <div className="ac-section-head">
        <div>
          <h2>Customer Villa Enquiries</h2>
          <p>Direct guest inquiries received from website & mobile app. Instant WhatsApp contact & tariff quoting.</p>
        </div>
        <button className="ac-btn ghost" type="button" onClick={load}>
          <Icon name="fa-rotate" /> Refresh
        </button>
      </div>

      {error && <Alert onClose={() => setError('')}>{error}</Alert>}

      {/* KPI Chips Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Enquiries</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#111827' }}>{counts.all}</strong>
          </div>
          <Icon name="fa-envelope-open-text" style={{ fontSize: '1.4rem', color: '#6366f1' }} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#c2410c', textTransform: 'uppercase', fontWeight: 600 }}>New & Pending</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#ea580c' }}>{counts.new}</strong>
          </div>
          <Icon name="fa-bell" style={{ fontSize: '1.4rem', color: '#f97316' }} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#15803d', textTransform: 'uppercase', fontWeight: 600 }}>Contacted Leads</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#16a34a' }}>{counts.contacted}</strong>
          </div>
          <Icon name="fa-comments" style={{ fontSize: '1.4rem', color: '#22c55e' }} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Closed</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#4b5563' }}>{counts.closed}</strong>
          </div>
          <Icon name="fa-circle-check" style={{ fontSize: '1.4rem', color: '#9ca3af' }} />
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ac-tabs" style={{ margin: 0 }}>
          <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>
            All ({counts.all})
          </button>
          <button type="button" className={statusFilter === 'new' ? 'active' : ''} onClick={() => setStatusFilter('new')}>
            New ({counts.new})
          </button>
          <button type="button" className={statusFilter === 'contacted' ? 'active' : ''} onClick={() => setStatusFilter('contacted')}>
            Contacted ({counts.contacted})
          </button>
          <button type="button" className={statusFilter === 'closed' ? 'active' : ''} onClick={() => setStatusFilter('closed')}>
            Closed ({counts.closed})
          </button>
        </div>

        <div className="ac-toolbar" style={{ margin: 0 }}>
          <label className="ac-search">
            <Icon name="fa-magnifying-glass" />
            <input
              placeholder="Search guest, mobile, villa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '240px' }}
            />
          </label>
        </div>
      </div>

      {/* Table Section */}
      <section className="ac-card nopad">
        {loading ? (
          <p className="ac-muted" style={{ padding: '24px' }}>Loading customer enquiries…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="fa-envelope"
            title={search ? 'No enquiries match your search' : 'No enquiries in this status'}
          />
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Guest & Contact</th>
                  <th style={{ width: '20%' }}>Villa & Destination</th>
                  <th style={{ width: '26%' }}>Stay Dates & Requirements</th>
                  <th style={{ width: '16%' }}>Received At</th>
                  <th style={{ width: '16%' }}>Lead Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const { stayInfo, requirements } = parseEnquiryMessage(item.message);
                  const phoneNum = cleanPhone(item.phone);

                  return (
                    <tr key={item._id} style={{ verticalAlign: 'top' }}>
                      {/* Guest info */}
                      <td>
                        <strong style={{ fontSize: '0.94rem', color: '#111827' }}>{item.fullName}</strong>
                        <div style={{ marginTop: '3px' }}>
                          <a href={`tel:${phoneNum}`} style={{ color: '#374151', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 600 }}>
                            📞 {item.phone}
                          </a>
                        </div>
                        {item.email && (
                          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                            ✉️ <a href={`mailto:${item.email}`} style={{ color: '#4b5563' }}>{item.email}</a>
                          </div>
                        )}
                        <div style={{ marginTop: '8px' }}>
                          <a
                            href={getWhatsAppUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#25D366',
                              color: '#fff',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            <Icon name="fa-brands fa-whatsapp" /> WhatsApp Guest
                          </a>
                        </div>
                      </td>

                      {/* Villa & City */}
                      <td>
                        <strong style={{ fontSize: '0.92rem', color: '#1f2937' }}>
                          {item.propertyName || 'Villa Stay'}
                        </strong>
                        <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '3px' }}>
                          📍 {item.city || 'Maharashtra'}
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '6px',
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            background: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '4px',
                            fontWeight: 500
                          }}
                        >
                          Private Villa Enquiry
                        </span>
                      </td>

                      {/* Stay Dates & Requirements */}
                      <td>
                        {stayInfo && (
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: '6px', marginBottom: '6px' }}>
                            🗓️ {stayInfo}
                          </div>
                        )}
                        {requirements ? (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {requirements}
                          </p>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No special notes provided</span>
                        )}
                      </td>

                      {/* Received At */}
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#374151', display: 'block' }}>
                          {formatDateTime(item.createdAt)}
                        </span>
                      </td>

                      {/* Status & Actions */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              width: 'fit-content',
                              background: item.status === 'new' ? '#ffedd5' : item.status === 'contacted' ? '#dbeafe' : '#f3f4f6',
                              color: item.status === 'new' ? '#c2410c' : item.status === 'contacted' ? '#1d4ed8' : '#4b5563',
                              border: `1px solid ${item.status === 'new' ? '#fdba74' : item.status === 'contacted' ? '#93c5fd' : '#e5e7eb'}`
                            }}
                          >
                            {item.status === 'new' ? '● New Enquiry' : item.status === 'contacted' ? '✓ Contacted' : 'Closed'}
                          </span>

                          <select
                            aria-label={`Status for ${item.fullName}`}
                            value={item.status}
                            disabled={!can('owners.manage') || busyId === item._id}
                            onChange={e => updateStatus(item._id, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              color: '#374151',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="new">Mark New</option>
                            <option value="contacted">Mark Contacted</option>
                            <option value="closed">Mark Closed</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

