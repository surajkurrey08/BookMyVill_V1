import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import './OwnerFinance.css';

const today = new Date().toLocaleDateString('sv-SE');
const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const categories = ['housekeeping', 'maintenance', 'supplies', 'utilities', 'staff', 'other'];

export default function OwnerFinance() {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('all');
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [report, setReport] = useState(null);
  const [expense, setExpense] = useState({ propertyId: '', category: 'supplies', incurredOn: today, amount: '', description: '' });
  const [manual, setManual] = useState({ bookingId: '', method: 'cash', reference: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/owner-finance${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'x-auth-token': token, ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.msg || 'Financial request failed.');
    return body;
  }, []);

  const query = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&propertyId=${encodeURIComponent(propertyId)}`;
  const loadReport = useCallback(async () => {
    setLoading(true);
    try { setReport(await request(`/summary?${query}`)); setError(''); }
    catch (err) { setReport(null); setError(err.message); }
    finally { setLoading(false); }
  }, [query, request]);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    fetch(`${API_BASE_URL}/owner-pms/properties`, { headers: { 'x-auth-token': token } })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.msg || 'Could not load properties.'); return body; })
      .then(list => { setProperties(list); setExpense(current => ({ ...current, propertyId: list[0]?._id || '' })); })
      .catch(err => setError(err.message));
  }, []);
  useEffect(() => { loadReport(); }, [loadReport]);

  async function perform(action, success) {
    setBusy(true); setMessage(''); setError('');
    try { await action(); setMessage(success); await loadReport(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function saveExpense(event) {
    event.preventDefault();
    perform(async () => {
      await request('/expenses', { method: 'POST', body: JSON.stringify({ ...expense, amount: Number(expense.amount) }) });
      setExpense(current => ({ ...current, amount: '', description: '' }));
    }, 'Expense recorded.');
  }

  function saveManual(event) {
    event.preventDefault();
    const booking = report?.bookings.find(item => item._id === manual.bookingId);
    if (!booking) { setError('Choose a pending booking.'); return; }
    perform(async () => {
      await request(`/bookings/${booking._id}/manual-payment`, { method: 'POST', body: JSON.stringify({ amount: booking.totalPrice, method: manual.method, reference: manual.reference.trim() }) });
      setManual({ bookingId: '', method: 'cash', reference: '' });
    }, 'Owner-recorded payment saved.');
  }

  async function exportCsv() {
    setBusy(true); setError('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/owner-finance/report.csv?${query}`, { headers: { 'x-auth-token': token } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.msg || 'Could not export report.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `owner-finance-${start}-to-${end}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const pendingManual = report?.bookings.filter(item => item.paymentStatus === 'pending' && !item.razorpayOrderId && item.status !== 'cancelled') || [];
  const refundReview = report?.bookings.filter(item => item.status === 'cancelled' && item.paymentStatus === 'paid' && ['live', 'manual'].includes(item.paymentMode) && item.refundStatus !== 'processed') || [];
  const maxMonth = Math.max(1, ...(report?.monthly || []).map(item => item.liveCaptured + item.manualRecorded));

  return <div className="fin-panel">
    <div className="fin-heading"><div><h2>Payments & Reports</h2><p>Captured gateway payments, owner-recorded collections, and logged expenses. Payouts and fees are not tracked here.</p></div><button type="button" onClick={exportCsv} disabled={busy || !report}>Export CSV</button></div>
    <div className="fin-filters"><label>Property<select value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="all">All my properties</option>{properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label>Through<input type="date" min={start} value={end} onChange={event => setEnd(event.target.value)} /></label></div>
    {error && <div className="fin-alert fin-error" role="alert">{error}</div>}
    {message && <div className="fin-alert fin-success" role="status">{message}</div>}
    {loading && <p className="fin-muted">Loading financial records…</p>}
    {report && <>
      <div className="fin-kpis"><div><span>Captured live payments</span><strong>{rupees(report.totals.liveCaptured)}</strong></div><div><span>Owner-recorded payments</span><strong>{rupees(report.totals.manualRecorded)}</strong></div><div><span>Logged expenses</span><strong>{rupees(report.totals.activeExpenses)}</strong></div><div><span>Pending booking value</span><strong>{rupees(report.totals.pendingValue)}</strong></div></div>
      {(report.totals.testCaptured > 0 || report.totals.legacyUnverified > 0 || report.totals.refundReviewCount > 0) && <div className="fin-note"><strong>Separate from live collections:</strong> Test payments {rupees(report.totals.testCaptured)} · Legacy payments without verification {rupees(report.totals.legacyUnverified)} · Cancelled paid bookings needing refund review {report.totals.refundReviewCount}.</div>}
      <div className="fin-columns"><section className="fin-card"><h3>Monthly collections</h3><p>Payment capture date; test payments are excluded from bars.</p>{report.monthly.length === 0 ? <p className="fin-muted">No captured payments in this period.</p> : <div className="fin-months">{report.monthly.map(item => <div className="fin-month" key={item.month}><span>{item.month}</span><div className="fin-track"><div style={{ width: `${(item.liveCaptured + item.manualRecorded) / maxMonth * 100}%` }} /></div><strong>{rupees(item.liveCaptured + item.manualRecorded)}</strong></div>)}</div>}</section><section className="fin-card"><h3>By property</h3>{report.byProperty.length === 0 ? <p className="fin-muted">No saved properties.</p> : <div className="fin-property-list">{report.byProperty.map(item => <div key={item.propertyId}><strong>{item.name}</strong><span>Live {rupees(item.liveCaptured)} · Manual {rupees(item.manualRecorded)}</span><small>Expenses {rupees(item.expenses)} · {item.pendingBookings} pending</small></div>)}</div>}</section></div>
      <div className="fin-columns"><section className="fin-card"><h3>Record an offline payment</h3><p>Use only after receiving the full amount directly. This is recorded by the owner, not verified by Razorpay.</p><form className="fin-form" onSubmit={saveManual}><label>Pending booking<select required value={manual.bookingId} onChange={event => setManual({ ...manual, bookingId: event.target.value })}><option value="">Choose booking</option>{pendingManual.map(item => <option key={item._id} value={item._id}>{item.user?.name || 'Guest'} · {item.propertyName} · {rupees(item.totalPrice)}</option>)}</select></label><label>Method<select value={manual.method} onChange={event => setManual({ ...manual, method: event.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option></select></label><label>Payment reference {manual.method === 'cash' ? '(optional)' : ''}<input required={manual.method !== 'cash'} maxLength="80" value={manual.reference} onChange={event => setManual({ ...manual, reference: event.target.value })} placeholder={manual.method === 'cash' ? 'Receipt number' : 'Bank / UPI transaction ID'} /></label><button disabled={busy || !pendingManual.length}>Record full payment</button></form></section>
      <section className="fin-card"><h3>Log an expense</h3><p>Expenses are bookkeeping entries. Corrections are voided with a reason.</p><form className="fin-form" onSubmit={saveExpense}><label>Property<select required value={expense.propertyId} onChange={event => setExpense({ ...expense, propertyId: event.target.value })}><option value="">Choose property</option>{properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>Category<select value={expense.category} onChange={event => setExpense({ ...expense, category: event.target.value })}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>Date<input required type="date" value={expense.incurredOn} onChange={event => setExpense({ ...expense, incurredOn: event.target.value })} /></label><label>Amount (₹)<input required min="1" step="1" type="number" value={expense.amount} onChange={event => setExpense({ ...expense, amount: event.target.value })} /></label><label>Description<input required maxLength="200" value={expense.description} onChange={event => setExpense({ ...expense, description: event.target.value })} /></label><button disabled={busy || !properties.length}>Add expense</button></form></section></div>
      {refundReview.length > 0 && <section className="fin-card"><h3>Refund review</h3><p>These paid bookings are cancelled. Check the payment provider or manual records before telling guests a refund was sent.</p><div className="fin-list">{refundReview.map(item => <div key={item._id}><strong>{item.user?.name || 'Guest'} · {item.propertyName}</strong><span>{rupees(item.totalPrice)} · {item.paymentMode === 'manual' ? 'Owner-recorded' : 'Gateway live'}</span></div>)}</div></section>}
      <section className="fin-card"><h3>Payment records</h3><div className="fin-table-wrap"><table><thead><tr><th>Booking</th><th>Property</th><th>Amount</th><th>Classification</th><th>Status</th><th>Paid on</th></tr></thead><tbody>{report.bookings.map(item => <tr key={item._id}><td>{item.user?.name || 'Guest'}<small>{item._id}</small></td><td>{item.propertyName}</td><td>{rupees(item.totalPrice)}</td><td>{item.verification.replaceAll('_', ' ')}</td><td>{item.status} · {item.paymentStatus}</td><td>{item.paidAt ? localDate(new Date(item.paidAt)) : '—'}</td></tr>)}</tbody></table></div>{report.bookings.length === 0 && <p className="fin-muted">No booking records in this period.</p>}</section>
      <section className="fin-card"><h3>Expense records</h3><div className="fin-list">{report.expenses.map(item => <div key={item._id}><div><strong>{item.category} · {rupees(item.amount)}</strong><small>{item.incurredOn} · {item.description} · {item.status}</small></div>{item.status === 'active' && <button className="fin-secondary" type="button" disabled={busy} onClick={() => { const reason = window.prompt('Reason for voiding this expense?'); if (reason?.trim()) perform(() => request(`/expenses/${item._id}/void`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }), 'Expense voided.'); }}>Void</button>}</div>)}</div>{report.expenses.length === 0 && <p className="fin-muted">No expenses in this period.</p>}</section>
    </>}
  </div>;
}
