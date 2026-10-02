import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { rupees } from '../../lib/format';
import { Icon } from './ui';
import './Sales.css';

// Compact sales strip for the dashboard overview. It stays silent on failure
// so the rest of the overview always renders.
export default function SalesSnapshot({ onOpen }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api('/owner-crm/summary?days=30').then(data => { if (!cancelled) setSummary(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!summary) return null;
  const { followUps, quotes } = summary;
  const items = [
    { label: 'New inquiries today', value: summary.newToday, note: summary.staleNew ? `${summary.staleNew} waiting over 1 h` : `${summary.byStatus.new} awaiting reply`, alert: summary.staleNew > 0, icon: 'fa-inbox' },
    { label: 'Follow-ups due', value: followUps.overdue + followUps.dueToday, note: followUps.overdue ? `${followUps.overdue} overdue` : 'On track', alert: followUps.overdue > 0, icon: 'fa-bell' },
    { label: 'Quotes with guests', value: quotes.awaiting, note: rupees(quotes.awaitingValue), icon: 'fa-file-invoice' },
    { label: 'Accepted, to convert', value: quotes.accepted, note: rupees(quotes.acceptedValue), icon: 'fa-handshake' }
  ];
  return <section className="sd-snapshot" aria-label="Sales today">
    {items.map(item => <button key={item.label} type="button" className={`sd-snapshot-item ${item.alert ? 'alert' : ''}`} onClick={onOpen}>
      <Icon name={item.icon} />
      <span><small>{item.label}</small><strong>{item.value}</strong><em>{item.alert && <Icon name="fa-triangle-exclamation" />} {item.note}</em></span>
    </button>)}
  </section>;
}
