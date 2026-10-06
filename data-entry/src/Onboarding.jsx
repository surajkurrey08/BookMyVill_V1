import { useCallback, useEffect, useState } from 'react';
import { request } from './api';
import { Alert, Empty, Field, Icon, Loading, titleCase } from './ui';
import './onboarding.css';

// Data Entry onboarding: add owners (self-managed or managed by BookMyVilla)
// with their villas and photos, and keep local guides per location. Villas are
// always booked whole; they go to Admin for approval before the website.
const base = '/properties/data-entry/onboarding';
const api = {
  owners: q => request(`${base}/owners?${new URLSearchParams({ q })}`),
  managers: () => request(`${base}/villa-managers`),
  createOwner: body => request(`${base}/owners`, { method: 'POST', body }),
  addVilla: (id, body) => request(`${base}/owners/${id}/villas`, { method: 'POST', body }),
  areas: () => request(`${base}/guide-areas`),
  createArea: body => request(`${base}/guide-areas`, { method: 'POST', body }),
  updateArea: (id, body) => request(`${base}/guide-areas/${id}`, { method: 'PATCH', body }),
  guides: () => request(`${base}/guides`),
  createGuide: body => request(`${base}/guides`, { method: 'POST', body }),
  updateGuide: (id, body) => request(`${base}/guides/${id}`, { method: 'PATCH', body })
};

function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    loader().then(data => setState({ data, error: '', loading: false })).catch(err => setState({ data: null, error: err.message, loading: false }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

const WEBSITE = { live: 'On website', hidden: 'Hidden', pending_approval: 'Waiting for Admin approval', under_review: 'Changes requested', rejected: 'Rejected', suspended: 'Suspended' };

// ---------------------------------------------------------------- Photos

const MAX_PHOTOS = 20;
function shrink(file) {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { reject(new Error(`${file.name}: choose a JPG, PNG or WebP image.`)); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}.`)); };
    img.src = url;
  });
}

function PhotoPicker({ photos, onChange }) {
  const [link, setLink] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  function addLink() {
    const value = link.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) { setError('Paste a full image link starting with http:// or https://'); return; }
    if (photos.includes(value)) { setError('This photo is already added.'); return; }
    if (photos.length >= MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos per villa.`); return; }
    onChange([...photos, value]); setLink(''); setError('');
  }
  async function upload(e) {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos — you can add ${MAX_PHOTOS - photos.length} more.`); return; }
    setBusy(true); setError('');
    try { onChange([...photos, ...await Promise.all(files.map(shrink))]); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="ob-photos">
    <div className="ob-photo-add">
      <div className="field"><label>Paste image link</label><div className="ob-link-row"><input type="url" placeholder="https://…/villa.jpg" value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} /><button type="button" className="button" onClick={addLink}>Add link</button></div></div>
      <label className={`ob-upload ${busy ? 'busy' : ''}`}><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={upload} disabled={busy} /><Icon name="media" /><strong>{busy ? 'Preparing photos…' : 'Upload from device'}</strong><small>JPG, PNG or WebP · resized automatically</small></label>
    </div>
    <Alert>{error}</Alert>
    {photos.length ? <ul className="ob-photo-grid">{photos.map((src, i) => <li key={`${i}-${src.length}`}>
      <img src={src} alt={`Villa photo ${i + 1}`} />
      {i === 0 ? <span className="ob-cover">Cover</span> : <button type="button" className="ob-cover-btn" onClick={() => onChange([photos[i], ...photos.filter((_, j) => j !== i)])}>Make cover</button>}
      <button type="button" className="ob-remove" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(photos.filter((_, j) => j !== i))}><Icon name="close" /></button>
    </li>)}</ul> : <p className="muted">No photos yet. The first photo becomes the cover on the website.</p>}
    <small>{photos.length} / {MAX_PHOTOS} photos</small>
  </div>;
}

// ---------------------------------------------------------------- Owner + villa forms

const EMPTY_OWNER = { name: '', phone: '', whatsapp: '', email: '', address: '', alternateName: '', alternatePhone: '', notes: '' };
const EMPTY_VILLA = { name: '', type: 'Villa', location: '', address: '', mapLink: '', description: '', amenities: '', maxGuests: '', bedrooms: '', bathrooms: '', price: '', extraGuestRate: '', checkInTime: '1:00 PM', checkOutTime: '11:00 AM', photos: [], wifiName: '', wifiPassword: '', keyLocation: '', caretakerName: '', caretakerPhone: '', handoverNotes: '' };

function Input({ label, required, value, onChange, hint, ...props }) {
  return <Field label={label} required={required} hint={hint}><input required={required} value={value} onChange={e => onChange(e.target.value)} {...props} /></Field>;
}
function Area({ label, value, onChange, hint, ...props }) {
  return <Field label={label} hint={hint}><textarea rows={3} value={value} onChange={e => onChange(e.target.value)} {...props} /></Field>;
}

function VillaFields({ villa, set, managed }) {
  const f = key => value => set(v => ({ ...v, [key]: value }));
  return <>
    <fieldset className="ob-section"><legend>Villa</legend><div className="form-grid">
      <Input label="Villa name" required maxLength={120} value={villa.name} onChange={f('name')} />
      <Field label="Type"><select value={villa.type} onChange={e => f('type')(e.target.value)}>{['Villa', 'Cottage', 'Homestay', 'Apartment'].map(t => <option key={t}>{t}</option>)}</select></Field>
      <Input label="Location" required maxLength={120} placeholder="Mahabaleshwar" value={villa.location} onChange={f('location')} hint="Town or area. Local guides are matched by this name." />
      <Input label="Google Maps link" type="url" maxLength={500} placeholder="https://maps.google.com/…" value={villa.mapLink} onChange={f('mapLink')} />
      <Input label="Full address" maxLength={300} value={villa.address} onChange={f('address')} hint="Private — never shown on the website." />
      <Input label="Amenities" maxLength={1500} placeholder="Pool, Wi-Fi, Parking, Kitchen" value={villa.amenities} onChange={f('amenities')} hint="Separate with commas." />
    </div><Area label="Description" maxLength={3000} placeholder="What makes this villa special — views, rooms, nearby places…" value={villa.description} onChange={f('description')} /></fieldset>
    <fieldset className="ob-section"><legend>Photos</legend><PhotoPicker photos={villa.photos} onChange={photos => set(v => ({ ...v, photos }))} /></fieldset>
    <fieldset className="ob-section"><legend>Booking — guests always book the whole villa</legend><div className="form-grid">
      <Input label="Max guests" required type="number" min="1" max="50" value={villa.maxGuests} onChange={f('maxGuests')} />
      <Input label="Price per night (₹, whole villa)" required type="number" min="1" step="1" value={villa.price} onChange={f('price')} />
      <Input label="Bedrooms" type="number" min="0" max="50" value={villa.bedrooms} onChange={f('bedrooms')} />
      <Input label="Bathrooms" type="number" min="0" max="50" value={villa.bathrooms} onChange={f('bathrooms')} />
      <Input label="Extra guest charge (₹ / night)" type="number" min="0" step="1" value={villa.extraGuestRate} onChange={f('extraGuestRate')} />
      <Input label="Check-in time" maxLength={40} value={villa.checkInTime} onChange={f('checkInTime')} />
      <Input label="Check-out time" maxLength={40} value={villa.checkOutTime} onChange={f('checkOutTime')} />
    </div></fieldset>
    {managed && <fieldset className="ob-section"><legend>Handover for the Villa Manager team</legend><div className="form-grid">
      <Input label="Keys kept with / gate code" maxLength={200} value={villa.keyLocation} onChange={f('keyLocation')} />
      <Input label="Caretaker name" maxLength={100} value={villa.caretakerName} onChange={f('caretakerName')} />
      <Input label="Caretaker phone" type="tel" maxLength={20} value={villa.caretakerPhone} onChange={f('caretakerPhone')} hint="Guests see this only after they book." />
      <Input label="Wi-Fi name" maxLength={60} value={villa.wifiName} onChange={f('wifiName')} />
      <Input label="Wi-Fi password" maxLength={60} value={villa.wifiPassword} onChange={f('wifiPassword')} />
    </div><Area label="Handover notes" maxLength={1000} placeholder="Meters, water tank, local plumber/electrician…" value={villa.handoverNotes} onChange={f('handoverNotes')} /></fieldset>}
  </>;
}

function ManagerSelect({ value, onChange }) {
  const managers = useLoad(api.managers, []);
  return <Field label="Villa Manager" required hint={managers.error || (managers.data?.length === 0 ? 'No active Villa Managers — ask Admin to create one.' : 'This manager will see the villa in their panel right away.')}>
    <select required value={value} onChange={e => onChange(e.target.value)} disabled={!managers.data}>
      <option value="">{managers.data ? 'Choose a Villa Manager' : 'Loading…'}</option>
      {managers.data?.map(m => <option key={m._id} value={m._id}>{m.name}{m.email ? ` — ${m.email}` : ''}</option>)}
    </select>
  </Field>;
}

function AddOwnerForm({ onDone, onCancel }) {
  const [mode, setMode] = useState('BOOKMYVILLA_MANAGED');
  const [owner, setOwner] = useState(EMPTY_OWNER); const [villa, setVilla] = useState(EMPTY_VILLA); const [manager, setManager] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const managed = mode === 'BOOKMYVILLA_MANAGED';
  const f = key => value => setOwner(o => ({ ...o, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { onDone(await api.createOwner({ managementMode: mode, owner, villa, ...(managed && { villaManager: manager }) })); }
    catch (err) { setError(err.message); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    finally { setBusy(false); }
  }
  return <form className="ob-form" onSubmit={submit}>
    <Alert>{error}</Alert>
    <fieldset className="ob-section"><legend>Who runs this owner's villas?</legend><div className="ob-modes">
      {[['BOOKMYVILLA_MANAGED', 'Managed by BookMyVilla', 'Our Villa Manager team runs the villa. The owner does not sign in.'], ['SELF_MANAGED', 'Self-managed owner', 'The owner runs the villa from the Owner panel. Admin sends them a sign-in setup link.']].map(([value, title, text]) =>
        <label key={value} className={`ob-mode ${mode === value ? 'active' : ''}`}><input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><strong>{title}</strong><small>{text}</small></label>)}
    </div>{managed && <ManagerSelect value={manager} onChange={setManager} />}</fieldset>
    <fieldset className="ob-section"><legend>Owner</legend><div className="form-grid">
      <Input label="Owner name" required maxLength={100} value={owner.name} onChange={f('name')} />
      <Input label="Mobile number" required type="tel" maxLength={20} value={owner.phone} onChange={f('phone')} />
      <Input label={managed ? 'Email (optional)' : 'Email'} required={!managed} type="email" maxLength={120} value={owner.email} onChange={f('email')} hint={managed ? '' : 'The owner signs in to the Owner panel with this email.'} />
      <Input label="WhatsApp number" type="tel" maxLength={20} value={owner.whatsapp} onChange={f('whatsapp')} />
      <Input label="Address" maxLength={300} value={owner.address} onChange={f('address')} />
      <Input label="Alternate contact name" maxLength={100} value={owner.alternateName} onChange={f('alternateName')} />
      <Input label="Alternate contact number" type="tel" maxLength={20} value={owner.alternatePhone} onChange={f('alternatePhone')} />
    </div><Area label="Notes" maxLength={1000} placeholder="e.g. prefers WhatsApp, visits in May" value={owner.notes} onChange={f('notes')} /></fieldset>
    <VillaFields villa={villa} set={setVilla} managed={managed} />
    <div className="ob-actions"><button type="button" className="button ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save owner + villa'}<Icon name="arrow" /></button></div>
  </form>;
}

function AddVillaForm({ owner, onDone, onCancel }) {
  const [villa, setVilla] = useState(EMPTY_VILLA); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const managed = owner.managementMode === 'BOOKMYVILLA_MANAGED';
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.addVilla(owner._id, { villa }); onDone(); } catch (err) { setError(err.message); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  }
  return <form className="ob-form" onSubmit={submit}>
    <Alert>{error}</Alert>
    <p className="muted">{managed ? 'Goes to the same Villa Manager as this owner\'s other villas.' : 'Self-managed: the owner runs it from the Owner panel.'} Admin approves it before it appears on the website.</p>
    <VillaFields villa={villa} set={setVilla} managed={managed} />
    <div className="ob-actions"><button type="button" className="button ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save villa'}<Icon name="arrow" /></button></div>
  </form>;
}

// ---------------------------------------------------------------- Owners page

export function OwnersPage() {
  const [q, setQ] = useState(''); const [view, setView] = useState(null); const [notice, setNotice] = useState('');
  const owners = useLoad(() => api.owners(q), [q]);
  const done = message => { setView(null); setNotice(message); owners.reload(); window.scrollTo({ top: 0 }); };

  if (view === 'add') return <><div className="page-heading"><div><h1>Add owner + villa</h1><p>Fill in what the owner shared. Admin reviews the villa before it goes live.</p></div></div><AddOwnerForm onCancel={() => setView(null)} onDone={r => done(r.owner.managementMode === 'SELF_MANAGED' ? `${r.owner.name} added. Ask Admin to send the Owner panel setup link.` : `${r.owner.name} added. The villa is now in the Villa Manager's panel and waiting for Admin approval.`)} /></>;
  if (view?.owner) return <><div className="page-heading"><div><h1>Add villa for {view.owner.name}</h1></div></div><AddVillaForm owner={view.owner} onCancel={() => setView(null)} onDone={() => done(`New villa added for ${view.owner.name}.`)} /></>;

  return <>
    <div className="page-heading"><div><h1>Owners & villas</h1><p>Owners you added and their villas. Villas are booked whole — no rooms.</p></div><button className="button primary" onClick={() => setView('add')}>Add owner + villa<Icon name="arrow" /></button></div>
    <Alert tone="success">{notice}</Alert>
    <section className="panel">
      <div className="ob-search"><Field label="Search owners"><input type="search" placeholder="Name, mobile or email" value={q} onChange={e => setQ(e.target.value)} /></Field></div>
      {owners.loading && !owners.data ? <Loading /> : owners.error ? <Alert>{owners.error}</Alert> : !owners.data.length ? <Empty title={q ? 'No owners match' : 'No owners yet'}>{q ? 'Try another name or number.' : 'Add the first owner and their villa.'}</Empty>
        : <div className="ob-owner-list">{owners.data.map(o => <article key={o._id} className="ob-owner">
          <header><div><h2>{o.name}</h2><small>{o.phone}{o.email ? ` · ${o.email}` : ''}</small></div><span className={`badge ${o.managementMode === 'BOOKMYVILLA_MANAGED' ? 'good' : ''}`}>{o.managementMode === 'BOOKMYVILLA_MANAGED' ? 'Managed by BookMyVilla' : 'Self-managed'}</span></header>
          {o.managementMode === 'SELF_MANAGED' && !o.ownerLoginReady && <p className="ob-note">Owner panel sign-in not set up yet — ask Admin to send the setup link.</p>}
          <ul>{o.villas.map(v => <li key={v._id}>{v.cover ? <img src={v.cover} alt="" /> : <span className="ob-noimg"><Icon name="media" /></span>}<div><strong>{v.name}</strong><small>{v.location}{v.villaManager ? ` · Villa Manager: ${v.villaManager}` : ''}</small></div><span className={`badge ${v.website === 'live' ? 'good' : ['rejected', 'under_review'].includes(v.website) ? 'warn' : ''}`}>{WEBSITE[v.website] || titleCase(v.website)}</span></li>)}</ul>
          <button className="button compact" onClick={() => setView({ owner: o })}>Add another villa</button>
        </article>)}</div>}
    </section>
  </>;
}

// ---------------------------------------------------------------- Guides page

export function GuidesPage() {
  const areas = useLoad(api.areas, []); const guides = useLoad(api.guides, []);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [area, setArea] = useState({ name: '', dailyRate: '' });
  const [guide, setGuide] = useState({ area: '', name: '', phone: '', languages: '', notes: '' });
  async function act(fn, message) { setBusy(true); setError(''); setNotice(''); try { await fn(); setNotice(message); areas.reload(); guides.reload(); return true; } catch (err) { setError(err.message); return false; } finally { setBusy(false); } }

  return <>
    <div className="page-heading"><div><h1>Local guides</h1><p>Guests never see this list. At checkout they only tick "Add a local guide" at the rate of the villa's location; the Villa Manager assigns one of these guides.</p></div></div>
    <Alert>{error}</Alert><Alert tone="success">{notice}</Alert>
    <section className="panel">
      <div className="panel-heading"><div><h2>Locations & guide rate</h2><p>The per-day price guests pay for a guide in that location. Matched to the villa's location name.</p></div></div>
      <form className="ob-inline" onSubmit={async e => { e.preventDefault(); if (await act(() => api.createArea(area), `${area.name} added.`)) setArea({ name: '', dailyRate: '' }); }}>
        <Input label="Location" required maxLength={80} placeholder="Mahabaleshwar" value={area.name} onChange={v => setArea(a => ({ ...a, name: v }))} />
        <Input label="Guide rate (₹ / day)" required type="number" min="1" step="1" value={area.dailyRate} onChange={v => setArea(a => ({ ...a, dailyRate: v }))} />
        <button className="button primary" disabled={busy}>Add location</button>
      </form>
      {areas.data?.length ? <div className="table-wrap"><table className="ob-table"><thead><tr><th>Location</th><th>Rate / day</th><th>Guides</th><th>Offered at checkout</th><th></th></tr></thead><tbody>{areas.data.map(a => <AreaRow key={a._id} area={a} busy={busy} act={act} />)}</tbody></table></div> : !areas.loading && <p className="muted">No locations yet.</p>}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Guides</h2><p>Only the Villa Manager team sees these contacts until a guide is assigned to a booking.</p></div></div>
      <form className="ob-inline" onSubmit={async e => { e.preventDefault(); if (await act(() => api.createGuide(guide), `${guide.name} added.`)) setGuide({ area: guide.area, name: '', phone: '', languages: '', notes: '' }); }}>
        <Field label="Location" required><select required value={guide.area} onChange={e => setGuide(g => ({ ...g, area: e.target.value }))}><option value="">Choose location</option>{areas.data?.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></Field>
        <Input label="Guide name" required maxLength={100} value={guide.name} onChange={v => setGuide(g => ({ ...g, name: v }))} />
        <Input label="Phone" required type="tel" maxLength={20} value={guide.phone} onChange={v => setGuide(g => ({ ...g, phone: v }))} />
        <Input label="Languages" maxLength={200} placeholder="Marathi, Hindi, English" value={guide.languages} onChange={v => setGuide(g => ({ ...g, languages: v }))} />
        <button className="button primary" disabled={busy || !areas.data?.length}>Add guide</button>
      </form>
      {guides.data?.length ? <div className="table-wrap"><table className="ob-table"><thead><tr><th>Guide</th><th>Location</th><th>Languages</th><th>Status</th><th></th></tr></thead><tbody>{guides.data.map(g => <tr key={g._id}><td><strong>{g.name}</strong><small>{g.phone}</small></td><td>{g.area?.name || '—'}</td><td>{g.languages?.join(', ') || '—'}</td><td><span className={`badge ${g.active ? 'good' : ''}`}>{g.active ? 'Active' : 'Inactive'}</span></td><td><button className="text-button" disabled={busy} onClick={() => act(() => api.updateGuide(g._id, { active: !g.active }), `${g.name} ${g.active ? 'deactivated' : 'activated'}.`)}>{g.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : !guides.loading && <p className="muted">No guides yet.</p>}
    </section>
  </>;
}

function AreaRow({ area, busy, act }) {
  const [rate, setRate] = useState(area.dailyRate);
  return <tr>
    <td><strong>{area.name}</strong></td>
    <td><form className="ob-rate" onSubmit={e => { e.preventDefault(); act(() => api.updateArea(area._id, { dailyRate: rate }), `${area.name} rate updated.`); }}><input type="number" min="1" step="1" aria-label={`${area.name} rate per day`} value={rate} onChange={e => setRate(e.target.value)} />{Number(rate) !== area.dailyRate && <button className="button compact" disabled={busy}>Save</button>}</form></td>
    <td>{area.activeGuides} active / {area.guides}</td>
    <td>{area.active && area.activeGuides > 0 ? <span className="badge good">Yes</span> : <span className="badge">{area.active ? 'Add a guide first' : 'Location off'}</span>}</td>
    <td><button className="text-button" disabled={busy} onClick={() => act(() => api.updateArea(area._id, { active: !area.active }), `${area.name} ${area.active ? 'turned off' : 'turned on'}.`)}>{area.active ? 'Turn off' : 'Turn on'}</button></td>
  </tr>;
}
