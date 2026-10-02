import { useState } from 'react';
import { api } from '../../lib/api';
import { localDateIso } from '../../lib/format';
import { SOURCES, STAFF_ROLES } from './salesConfig';
import { Alert, Labelled, Modal } from './ui';

const blank = { guestName: '', guestPhone: '', guestEmail: '', source: 'phone', sourceDetail: '', propertyId: '', checkIn: '', checkOut: '', flexibleDates: false, adults: 2, children: 0, infants: 0, pets: 0, budgetMin: '', budgetMax: '', requirements: '', message: '', priority: 'normal', assignedTo: '', marketingConsent: false };

function fromInquiry(inquiry) {
  if (!inquiry) return blank;
  return {
    ...blank, ...inquiry,
    propertyId: inquiry.property?._id || inquiry.property || '',
    assignedTo: inquiry.assignedTo?._id || inquiry.assignedTo || '',
    checkIn: inquiry.checkIn || '', checkOut: inquiry.checkOut || '',
    budgetMin: inquiry.budgetMin ?? '', budgetMax: inquiry.budgetMax ?? '',
    requirements: (inquiry.requirements || []).join(', ')
  };
}

export default function LeadForm({ meta, inquiry, onClose, onSaved, onOpenExisting }) {
  const editing = Boolean(inquiry);
  const [form, setForm] = useState(() => fromInquiry(inquiry));
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event, allowDuplicate = false) {
    event?.preventDefault();
    setSaving(true); setError('');
    const body = {
      guestName: form.guestName, guestPhone: form.guestPhone, guestEmail: form.guestEmail, source: form.source, sourceDetail: form.sourceDetail,
      propertyId: form.propertyId || null, checkIn: form.checkIn || null, checkOut: form.checkOut || null, flexibleDates: form.flexibleDates,
      adults: Number(form.adults), children: Number(form.children), infants: Number(form.infants), pets: Number(form.pets),
      budgetMin: form.budgetMin === '' ? null : Number(form.budgetMin), budgetMax: form.budgetMax === '' ? null : Number(form.budgetMax),
      requirements: form.requirements.split(',').map(item => item.trim()).filter(Boolean), message: form.message,
      priority: form.priority, assignedTo: form.assignedTo || null, marketingConsent: form.marketingConsent
    };
    try {
      const saved = editing
        ? await api(`/owner-crm/inquiries/${inquiry._id}`, { method: 'PATCH', body: { ...body, expectedRevision: inquiry.revision } })
        : await api('/owner-crm/inquiries', { method: 'POST', body: { ...body, allowDuplicate } });
      onSaved(saved);
    } catch (err) {
      if (err.status === 409 && err.data.duplicateOf) setDuplicate(err.data.duplicateOf);
      setError(err.message);
    } finally { setSaving(false); }
  }

  return <Modal title={editing ? `Edit ${inquiry.code}` : 'New inquiry'} onClose={onClose} width={760}>
    <form className="sd-form" onSubmit={submit} noValidate>
      <Alert onClose={() => { setError(''); setDuplicate(null); }}>{error}</Alert>
      {duplicate && <div className="sd-inline-actions">
        <button type="button" className="sd-btn small" onClick={() => onOpenExisting(duplicate._id)}>Open {duplicate.code}</button>
        <button type="button" className="sd-btn ghost small" onClick={() => submit(null, true)} disabled={saving}>Create a separate inquiry</button>
      </div>}

      <fieldset>
        <legend>Guest</legend>
        <div className="sd-grid three">
          <Labelled label="Full name *"><input required maxLength="100" value={form.guestName} onChange={event => set('guestName', event.target.value)} autoComplete="off" /></Labelled>
          <Labelled label="Phone" hint="Phone or email is required"><input type="tel" maxLength="20" value={form.guestPhone} onChange={event => set('guestPhone', event.target.value)} placeholder="+91 98765 43210" /></Labelled>
          <Labelled label="Email"><input type="email" maxLength="120" value={form.guestEmail} onChange={event => set('guestEmail', event.target.value)} /></Labelled>
        </div>
      </fieldset>

      <fieldset>
        <legend>Inquiry</legend>
        <div className="sd-grid three">
          <Labelled label="Source *"><select value={form.source} onChange={event => set('source', event.target.value)}>{Object.entries(SOURCES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></Labelled>
          <Labelled label="Source detail" hint="Agent name, referral, campaign…"><input maxLength="120" value={form.sourceDetail} onChange={event => set('sourceDetail', event.target.value)} /></Labelled>
          <Labelled label="Property of interest"><select value={form.propertyId} onChange={event => set('propertyId', event.target.value)}><option value="">Not decided</option>{meta?.properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Labelled>
        </div>
        <div className="sd-grid four">
          <Labelled label="Check-in"><input type="date" min={editing ? undefined : localDateIso()} value={form.checkIn} onChange={event => set('checkIn', event.target.value)} /></Labelled>
          <Labelled label="Check-out"><input type="date" min={form.checkIn || undefined} value={form.checkOut} onChange={event => set('checkOut', event.target.value)} /></Labelled>
          <label className="sd-check"><input type="checkbox" checked={form.flexibleDates} onChange={event => set('flexibleDates', event.target.checked)} /> Dates are flexible</label>
          <Labelled label="Priority"><select value={form.priority} onChange={event => set('priority', event.target.value)}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></Labelled>
        </div>
        <div className="sd-grid four">
          <Labelled label="Adults"><input type="number" min="0" max="50" value={form.adults} onChange={event => set('adults', event.target.value)} /></Labelled>
          <Labelled label="Children"><input type="number" min="0" max="50" value={form.children} onChange={event => set('children', event.target.value)} /></Labelled>
          <Labelled label="Infants"><input type="number" min="0" max="20" value={form.infants} onChange={event => set('infants', event.target.value)} /></Labelled>
          <Labelled label="Pets"><input type="number" min="0" max="10" value={form.pets} onChange={event => set('pets', event.target.value)} /></Labelled>
        </div>
        <div className="sd-grid three">
          <Labelled label="Budget from (₹)"><input type="number" min="0" step="500" value={form.budgetMin} onChange={event => set('budgetMin', event.target.value)} /></Labelled>
          <Labelled label="Budget up to (₹)"><input type="number" min="0" step="500" value={form.budgetMax} onChange={event => set('budgetMax', event.target.value)} /></Labelled>
          <Labelled label="Assign to"><select value={form.assignedTo} onChange={event => set('assignedTo', event.target.value)}><option value="">Unassigned</option>{meta?.staff.map(item => <option key={item._id} value={item._id}>{item.name} · {STAFF_ROLES[item.role] || item.role}</option>)}</select></Labelled>
        </div>
        <Labelled label="Requirements" hint="Comma separated, e.g. private pool, pet friendly, ground floor"><input maxLength="600" value={form.requirements} onChange={event => set('requirements', event.target.value)} /></Labelled>
        <Labelled label="Guest message / notes"><textarea rows="3" maxLength="2000" value={form.message} onChange={event => set('message', event.target.value)} placeholder="What did the guest ask for?" /></Labelled>
        <label className="sd-check"><input type="checkbox" checked={form.marketingConsent} onChange={event => set('marketingConsent', event.target.checked)} /> Guest agreed to receive offers (needed before any marketing message)</label>
      </fieldset>

      <div className="sd-form-actions">
        <button type="button" className="sd-btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="sd-btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create inquiry'}</button>
      </div>
    </form>
  </Modal>;
}
