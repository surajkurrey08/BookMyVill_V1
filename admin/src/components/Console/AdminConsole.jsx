import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, query } from './api';
import { clearAdminSession } from '../../session';
import { compactRupees, rupees, SEVERITY, relativeTime } from './config';
import { Icon, MetricCard, Alert, StatusBadge, EmptyState, Drawer } from './ui';
import OwnersSection from './OwnersSection';
import PartnerRequests from './PartnerRequests';
import PropertiesSection from './PropertiesSection';
import BookingsSection from './BookingsSection';
import CustomersSection from './CustomersSection';
import AuditSection from './AuditSection';
import TeamSection from './TeamSection';
import './Console.css';

const NAV = [
  { id: 'dashboard', label: 'Control Center', icon: 'fa-gauge-high', perm: 'dashboard.view' },
  { id: 'owners', label: 'Owners', icon: 'fa-user-tie', perm: 'owners.view' },
  { id: 'owner-requests', label: 'Owner Requests', icon: 'fa-envelope', perm: 'owners.view' },
  { id: 'properties', label: 'Properties', icon: 'fa-building', perm: 'properties.view' },
  { id: 'bookings', label: 'Bookings', icon: 'fa-calendar-check', perm: 'bookings.view' },
  { id: 'customers', label: 'Customers', icon: 'fa-users', perm: 'customers.view' },
  { id: 'audit', label: 'Audit Log', icon: 'fa-clock-rotate-left', perm: 'audit.view' },
  { id: 'team', label: 'Team & Access', icon: 'fa-user-shield', perm: 'team.manage' }
];

export default function AdminConsole() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState(() => { const params = new URLSearchParams(window.location.search); return params.get('propertyId') ? 'properties' : ['properties', 'owner-requests'].includes(params.get('section')) ? params.get('section') : 'dashboard'; });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [palette, setPalette] = useState(null);
  const [focus, setFocus] = useState(() => { const id = new URLSearchParams(window.location.search).get('propertyId'); return id ? { type: 'property', id } : null; }); // { type, id } to open a detail from search

  useEffect(() => {
    const controller = new AbortController();
    adminApi('/me', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setMe(data);
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err.status === 401 || err.status === 403) {
        clearAdminSession();
        navigate('/login', { replace: true, state: { authError: err.status === 403 ? 'This session no longer has admin access. Please sign in with an active administrator account.' : err.message } });
        return;
      }
      setError(err.message);
    });
    return () => controller.abort();
  }, [navigate]);

  const can = useCallback(perm => me && (me.permissions.includes('*') || me.permissions.includes(perm)), [me]);
  useEffect(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette({ q: '', results: [] }); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (error && !me) return <div className="ac-shell"><main className="ac-main"><Alert>{error}</Alert></main></div>;
  if (!me) return <div className="ac-boot"><Icon name="fa-shield-halved" /> Loading admin console…</div>;

  const visibleNav = NAV.filter(item => can(item.perm));
  const go = (type, id) => { setFocus({ type, id, at: Date.now() }); setSection(type === 'owner' ? 'owners' : type === 'property' ? 'properties' : type === 'booking' ? 'bookings' : type === 'customer' ? 'customers' : section); setPalette(null); };

  function signOut() { clearAdminSession(); navigate('/login', { replace: true }); }

  return <div className="ac-shell">
    <aside className={`ac-sidebar ${drawerOpen ? 'open' : ''}`}>
      <div className="ac-brand"><span className="ac-brand-mark"><Icon name="fa-shield-halved" /></span><div><strong>BookMyVilla</strong><span>Admin Control Center</span></div></div>
      <nav className="ac-nav">
        {visibleNav.map(item => <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => { setSection(item.id); setDrawerOpen(false); }}>
          <Icon name={item.icon} />{item.label}
        </button>)}
      </nav>
      <div className="ac-sidebar-foot">
        <a href="/dashboard" className="ac-classic-link"><Icon name="fa-table-columns" /> Classic admin tools</a>
        <div className="ac-whoami"><span className="ac-avatar">{(me.name || 'A').charAt(0).toUpperCase()}</span><div><strong>{me.name}</strong><span>{me.roleLabel}</span></div></div>
        <button type="button" className="ac-signout" onClick={signOut}><Icon name="fa-right-from-bracket" /> Sign out</button>
      </div>
    </aside>
    <div className={`ac-backdrop ${drawerOpen ? 'show' : ''}`} onClick={() => setDrawerOpen(false)}></div>

    <main className="ac-main">
      <header className="ac-topbar">
        <button type="button" className="ac-hamburger" onClick={() => setDrawerOpen(v => !v)} aria-label="Menu"><Icon name="fa-bars" /></button>
        <h1>{NAV.find(n => n.id === section)?.label}</h1>
        <button type="button" className="ac-search-trigger" onClick={() => setPalette({ q: '', results: [] })}><Icon name="fa-magnifying-glass" /> Search<kbd>⌘K</kbd></button>
      </header>

      {section === 'dashboard' && <Dashboard can={can} onGo={go} onSection={setSection} />}
      {section === 'owners' && can('owners.view') && <OwnersSection can={can} focus={focus?.type === 'owner' ? focus : null} />}
      {section === 'owner-requests' && can('owners.view') && <PartnerRequests can={can} />}
      {section === 'properties' && can('properties.view') && <PropertiesSection can={can} focus={focus?.type === 'property' ? focus : null} />}
      {section === 'bookings' && can('bookings.view') && <BookingsSection can={can} focus={focus?.type === 'booking' ? focus : null} />}
      {section === 'customers' && can('customers.view') && <CustomersSection can={can} focus={focus?.type === 'customer' ? focus : null} />}
      {section === 'audit' && can('audit.view') && <AuditSection />}
      {section === 'team' && can('team.manage') && <TeamSection meId={me.id} />}
    </main>

    {palette && <CommandPalette onClose={() => setPalette(null)} onGo={go} />}
  </div>;
}

function Dashboard({ onGo, onSection }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [interventions, setInterventions] = useState(null);
  useEffect(() => {
    let cancelled = false;
    adminApi(`/overview?days=${days}`).then(d => { if (!cancelled) { setData(d); setError(''); } }).catch(err => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [days]);
  const attentionTarget = type => {
    if (type === 'property_review' || type === 'unassigned_operations') onSection('properties');
    else if (type === 'issues') adminApi('/operations-issues').then(setInterventions).catch(err => setError(err.message));
    else if (['refund_review', 'unpaid'].includes(type)) onSection('bookings');
    else if (type === 'applications' || type === 'partner_inquiries') onSection('owner-requests');
  };
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="ac-muted">Loading platform metrics…</p>;
  const k = data.kpis;
  return <div className="ac-stack">
    <div className="ac-section-head">
      <div><h2>What's happening across BookMyVilla</h2><p>Live platform metrics, compared with the previous {days} days.</p></div>
      <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Period"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>
    </div>

    <section className="ac-metrics">
      <MetricCard label="GMV" value={compactRupees(k.gmv.value)} changePct={k.gmv.changePct} sub="vs previous" />
      <MetricCard label="Est. platform revenue" value={compactRupees(k.estimatedPlatformRevenue.value)} sub={`est. ${k.estimatedPlatformRevenue.rate * 100}%`} />
      <MetricCard label="Bookings" value={k.bookings.value.toLocaleString('en-IN')} changePct={k.bookings.changePct} sub="created" />
      <MetricCard label="Paid bookings" value={k.paidBookings.value.toLocaleString('en-IN')} changePct={k.paidBookings.changePct} sub="captured" />
      <MetricCard label="Active stays" value={k.activeStays.value} sub="in house now" />
      <MetricCard label="Upcoming confirmed" value={k.confirmedUpcoming.value} sub="future stays" />
      <MetricCard label="Live properties" value={k.activeProperties.value} sub={`${k.suspendedProperties.value} suspended`} onClick={() => onSection('properties')} />
      <MetricCard label="Active owners" value={k.activeOwners.value} onClick={() => onSection('owners')} />
      <MetricCard label="Customers" value={k.totalCustomers.value.toLocaleString('en-IN')} onClick={() => onSection('customers')} />
      <MetricCard label="Property reviews" value={k.pendingPropertyReviews.value} attention={k.pendingPropertyReviews.value > 0} sub="awaiting" onClick={() => onSection('properties')} />
      <MetricCard label="Self Managed Properties" value={k.selfManagedProperties?.value ?? '—'} sub="property management" />
      <MetricCard label="BookMyVilla Managed" value={k.companyManagedProperties?.value ?? '—'} sub="property management" />
      <MetricCard label="Unassigned Managed Properties" value={k.unassignedManagedProperties?.value ?? '—'} sub="Villa Manager needed" attention={(k.unassignedManagedProperties?.value || 0) > 0} />
      <MetricCard label="Unpaid bookings" value={k.pendingPayments.value} sub={rupees(k.pendingPayments.amount)} onClick={() => onSection('bookings')} />
      <MetricCard label="Refund reviews" value={k.refundReviews.value} attention={k.refundReviews.value > 0} sub={rupees(k.refundReviews.amount)} onClick={() => onSection('bookings')} />
    </section>

    <section className="ac-card">
      <div className="ac-card-head"><div><h3>Needs attention</h3><p>Exceptions that need platform intervention — act on these first.</p></div><span className="ac-count">{data.attention.length}</span></div>
      {data.attention.length === 0 ? <EmptyState icon="fa-mug-hot" title="Nothing needs intervention right now">New applications, property reviews, refund exceptions and guest issues will surface here.</EmptyState>
        : <ul className="ac-attention">{data.attention.map((a, i) => <li key={i} className={a.severity}>
          <StatusBadge meta={SEVERITY[a.severity]} />
          <div><strong>{a.title}</strong><small>{a.detail}</small></div>
          <button type="button" className="ac-btn ghost sm" onClick={() => attentionTarget(a.link.type)}>Open</button>
        </li>)}</ul>}
    </section>
    {interventions && <Drawer title="Guest issues requiring intervention" onClose={() => setInterventions(null)}>{interventions.length ? interventions.map(issue => <section className="ac-sub" key={issue._id}><h4>{issue.code} ? {issue.category}</h4><p>{issue.property?.name} ? {issue.description}</p><button type="button" className="ac-btn ghost sm" onClick={() => { setInterventions(null); onGo('booking', issue.booking); }}>Open booking</button></section>) : <EmptyState title="No escalated issues" />}</Drawer>}
  </div>;
}

function CommandPalette({ onClose, onGo }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); const onKey = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(async () => { setBusy(true); try { const d = await adminApi(`/search${query({ q: q.trim() })}`); setResults(d.results); } catch { setResults([]); } finally { setBusy(false); } }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const typeIcon = { owner: 'fa-user-tie', property: 'fa-building', booking: 'fa-calendar-check', customer: 'fa-users' };
  return <div className="ac-overlay ac-center palette" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ac-palette" role="dialog" aria-modal="true" aria-label="Search">
      <div className="ac-palette-input"><Icon name="fa-magnifying-glass" /><input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search owners, properties, bookings, customers…" /></div>
      <div className="ac-palette-results">
        {busy && <p className="ac-muted">Searching…</p>}
        {!busy && q.trim().length >= 2 && results.length === 0 && <p className="ac-muted">No matches.</p>}
        {results.map(r => <button type="button" key={`${r.type}-${r.id}`} onClick={() => onGo(r.type, r.id)}>
          <span className="ac-palette-type"><Icon name={typeIcon[r.type]} /></span>
          <span><strong>{r.title}</strong><small>{r.type} · {r.subtitle}</small></span>
        </button>)}
      </div>
    </div>
  </div>;
}
