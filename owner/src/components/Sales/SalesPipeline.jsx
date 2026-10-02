import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { rupees, relativeTime, countdown } from '../../lib/format';
import { SOURCES, LOST_REASONS, CHANNELS } from './salesConfig';
import { Alert, EmptyState, Icon } from './ui';

const FUNNEL = [
  { key: 'total', label: 'Inquiries' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'quoted', label: 'Quotation sent' },
  { key: 'paymentPending', label: 'Accepted / payment' },
  { key: 'booked', label: 'Booked' }
];

const percent = (part, whole) => (whole ? Math.round(part / whole * 100) : 0);

function minutesLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} days`;
}

export default function SalesPipeline({ refreshKey, onOpenLead, onOpenQuote, onOpenLeads, onOpenView }) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSummary(await api(`/owner-crm/summary?days=${days}`)); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (error && !summary) return <Alert>{error} <button type="button" className="sd-link" onClick={load}>Retry</button></Alert>;
  if (!summary) return <p className="sd-muted" aria-live="polite">Loading pipeline…</p>;

  const { funnel, followUps, quotes } = summary;
  const steps = FUNNEL.map(step => ({ ...step, value: funnel[step.key] || 0 }));
  let biggestDrop = null;
  for (let i = 1; i < steps.length; i++) {
    const lost = steps[i - 1].value - steps[i].value;
    if (steps[i - 1].value > 0 && lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) biggestDrop = { index: i, lost, rate: percent(lost, steps[i - 1].value) };
  }
  const attentionCount = summary.staleNew + followUps.overdue + quotes.expiringSoon.length + quotes.acceptedList.length;

  return <div className="sd-stack" aria-busy={loading}>
    <section className="sd-kpis" aria-label="Sales at a glance">
      <button type="button" className="sd-kpi" onClick={() => onOpenLeads('open')}><span>Open leads</span><strong>{summary.openLeads}</strong><small>{summary.newToday} new today</small></button>
      <button type="button" className={`sd-kpi ${summary.staleNew ? 'attention' : ''}`} onClick={() => onOpenLeads('unanswered')}><span>Waiting for first reply</span><strong>{summary.byStatus.new}</strong><small>{summary.staleNew ? <><Icon name="fa-triangle-exclamation" /> {summary.staleNew} older than 1 hour</> : 'All answered within the hour'}</small></button>
      <button type="button" className={`sd-kpi ${followUps.overdue ? 'attention' : ''}`} onClick={() => onOpenView('followups')}><span>Follow-ups due</span><strong>{followUps.overdue + followUps.dueToday}</strong><small>{followUps.overdue ? <><Icon name="fa-triangle-exclamation" /> {followUps.overdue} overdue</> : `${followUps.dueToday} later today`}</small></button>
      <button type="button" className="sd-kpi" onClick={() => onOpenView('quotes')}><span>Quotations awaiting guest</span><strong>{quotes.awaiting}</strong><small>{rupees(quotes.awaitingValue)} · {quotes.viewed} opened</small></button>
      <button type="button" className={`sd-kpi ${quotes.accepted ? 'positive' : ''}`} onClick={() => onOpenView('quotes')}><span>Accepted, not yet booked</span><strong>{quotes.accepted}</strong><small>{rupees(quotes.acceptedValue)}</small></button>
      <div className="sd-kpi static"><span>Average first reply</span><strong>{summary.responseTime ? minutesLabel(summary.responseTime.averageMinutes) : '—'}</strong><small>{summary.responseTime ? `${summary.responseTime.sample} inquir${summary.responseTime.sample === 1 ? 'y' : 'ies'}, last ${days} days` : 'Logged once you contact a guest'}</small></div>
    </section>

    <section className="sd-card">
      <div className="sd-card-head"><div><h3>Needs attention</h3><p>Act on these first — they are the leads most likely to slip.</p></div><span className="sd-count">{attentionCount}</span></div>
      {attentionCount === 0 ? <EmptyState icon="fa-mug-hot" title="Nothing urgent right now">New inquiries, overdue follow-ups and quotations close to expiry will appear here.</EmptyState> : <ul className="sd-attention">
        {summary.staleNew > 0 && <li className="high"><Icon name="fa-bolt" /><div><strong>{summary.staleNew} new inquir{summary.staleNew === 1 ? 'y has' : 'ies have'} waited over an hour for a reply</strong><small>Fast replies convert better. Call or message them now.</small></div><button type="button" className="sd-btn small" onClick={() => onOpenLeads('unanswered')}>Open</button></li>}
        {followUps.list.map(item => <li key={item._id} className={new Date(item.dueAt) < new Date() ? 'high' : 'medium'}>
          <Icon name={CHANNELS[item.channel]?.icon || 'fa-bell'} />
          <div><strong>{item.inquiry?.guestName || 'Guest'} · {CHANNELS[item.channel]?.label} follow-up {new Date(item.dueAt) < new Date() ? `overdue (${relativeTime(item.dueAt)})` : relativeTime(item.dueAt)}</strong><small>{item.note || 'No note'}{item.assignedTo ? ` · ${item.assignedTo.name}` : ''}</small></div>
          {item.inquiry && <button type="button" className="sd-btn ghost small" onClick={() => onOpenLead(item.inquiry._id)}>Open lead</button>}
        </li>)}
        {quotes.acceptedList.map(item => <li key={item._id} className="medium"><Icon name="fa-handshake" /><div><strong>{item.guest?.name} accepted {item.code} · {rupees(item.totals?.total)}</strong><small>Convert it into a booking{item.validUntil && new Date(item.validUntil) > new Date() ? ` while the room hold lasts (${countdown(item.validUntil)})` : ''}.</small></div><button type="button" className="sd-btn small" onClick={() => onOpenQuote(item._id)}>Review</button></li>)}
        {quotes.expiringSoon.map(item => <li key={item._id} className="medium"><Icon name="fa-hourglass-half" /><div><strong>{item.code} for {item.guest?.name} expires {relativeTime(item.validUntil)}</strong><small>{item.status === 'viewed' ? 'The guest has opened it — a quick call can close it.' : 'Not opened yet — resend or call the guest.'}</small></div><button type="button" className="sd-btn ghost small" onClick={() => onOpenQuote(item._id)}>Open</button></li>)}
      </ul>}
    </section>

    <div className="sd-columns">
      <section className="sd-card">
        <div className="sd-card-head">
          <div><h3>Conversion funnel</h3><p>Inquiries received in the last {days} days and how far they got.</p></div>
          <label className="sd-inline-field"><span className="sr-only">Period</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
        </div>
        {funnel.total === 0 ? <EmptyState icon="fa-filter" title="No inquiries in this period">Record inquiries from calls, WhatsApp and walk-ins to see where leads drop off.</EmptyState> : <>
          <table className="sd-funnel">
            <caption className="sr-only">Inquiries reaching each stage</caption>
            <thead className="sr-only"><tr><th>Stage</th><th>Inquiries</th><th>Share of all inquiries</th></tr></thead>
            <tbody>{steps.map((step, index) => <tr key={step.key} className={biggestDrop?.index === index ? 'drop' : ''}>
              <th scope="row">{step.label}</th>
              <td className="sd-funnel-bar"><span className="sd-bar-track"><span className="sd-bar" style={{ width: `${Math.max(step.value ? 2 : 0, percent(step.value, steps[0].value))}%` }} title={`${step.label}: ${step.value} (${percent(step.value, steps[0].value)}% of inquiries)`}></span></span></td>
              <td className="sd-num">{step.value}<small>{percent(step.value, steps[0].value)}%</small></td>
            </tr>)}</tbody>
          </table>
          {biggestDrop && <p className="sd-callout"><Icon name="fa-arrow-trend-down" /> Biggest drop-off: <strong>{steps[biggestDrop.index - 1].label} → {steps[biggestDrop.index].label}</strong>, {biggestDrop.lost} lead{biggestDrop.lost === 1 ? '' : 's'} ({biggestDrop.rate}%).</p>}
          {funnel.lost > 0 && <p className="sd-muted">{funnel.lost} marked lost in this period.</p>}
        </>}
      </section>

      <section className="sd-card">
        <div className="sd-card-head"><div><h3>Where bookings come from</h3><p>Inquiries and bookings by source, last {days} days.</p></div></div>
        {summary.sources.length === 0 ? <EmptyState icon="fa-signs-post" title="No sources yet" /> : <table className="sd-table compact">
          <thead><tr><th scope="col">Source</th><th scope="col" className="sd-num">Inquiries</th><th scope="col" className="sd-num">Booked</th><th scope="col">Conversion</th></tr></thead>
          <tbody>{summary.sources.map(row => <tr key={row.source}>
            <th scope="row"><Icon name={SOURCES[row.source]?.icon || 'fa-circle'} /> {SOURCES[row.source]?.label || row.source}</th>
            <td className="sd-num">{row.count}</td><td className="sd-num">{row.booked}</td>
            <td><span className="sd-meter" title={`${percent(row.booked, row.count)}% converted`}><span style={{ width: `${percent(row.booked, row.count)}%` }}></span></span> {percent(row.booked, row.count)}%</td>
          </tr>)}</tbody>
        </table>}
        {summary.lostReasons.length > 0 && <>
          <h4 className="sd-subhead">Why leads were lost</h4>
          <ul className="sd-plain-list">{summary.lostReasons.map(row => <li key={row.reason}><span>{LOST_REASONS[row.reason] || row.reason}</span><strong>{row.count}</strong></li>)}</ul>
        </>}
      </section>
    </div>
  </div>;
}
