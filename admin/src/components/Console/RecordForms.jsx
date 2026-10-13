import { useRef, useState } from 'react';
import { adminApi } from './api';
import { Alert, Icon } from './ui';

// Edit forms for an owner's contact details and a property's details, shown
// inside the owner/property drawers. The backend applies the same rules as the
// Villa Manager panel (services/villaRecords).

const blank = value => value === null || value === undefined ? '' : String(value);

function Input({ label, hint, ...props }) {
  return <label className="ac-field"><span>{label}{props.required ? ' *' : ''}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}

function FormActions({ busy, onCancel, label }) {
  return <div className="ac-drawer-actions"><button type="button" className="ac-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="ac-btn primary" disabled={busy}>{busy ? 'Saving…' : label}</button></div>;
}

// ------------------------------------------------------------------ owner

export function EditOwnerForm({ owner, onCancel, onSaved }) {
  const p = owner.ownerProfile || {};
  const [form, setForm] = useState({ name: owner.name || '', email: owner.email || '', phone: owner.phone || '', whatsapp: p.whatsapp || '', address: p.address || '', alternateName: p.alternateName || '', alternatePhone: p.alternatePhone || '', notes: p.notes || '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await adminApi(`/owners/${owner._id}`, { method: 'PATCH', body: form }); onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="ac-stack" onSubmit={submit}>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <div className="ac-form-grid">
      <Input label="Owner name" required minLength={2} maxLength={100} value={form.name} onChange={set('name')} />
      <Input label="Mobile number" type="tel" required maxLength={20} value={form.phone} onChange={set('phone')} />
      <Input label="Email" type="email" required={Boolean(owner.email)} maxLength={120} value={form.email} onChange={set('email')} hint={owner.email ? 'Used to sign in to the Owner panel.' : 'Optional.'} />
      <Input label="WhatsApp number" type="tel" maxLength={20} value={form.whatsapp} onChange={set('whatsapp')} />
      <Input label="Alternate contact name" maxLength={100} value={form.alternateName} onChange={set('alternateName')} />
      <Input label="Alternate contact number" type="tel" maxLength={20} value={form.alternatePhone} onChange={set('alternatePhone')} />
    </div>
    <Input label="Address" maxLength={300} value={form.address} onChange={set('address')} />
    <label className="ac-field"><span>Notes</span><textarea rows="3" maxLength={1000} value={form.notes} onChange={set('notes')} /></label>
    <FormActions busy={busy} onCancel={onCancel} label="Save owner" />
  </form>;
}

// ------------------------------------------------------------------ map pin

const embed = ({ lat, lng }) => `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

// Paste a Google Maps link, coordinates or address -> preview -> confirm.
function MapLocationField({ value, onChange }) {
  const [input, setInput] = useState(value.mapLink || '');
  const [preview, setPreview] = useState(value.coordinates ? { coordinates: value.coordinates } : null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const confirmed = Boolean(value.coordinates);
  async function find(text) {
    const query = text.trim(); if (!query) return;
    const request = ++latest.current;
    setBusy(true); setError(''); setPreview(null); onChange({ coordinates: null, mapLink: '', pending: true });
    try { const result = await adminApi('/map-location', { method: 'POST', body: { input: query } }); if (request === latest.current) setPreview(result); }
    catch (err) { if (request === latest.current) setError(err.message); }
    finally { if (request === latest.current) setBusy(false); }
  }
  function edit(text) { latest.current++; setBusy(false); setInput(text); setPreview(null); setError(''); onChange({ coordinates: null, mapLink: '', pending: Boolean(text.trim()) }); }
  return <div className="ac-map-field">
    <label className="ac-field"><span>Location on Google Maps</span>
      <div className="ac-map-row">
        <input value={input} maxLength={2048} placeholder="Paste a Google Maps link, coordinates or address" onChange={e => edit(e.target.value)}
          onPaste={e => { const text = e.clipboardData.getData('text').trim(); if (text) { e.preventDefault(); edit(text); find(text); } }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(input); } }} />
        <button type="button" className="ac-btn ghost" disabled={busy || !input.trim()} onClick={() => find(input)}>{busy ? 'Finding…' : 'Find'}</button>
      </div>
      {!preview && !error && <small>{input && !confirmed ? 'Press Find to pin this link on the map.' : 'Google Maps → Share → Copy link, or right-click the pin and copy the coordinates.'}</small>}
    </label>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    {preview && <div className="ac-map-preview">
      <iframe title="Property location preview" src={embed(preview.coordinates)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <div className="ac-map-bar">
        <span><strong>{preview.name || preview.address || 'Pinned location'}</strong><small>{preview.coordinates.lat.toFixed(6)}, {preview.coordinates.lng.toFixed(6)}</small></span>
        {confirmed ? <span className="ac-tag"><Icon name="fa-circle-check" /> Confirmed</span>
          : <button type="button" className="ac-btn primary" onClick={() => onChange({ coordinates: preview.coordinates, mapLink: preview.mapLink, address: preview.address || '', pending: false })}>Confirm location</button>}
        <button type="button" className="ac-btn ghost" onClick={() => edit('')}>{confirmed ? 'Change' : 'Clear'}</button>
      </div>
    </div>}
  </div>;
}

// ------------------------------------------------------------------ property

const ENTIRE_TYPES = ['Villa', 'Cottage', 'Homestay', 'Apartment'];

export function EditPropertyForm({ property: p, unit, onCancel, onSaved }) {
  const d = p.listingData?.details || {}, stay = p.stayInfo || {}, hand = p.handover || {};
  const [form, setForm] = useState({
    name: p.name || '', type: p.type || 'Villa', location: p.location || '', address: d.address || '', description: d.description || '',
    mapLink: p.mapLink || '', coordinates: p.coordinates || null, mapPending: false,
    maxGuests: blank(unit?.capacity ?? d.guestCapacity), bedrooms: blank(d.bedrooms), bathrooms: blank(d.bathrooms),
    price: blank(unit?.baseRate ?? p.price), extraGuestRate: blank(unit?.extraGuestRate),
    checkInTime: stay.checkInTime || '', checkOutTime: stay.checkOutTime || '', wifiName: stay.wifiName || '', wifiPassword: stay.wifiPassword || '',
    keyLocation: hand.keyLocation || '', caretakerName: hand.caretakerName || '', caretakerPhone: hand.caretakerPhone || '', handoverNotes: hand.notes || ''
  });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const types = p.bookingMode === 'ENTIRE' ? ENTIRE_TYPES : [...ENTIRE_TYPES, 'Hotel', 'Resort'];
  async function submit(e) {
    e.preventDefault();
    if (form.mapPending) { setError('Confirm the location on the map (or clear it) before saving.'); return; }
    setBusy(true); setError('');
    try { await adminApi(`/properties/${p._id}/details`, { method: 'PUT', body: form }); onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="ac-stack" onSubmit={submit}>
    {error && <Alert onClose={() => setError('')}>{error}</Alert>}
    <fieldset className="ac-fieldset"><legend>Property</legend>
      <div className="ac-form-grid">
        <Input label="Name" required maxLength={120} value={form.name} onChange={set('name')} />
        <label className="ac-field"><span>Type</span><select value={form.type} onChange={set('type')}>{types.map(t => <option key={t}>{t}</option>)}</select></label>
        <Input label="Location" required maxLength={120} value={form.location} onChange={set('location')} hint="Town or area shown to guests." />
        <Input label="Full address" maxLength={300} value={form.address} onChange={set('address')} hint="Private — not shown on the website." />
      </div>
      <label className="ac-field"><span>Description</span><textarea rows="4" maxLength={3000} value={form.description} onChange={set('description')} /></label>
      <MapLocationField value={form} onChange={loc => setForm(f => ({ ...f, coordinates: loc.coordinates, mapLink: loc.mapLink, mapPending: loc.pending, address: f.address || loc.address || '' }))} />
    </fieldset>
    <fieldset className="ac-fieldset"><legend>{p.bookingMode === 'ENTIRE' ? 'Booking — the whole villa is booked together' : 'Capacity & rate'}</legend>
      <div className="ac-form-grid">
        <Input label="Max guests" type="number" required min="1" max="50" value={form.maxGuests} onChange={set('maxGuests')} />
        <Input label="Price per night (₹)" type="number" required min="1" step="1" value={form.price} onChange={set('price')} />
        <Input label="Bedrooms" type="number" min="0" max="50" value={form.bedrooms} onChange={set('bedrooms')} />
        <Input label="Bathrooms" type="number" min="0" max="50" value={form.bathrooms} onChange={set('bathrooms')} />
        <Input label="Extra guest charge (₹ / night)" type="number" min="0" step="1" value={form.extraGuestRate} onChange={set('extraGuestRate')} />
        <Input label="Check-in time" maxLength={40} value={form.checkInTime} onChange={set('checkInTime')} />
        <Input label="Check-out time" maxLength={40} value={form.checkOutTime} onChange={set('checkOutTime')} />
      </div>
    </fieldset>
    <fieldset className="ac-fieldset"><legend>Handover (team only)</legend>
      <div className="ac-form-grid">
        <Input label="Keys kept with / gate code" maxLength={200} value={form.keyLocation} onChange={set('keyLocation')} />
        <Input label="Caretaker name" maxLength={100} value={form.caretakerName} onChange={set('caretakerName')} />
        <Input label="Caretaker phone" type="tel" maxLength={20} value={form.caretakerPhone} onChange={set('caretakerPhone')} />
        <Input label="Wi-Fi name" maxLength={60} value={form.wifiName} onChange={set('wifiName')} />
        <Input label="Wi-Fi password" maxLength={60} value={form.wifiPassword} onChange={set('wifiPassword')} />
      </div>
      <label className="ac-field"><span>Handover notes</span><textarea rows="3" maxLength={1000} value={form.handoverNotes} onChange={set('handoverNotes')} /></label>
    </fieldset>
    <FormActions busy={busy} onCancel={onCancel} label="Save property" />
  </form>;
}
