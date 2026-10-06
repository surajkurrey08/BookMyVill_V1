import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Result, useData } from './App';
import GuideAssignment from './GuideAssignment';
import { ownerService } from './services/api';
import { Badge, date, Drawer, Empty, Field, Icon, money, Table } from './ui';

// BookMyVilla-managed owners: add owner + villa, see each villa's state right
// now, bookings and history, and switch villas on/off for the website.
export default function Owners() {
  const { id } = useParams();
  return id ? <OwnerDetail key={id} id={id}/> : <OwnerList/>;
}

const NOW = { occupied: 'Guest staying', arriving: 'Arriving today', vacant: 'Vacant' };
const WEBSITE = { live: 'On website', hidden: 'Hidden from website', pending_approval: 'Admin approval pending', under_review: 'Changes requested', rejected: 'Rejected', suspended: 'Suspended' };
function State({ now }) { return <span className={'badge tone-' + now.state}>{NOW[now.state]}</span>; }
function Website({ value }) { return <span className={'badge tone-web-' + value}>{WEBSITE[value] || value}</span>; }
const digits = value => String(value || '').replace(/\D/g, '');
const whatsappHref = value => `https://wa.me/${digits(value).length === 10 ? '91' + digits(value) : digits(value)}`;

function OwnerList() {
  const [q, setQ] = useState(''); const [adding, setAdding] = useState(false); const navigate = useNavigate();
  const state = useData(() => ownerService.list(q), 'owner-directory:' + q);
  return <>
    <div className="page-head"><div><h1>Owners</h1><p>Owners whose villas BookMyVilla manages. Open an owner to see villas, bookings and history.</p></div>
      <div className="actions"><button onClick={state.reload}>Refresh</button><button className="primary" onClick={() => setAdding(true)}>Add owner + villa</button></div></div>
    <section className="panel">
      <div className="filters"><Field label="Search owners" type="search" placeholder="Name or mobile" value={q} onChange={e => setQ(e.target.value)}/></div>
      <Result state={state}>{state.data && (state.data.length ? <div className="owner-grid">{state.data.map(o => <Link key={o._id} className="owner-card" to={'/owners/' + o._id}>
        <div className="owner-card-head"><span className="owner-avatar">{o.name.charAt(0).toUpperCase()}</span><div><strong>{o.name}</strong><small>{o.phone}</small></div><Icon name="arrow"/></div>
        <div className="owner-card-stats"><span><strong>{o.villas.length}</strong> villa{o.villas.length === 1 ? '' : 's'}</span><span><strong>{o.occupied}</strong> occupied</span><span><strong>{o.vacant}</strong> vacant</span></div>
        <ul className="owner-villas">{o.villas.map(v => <li key={v._id}><span>{v.name}</span><State now={v.now}/></li>)}</ul>
      </Link>)}</div> : <Empty title={q ? 'No owners match your search' : 'No managed owners yet'}>{q ? 'Try another name or mobile number.' : 'Add the first owner and their villa to start managing it.'}</Empty>)}</Result>
    </section>
    {adding && <Drawer title="Add owner + villa" close={() => setAdding(false)}><AddOwnerForm onDone={result => { setAdding(false); navigate('/owners/' + result.owner._id); }}/></Drawer>}
  </>;
}

const MAX_PHOTOS = 20;

// Shrinks a device photo (max 1920px, JPEG) so uploads stay small and fast.
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

// Villa photos from a pasted link or the device. The first photo is the website cover.
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
    if (photos.length + files.length > MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos per villa — you can add ${MAX_PHOTOS - photos.length} more.`); return; }
    setBusy(true); setError('');
    try { onChange([...photos, ...await Promise.all(files.map(shrink))]); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const remove = i => onChange(photos.filter((_, j) => j !== i));
  const makeCover = i => onChange([photos[i], ...photos.filter((_, j) => j !== i)]);
  return <div className="photo-picker">
    <div className="photo-add">
      <Field label="Paste image link"><div className="photo-link-row"><input type="url" placeholder="https://…/villa.jpg" value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}/><button type="button" onClick={addLink}>Add link</button></div></Field>
      <label className={'photo-upload' + (busy ? ' busy' : '')}><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={upload} disabled={busy}/><Icon name="box"/><span>{busy ? 'Preparing photos…' : 'Upload from device'}</span><small>JPG, PNG or WebP · resized automatically</small></label>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {photos.length ? <ul className="photo-grid">{photos.map((src, i) => <li key={`${i}-${src.length}`}>
      <img src={src} alt={`Villa photo ${i + 1}`}/>
      {i === 0 ? <span className="photo-cover">Cover</span> : <button type="button" className="photo-cover-btn" onClick={() => makeCover(i)}>Make cover</button>}
      <button type="button" className="photo-remove" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)}><Icon name="close"/></button>
    </li>)}</ul> : <p className="hint">No photos yet. The first photo becomes the cover on the website.</p>}
    <small>{photos.length} / {MAX_PHOTOS} photos</small>
  </div>;
}

const EMPTY_OWNER = { name: '', phone: '', whatsapp: '', email: '', address: '', alternateName: '', alternatePhone: '', notes: '' };
const EMPTY_VILLA = { photos: [], name: '', type: 'Villa', location: '', address: '', mapLink: '', maxGuests: '', bedrooms: '', bathrooms: '', price: '', extraGuestRate: '', checkInTime: '1:00 PM', checkOutTime: '11:00 AM', wifiName: '', wifiPassword: '', keyLocation: '', caretakerName: '', caretakerPhone: '', handoverNotes: '' };

function VillaFields({ villa, set }) {
  const f = key => e => set(v => ({ ...v, [key]: e.target.value }));
  return <>
    <fieldset className="form-section"><legend>Villa</legend><div className="form-grid">
      <Field label="Villa name *" required maxLength="120" value={villa.name} onChange={f('name')}/>
      <Field label="Type"><select value={villa.type} onChange={f('type')}>{['Villa', 'Cottage', 'Homestay', 'Apartment'].map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Location *" required maxLength="120" placeholder="Mahabaleshwar" value={villa.location} onChange={f('location')}/>
      <Field label="Google Maps link" type="url" maxLength="500" placeholder="https://maps.google.com/…" value={villa.mapLink} onChange={f('mapLink')}/>
      <Field label="Full address" maxLength="300" value={villa.address} onChange={f('address')}/>
    </div></fieldset>
    <fieldset className="form-section"><legend>Photos</legend><PhotoPicker photos={villa.photos} onChange={photos => set(v => ({ ...v, photos }))}/></fieldset>
    <fieldset className="form-section"><legend>Booking — the whole villa is booked together</legend><div className="form-grid">
      <Field label="Max guests *" type="number" required min="1" max="50" value={villa.maxGuests} onChange={f('maxGuests')}/>
      <Field label="Bedrooms" type="number" min="0" max="50" value={villa.bedrooms} onChange={f('bedrooms')}/>
      <Field label="Bathrooms" type="number" min="0" max="50" value={villa.bathrooms} onChange={f('bathrooms')}/>
      <Field label="Price per night (₹, whole villa) *" type="number" required min="1" step="1" value={villa.price} onChange={f('price')}/>
      <Field label="Extra guest charge (₹ / night)" type="number" min="0" step="1" value={villa.extraGuestRate} onChange={f('extraGuestRate')}/>
      <Field label="Check-in time" maxLength="40" value={villa.checkInTime} onChange={f('checkInTime')}/>
      <Field label="Check-out time" maxLength="40" value={villa.checkOutTime} onChange={f('checkOutTime')}/>
    </div></fieldset>
    <fieldset className="form-section"><legend>Handover (team only)</legend><div className="form-grid">
      <Field label="Keys kept with / gate code" maxLength="200" value={villa.keyLocation} onChange={f('keyLocation')}/>
      <Field label="Caretaker name" maxLength="100" value={villa.caretakerName} onChange={f('caretakerName')}/>
      <Field label="Caretaker phone" type="tel" maxLength="20" value={villa.caretakerPhone} onChange={f('caretakerPhone')}/>
      <Field label="Wi-Fi name" maxLength="60" value={villa.wifiName} onChange={f('wifiName')}/>
      <Field label="Wi-Fi password" maxLength="60" value={villa.wifiPassword} onChange={f('wifiPassword')}/>
      <Field label="Handover notes"><textarea maxLength="1000" placeholder="Meters, water tank, local plumber/electrician…" value={villa.handoverNotes} onChange={f('handoverNotes')}/></Field>
    </div></fieldset>
  </>;
}

function AddOwnerForm({ onDone }) {
  const [owner, setOwner] = useState(EMPTY_OWNER); const [villa, setVilla] = useState(EMPTY_VILLA); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const f = key => e => setOwner(o => ({ ...o, [key]: e.target.value }));
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { onDone(await ownerService.create({ owner, villa })); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <form className="drawer-form" onSubmit={submit}>
    <p>The owner doesn't need a login — just their contact details. The villa goes to Admin for approval before it appears on the website.</p>
    <fieldset className="form-section"><legend>Owner</legend><div className="form-grid">
      <Field label="Owner name *" required maxLength="100" value={owner.name} onChange={f('name')}/>
      <Field label="Mobile number *" type="tel" required maxLength="20" value={owner.phone} onChange={f('phone')}/>
      <Field label="WhatsApp number" type="tel" maxLength="20" placeholder="Same as mobile if blank" value={owner.whatsapp} onChange={f('whatsapp')}/>
      <Field label="Email (optional)" type="email" maxLength="120" value={owner.email} onChange={f('email')}/>
      <Field label="Address" maxLength="300" value={owner.address} onChange={f('address')}/>
      <Field label="Alternate contact name" maxLength="100" value={owner.alternateName} onChange={f('alternateName')}/>
      <Field label="Alternate contact number" type="tel" maxLength="20" value={owner.alternatePhone} onChange={f('alternatePhone')}/>
      <Field label="Notes"><textarea maxLength="1000" placeholder="e.g. prefers WhatsApp, visits in May" value={owner.notes} onChange={f('notes')}/></Field>
    </div></fieldset>
    <VillaFields villa={villa} set={setVilla}/>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="drawer-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save owner + villa'}</button></div>
  </form>;
}

function AddVillaForm({ ownerId, onDone }) {
  const [villa, setVilla] = useState(EMPTY_VILLA); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await ownerService.addVilla(ownerId, villa); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <form className="drawer-form" onSubmit={submit}><p>The new villa goes to Admin for approval before it appears on the website.</p><VillaFields villa={villa} set={setVilla}/>{error && <p className="error" role="alert">{error}</p>}<div className="drawer-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save villa'}</button></div></form>;
}

function PhotosForm({ villa, onDone }) {
  const [photos, setPhotos] = useState(villa.photos); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e) { e.preventDefault(); setBusy(true); setError(''); try { await ownerService.photos(villa._id, photos); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <form className="drawer-form" onSubmit={save}><p>Changes show on the website once the villa is live. The first photo is the cover.</p><PhotoPicker photos={photos} onChange={setPhotos}/>{error && <p className="error" role="alert">{error}</p>}<div className="drawer-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save photos'}</button></div></form>;
}

function OwnerDetail({ id }) {
  const state = useData(() => ownerService.get(id), 'owner:' + id);
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [photosFor, setPhotosFor] = useState(null); const [guideFor, setGuideFor] = useState(null);
  async function collect(booking) { if (!window.confirm(`Mark ${money(booking.balanceDue)} as collected from ${booking.guestName}?`)) return; setBusy(booking._id); setError(''); try { await ownerService.collect(booking._id); state.reload(); } catch (err) { setError(err.message); } finally { setBusy(''); } }
  async function toggle(villa) { setBusy(villa._id); setError(''); try { await ownerService.website(villa._id, !villa.websiteVisible); state.reload(); } catch (err) { setError(err.message); } finally { setBusy(''); } }
  const d = state.data; const villaName = pid => d?.villas.find(v => v._id === pid)?.name || '';
  return <Result state={state}>{d && <>
    <div className="page-head"><div><Link to="/owners">← All owners</Link><h1>{d.owner.name}</h1><p>Owner since {date(d.owner.createdAt)} · {d.villas.length} villa{d.villas.length === 1 ? '' : 's'}</p></div>
      <div className="actions"><a className="icon-btn" href={'tel:' + d.owner.phone}>Call {d.owner.phone}</a><a className="icon-btn" href={whatsappHref(d.owner.whatsapp || d.owner.phone)} target="_blank" rel="noreferrer">WhatsApp</a><button className="primary" onClick={() => setAdding(true)}>Add villa</button></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="stats owner-stats"><div><strong>{d.totals.stays}</strong><span>Completed stays</span></div><div><strong>{d.totals.nights}</strong><span>Nights hosted</span></div><div><strong>{money(d.totals.revenue)}</strong><span>Paid revenue</span></div><div><strong>{d.upcoming.length}</strong><span>Upcoming / current</span></div></div>
    <section className="panel"><h2>Contact</h2><dl className="details"><dt>Mobile</dt><dd>{d.owner.phone}</dd><dt>WhatsApp</dt><dd>{d.owner.whatsapp || d.owner.phone}</dd><dt>Email</dt><dd>{d.owner.email || '—'}</dd><dt>Address</dt><dd>{d.owner.profile.address || '—'}</dd><dt>Alternate contact</dt><dd>{d.owner.profile.alternateName ? `${d.owner.profile.alternateName} · ${d.owner.profile.alternatePhone || ''}` : '—'}</dd><dt>Notes</dt><dd>{d.owner.profile.notes || '—'}</dd></dl></section>
    {d.villas.map(v => <section className="panel villa-panel" key={v._id}>
      <div className="section-head"><div><h2>{v.name}</h2><p>{v.type} · {v.location} · whole villa · up to {v.unit?.capacity || v.details.guestCapacity || '—'} guests</p></div><div className="actions"><State now={v.now}/><Website value={v.website}/></div></div>
      {v.photos.length > 0 && <div className="villa-photos">{v.photos.slice(0, 5).map((src, i) => <img key={i} src={src} alt={`${v.name} photo ${i + 1}`}/>)}{v.photos.length > 5 && <span>+{v.photos.length - 5}</span>}</div>}
      <div className="villa-now">{v.now.current ? <p><strong>{v.now.state === 'occupied' ? 'Staying now:' : 'Arriving today:'}</strong> {v.now.current.name} · {v.now.current.guests} guests · {date(v.now.current.checkIn)} → {date(v.now.current.checkOut)}{v.now.current.phone && <> · <a href={'tel:' + v.now.current.phone}>{v.now.current.phone}</a></>}</p> : <p><strong>Vacant now.</strong> {v.now.nextCheckIn ? `Next check-in ${date(v.now.nextCheckIn)}.` : 'No upcoming bookings.'}</p>}</div>
      <dl className="details"><dt>Price</dt><dd>{money(v.unit?.baseRate ?? v.price)} / night{v.unit?.extraGuestRate ? ` · extra guest ${money(v.unit.extraGuestRate)}` : ''}</dd><dt>Bedrooms / bathrooms</dt><dd>{v.details.bedrooms ?? '—'} / {v.details.bathrooms ?? '—'}</dd><dt>Check-in / out</dt><dd>{v.stayInfo.checkInTime || '—'} / {v.stayInfo.checkOutTime || '—'}</dd><dt>Keys / caretaker</dt><dd>{v.handover.keyLocation || '—'}{v.handover.caretakerName ? ` · ${v.handover.caretakerName} ${v.handover.caretakerPhone || ''}` : ''}</dd><dt>Wi-Fi</dt><dd>{v.stayInfo.wifiName ? `${v.stayInfo.wifiName} / ${v.stayInfo.wifiPassword}` : '—'}</dd>{v.handover.notes && <><dt>Handover notes</dt><dd>{v.handover.notes}</dd></>}{v.mapLink && <><dt>Map</dt><dd><a href={v.mapLink} target="_blank" rel="noreferrer">Open in Google Maps</a></dd></>}</dl>
      <div className="actions">
        {v.status === 'approved' ? <button disabled={busy === v._id} onClick={() => toggle(v)}>{v.websiteVisible ? 'Hide from website' : 'Show on website'}</button> : <span className="hint">The website switch unlocks after Admin approves this villa.</span>}
        <button onClick={() => setPhotosFor(v)}>{v.photos.length ? `Photos (${v.photos.length})` : 'Add photos'}</button>
        <Link className="icon-btn" to={'/properties/' + v._id}>Operations</Link><Link className="icon-btn" to={'/calendar?propertyId=' + v._id}>Calendar</Link>
      </div>
    </section>)}
    <section className="panel"><h2>Upcoming & current bookings</h2>{d.upcoming.length ? <Table headings={['Guest', 'Villa', 'Dates', 'Guests', 'Stay', 'Paid online', 'Collect at villa', 'Guide', 'Total']}>{d.upcoming.map(b => <tr key={b._id}><td><Link className="row-link" to={'/bookings/' + b._id}>{b.guestName}</Link><small>{b.guestPhone}</small></td><td>{villaName(b.property)}</td><td>{date(b.checkIn)} → {date(b.checkOut)}</td><td>{b.guests}</td><td><Badge value={b.stayStatus}/></td><td>{money(b.paidOnline)}<small>{b.paymentPlan === 'advance' ? 'Advance' : 'Full payment'}</small></td><td>{b.balanceDue > 0 ? <><strong>{money(b.balanceDue)}</strong><button className="text-btn" disabled={busy === b._id} onClick={() => collect(b)}>Mark collected</button></> : '—'}</td><td>{b.guide ? <><strong>{b.guide.assigned?.name || 'Guide needed'}</strong><small>{b.guide.days} day{b.guide.days === 1 ? '' : 's'}</small><button className="text-btn" onClick={() => setGuideFor(b)}>{b.guide.assigned ? 'Change guide' : 'Assign guide'}</button></> : '—'}</td><td>{money(b.totalPrice)}</td></tr>)}</Table> : <Empty title="No upcoming bookings">New bookings for this owner's villas will appear here.</Empty>}</section>
    <section className="panel"><h2>History</h2>{d.history.length ? <Table headings={['Guest', 'Villa', 'Dates', 'Guests', 'Status', 'Payment', 'Amount']}>{d.history.map(b => <tr key={b._id}><td>{b.guestName}<small>{b.guestPhone}</small></td><td>{villaName(b.property)}</td><td>{date(b.checkIn)} → {date(b.checkOut)}</td><td>{b.guests}</td><td><Badge value={b.status === 'cancelled' ? 'cancelled' : b.stayStatus}/></td><td><Badge value={b.paymentStatus}/></td><td>{money(b.totalPrice)}</td></tr>)}</Table> : <Empty title="No past stays yet">Completed and cancelled bookings will appear here.</Empty>}</section>
    {guideFor && <Drawer title="Assign local guide" close={() => setGuideFor(null)}><GuideAssignment booking={guideFor} onSaved={() => { setGuideFor(null); state.reload(); }} /></Drawer>}
    {photosFor && <Drawer title={'Photos · ' + photosFor.name} close={() => setPhotosFor(null)}><PhotosForm villa={photosFor} onDone={() => { setPhotosFor(null); state.reload(); }}/></Drawer>}
    {adding && <Drawer title={'Add villa for ' + d.owner.name} close={() => setAdding(false)}><AddVillaForm ownerId={id} onDone={() => { setAdding(false); state.reload(); }}/></Drawer>}
  </>}</Result>;
}
