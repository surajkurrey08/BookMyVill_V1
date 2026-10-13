import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { readAdminSession } from '../../session';
import './OffersManager.css';

const emptyForm = { title: '', subtitle: '', badge: '', ctaLabel: '', ctaLink: '', startsAt: '', endsAt: '', active: true, discountType: 'none', discountValue: '', propertyIds: [], image: undefined };
// Dates are whole days in India (IST), matching how the website applies them.
const IST_MS = 5.5 * 3600 * 1000;
const toInput = value => (value ? new Date(new Date(value).getTime() + IST_MS).toISOString().slice(0, 10) : '');
const prettyDate = value => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

// Shrinks a chosen picture in the browser so uploads stay small and the site stays fast.
const shrinkImage = file => new Promise((resolve, reject) => {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Use a JPG, PNG or WebP picture.'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1600 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This picture could not be opened. Try another one.')); };
  img.src = url;
});

const statusOf = offer => {
  const now = Date.now();
  if (!offer.active) return { key: 'off', label: 'Hidden' };
  if (offer.startsAt && new Date(offer.startsAt) > now) return { key: 'soon', label: `Starts ${prettyDate(offer.startsAt)}` };
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) return { key: 'ended', label: 'Ended' };
  return { key: 'live', label: 'Live on website' };
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/admin/offers${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': readAdminSession()?.token, ...options.headers }
    });
  } catch {
    throw { msg: 'Cannot reach the server. Check your internet connection and try again.' };
  }
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) throw { msg: 'Your login has expired. Please log out and log in again.' };
  if (!response.ok) throw { msg: result.msg || 'Something went wrong. Please try again.', errors: result.errors || {} };
  return result;
}

export default function OffersManager() {
  const [offers, setOffers] = useState([]);
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | offer id
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [villaMode, setVillaMode] = useState('all');
  const [villaSearch, setVillaSearch] = useState('');
  const [villaLocation, setVillaLocation] = useState('all');
  const [showSelectedVillas, setShowSelectedVillas] = useState(false);

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const [offerResult, villaResult] = await Promise.all([api(''), api('/villas')]);
      setOffers(offerResult.offers);
      setVillas(villaResult.villas || []);
    } catch (err) { setLoadError(err.msg); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const say = (type, message) => setNotice({ type, message });

  const openForm = offer => {
    setErrors({}); setNotice({ type: '', message: '' });
    setVillaSearch(''); setVillaLocation('all'); setShowSelectedVillas(false);
    if (offer) {
      setEditing(offer.id);
      setForm({ ...emptyForm, title: offer.title, subtitle: offer.subtitle, badge: offer.badge, ctaLabel: offer.ctaLabel, ctaLink: offer.ctaLink, startsAt: toInput(offer.startsAt), endsAt: toInput(offer.endsAt), active: offer.active, discountType: offer.discountType || 'none', discountValue: offer.discountValue || '', propertyIds: offer.propertyIds || [] });
      setVillaMode(offer.propertyIds?.length ? 'selected' : 'all');
      setPreview(offer.imageUrl ? `${API_BASE_URL}${offer.imageUrl}` : '');
    } else {
      setEditing('new'); setForm(emptyForm); setPreview(''); setVillaMode('all');
    }
  };
  const closeForm = () => { setEditing(null); setErrors({}); };
  const change = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); };
  const toggleVilla = id => change('propertyIds', form.propertyIds.includes(id) ? form.propertyIds.filter(item => item !== id) : [...form.propertyIds, id]);
  const chooseVillaMode = mode => {
    setVillaMode(mode);
    setErrors(current => ({ ...current, propertyIds: '' }));
  };

  const pickImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = await shrinkImage(file);
      setForm(f => ({ ...f, image: data })); setPreview(data); setErrors(e => ({ ...e, image: '' }));
    } catch (err) { setErrors(e => ({ ...e, image: err.message })); }
  };
  const removeImage = () => { setForm(f => ({ ...f, image: null })); setPreview(''); };

  const save = async event => {
    event.preventDefault();
    setNotice({ type: '', message: '' });
    if (villaMode === 'selected' && !form.propertyIds.length) {
      setErrors(current => ({ ...current, propertyIds: 'Select at least one villa, or choose All villas.' }));
      document.getElementById('offer-villa-search')?.focus();
      return;
    }
    setBusy('save');
    const body = { ...form, propertyIds: villaMode === 'all' ? [] : form.propertyIds };
    if (body.image === undefined) delete body.image;
    try {
      const isNew = editing === 'new';
      await api(isNew ? '' : `/${editing}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(body) });
      await load(); closeForm();
      say('success', isNew ? 'Offer added. It now slides on the website.' : 'Offer saved.');
    } catch (err) { setErrors(err.errors || {}); say('error', err.msg); } finally { setBusy(''); }
  };

  const run = async (key, action, okMessage) => {
    setBusy(key); setNotice({ type: '', message: '' });
    try { await action(); await load(); if (okMessage) say('success', okMessage); } catch (err) { say('error', err.msg); } finally { setBusy(''); }
  };
  const toggle = offer => run(offer.id, () => api(`/${offer.id}`, { method: 'PUT', body: JSON.stringify({ active: !offer.active }) }), offer.active ? 'Offer hidden from the website.' : 'Offer is now live.');
  const move = (offer, direction) => run(offer.id, () => api(`/${offer.id}/move`, { method: 'POST', body: JSON.stringify({ direction }) }));
  const remove = offer => { if (window.confirm(`Delete "${offer.title}" permanently?`)) run(offer.id, () => api(`/${offer.id}`, { method: 'DELETE' }), 'Offer deleted.'); };

  if (loading && !offers.length) return <p className="offers-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading offers...</p>;
  if (loadError) return <div className="offers-notice error" role="alert"><span><i className="fa-solid fa-circle-exclamation"></i> {loadError}</span><button type="button" className="offers-btn" onClick={load}>Try again</button></div>;

  const field = (key, label, props = {}) => (
    <label className={`offers-field ${errors[key] ? 'has-error' : ''}`}>
      <span>{label}</span>
      <input value={form[key]} onChange={e => change(key, e.target.value)} {...props} />
      {errors[key] && <em><i className="fa-solid fa-circle-exclamation"></i> {errors[key]}</em>}
    </label>
  );

  const villaLocations = [...new Set(villas.map(villa => villa.location).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const normalizedVillaSearch = villaSearch.trim().toLowerCase();
  const visibleVillas = villas.filter(villa => {
    const matchesSearch = !normalizedVillaSearch || `${villa.name || ''} ${villa.location || ''}`.toLowerCase().includes(normalizedVillaSearch);
    const matchesLocation = villaLocation === 'all' || villa.location === villaLocation;
    const matchesSelection = !showSelectedVillas || form.propertyIds.includes(villa.id);
    return matchesSearch && matchesLocation && matchesSelection;
  });
  const visibleVillaIds = visibleVillas.map(villa => villa.id);
  const allVisibleSelected = visibleVillaIds.length > 0 && visibleVillaIds.every(id => form.propertyIds.includes(id));
  const toggleVisibleVillas = () => {
    if (allVisibleSelected) {
      change('propertyIds', form.propertyIds.filter(id => !visibleVillaIds.includes(id)));
    } else {
      change('propertyIds', [...new Set([...form.propertyIds, ...visibleVillaIds])]);
    }
  };

  return (
    <div className="offers-manager">
      <div className="offers-intro">
        <div>
          <h2>Hero Offers</h2>
          <p>Create a timed offer card and choose the villas it covers. Discounts selected here are applied automatically at checkout and shown on the booking bill.</p>
        </div>
        {!editing && <button type="button" className="offers-btn primary" onClick={() => openForm(null)}><i className="fa-solid fa-plus"></i> Add offer</button>}
      </div>

      {notice.message && (
        <div className={`offers-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <i className={`fa-solid ${notice.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i> {notice.message}
        </div>
      )}

      {editing && (
        <form className="offers-form" onSubmit={save} noValidate>
          <h3>{editing === 'new' ? 'New offer' : 'Edit offer'}</h3>
          <div className="offers-grid">
            <div className="offers-col">
              {field('title', 'Headline *', { placeholder: 'e.g. Monsoon Special — 20% off', maxLength: 80 })}
              {field('subtitle', 'Short description', { placeholder: 'e.g. Book any villa for 2+ nights this month', maxLength: 160 })}
              <div className="offers-row">
                {field('badge', 'Tag', { placeholder: 'e.g. 20% OFF', maxLength: 24 })}
                {field('ctaLabel', 'Button text', { placeholder: 'e.g. Book now', maxLength: 24 })}
              </div>
              {field('ctaLink', 'Button goes to', { placeholder: '/explore  or  https://…' })}
              <div className="offers-row">
                {field('startsAt', 'Starts on (optional)', { type: 'date' })}
                {field('endsAt', 'Ends on (optional)', { type: 'date' })}
              </div>
              <div className="offers-row">
                <label className="offers-field"><span>Booking discount</span><select value={form.discountType} onChange={e => change('discountType', e.target.value)}><option value="none">No price discount</option><option value="percent">Percentage off</option><option value="fixed">Fixed rupees off</option></select></label>
                <label className={`offers-field ${errors.discountValue ? 'has-error' : ''}`}><span>{form.discountType === 'percent' ? 'Percent off' : 'Rupees off'}</span><input type="number" min="0" max={form.discountType === 'percent' ? 100 : 10000000} step="1" value={form.discountValue} disabled={form.discountType === 'none'} onChange={e => change('discountValue', e.target.value)} placeholder="e.g. 15" />{errors.discountValue && <em>{errors.discountValue}</em>}</label>
              </div>
              <div className={`offers-field offers-villa-field ${errors.propertyIds ? 'has-error' : ''}`}>
                <div className="offers-villa-heading">
                  <div>
                    <span>Villa coverage</span>
                    <p className="offers-hint">Choose where this offer can be booked.</p>
                  </div>
                  <strong className="offers-villa-count">
                    {villaMode === 'all' ? `All ${villas.length} villas` : `${form.propertyIds.length} of ${villas.length} selected`}
                  </strong>
                </div>

                <div className="offers-villa-mode" role="group" aria-label="Offer villa coverage">
                  <button type="button" className={villaMode === 'all' ? 'active' : ''} aria-pressed={villaMode === 'all'} onClick={() => chooseVillaMode('all')}>
                    <i className="fa-solid fa-earth-asia" aria-hidden="true"></i>
                    <span><strong>All villas</strong><small>Includes current and newly approved villas</small></span>
                  </button>
                  <button type="button" className={villaMode === 'selected' ? 'active' : ''} aria-pressed={villaMode === 'selected'} onClick={() => chooseVillaMode('selected')}>
                    <i className="fa-solid fa-list-check" aria-hidden="true"></i>
                    <span><strong>Choose villas</strong><small>Apply only to villas you select</small></span>
                  </button>
                </div>

                {villaMode === 'selected' && (
                  <div className="offers-villa-picker">
                    <div className="offers-villa-filters">
                      <label className="offers-villa-search" htmlFor="offer-villa-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <input
                          id="offer-villa-search"
                          type="search"
                          value={villaSearch}
                          onChange={event => setVillaSearch(event.target.value)}
                          placeholder="Search villa or location"
                        />
                      </label>
                      <label className="offers-villa-location">
                        <span className="sr-only">Filter villas by location</span>
                        <select value={villaLocation} onChange={event => setVillaLocation(event.target.value)} aria-label="Filter villas by location">
                          <option value="all">All locations</option>
                          {villaLocations.map(location => <option key={location} value={location}>{location}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="offers-villa-toolbar">
                      <span>{visibleVillas.length} villa{visibleVillas.length === 1 ? '' : 's'} in view</span>
                      <div>
                        <button type="button" className={`offers-villa-text-btn ${showSelectedVillas ? 'active' : ''}`} onClick={() => setShowSelectedVillas(current => !current)}>
                          {showSelectedVillas ? 'Show all results' : 'View selected'}
                        </button>
                        <button type="button" className="offers-villa-text-btn" disabled={!visibleVillas.length} onClick={toggleVisibleVillas}>
                          {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                        </button>
                        <button type="button" className="offers-villa-text-btn" disabled={!form.propertyIds.length} onClick={() => change('propertyIds', [])}>Clear all</button>
                      </div>
                    </div>

                    <div className="offers-villa-list" aria-label="Select villas for this offer">
                      {visibleVillas.map(villa => (
                        <label key={villa.id} className={form.propertyIds.includes(villa.id) ? 'selected' : ''}>
                          <input type="checkbox" checked={form.propertyIds.includes(villa.id)} onChange={() => toggleVilla(villa.id)} />
                          <span><strong>{villa.name}</strong><small><i className="fa-solid fa-location-dot" aria-hidden="true"></i> {villa.location || 'Location not added'}</small></span>
                          {form.propertyIds.includes(villa.id) && <i className="fa-solid fa-circle-check offers-villa-selected-icon" aria-hidden="true"></i>}
                        </label>
                      ))}
                      {!visibleVillas.length && (
                        <div className="offers-villa-empty">
                          <i className={`fa-solid ${showSelectedVillas ? 'fa-list-check' : 'fa-magnifying-glass'}`} aria-hidden="true"></i>
                          <strong>{showSelectedVillas ? 'No selected villas in view' : 'No villas found'}</strong>
                          <span>{showSelectedVillas ? 'Show all results and select the villas you need.' : 'Change the search or location filter.'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {errors.propertyIds && <em>{errors.propertyIds}</em>}
              </div>
              <label className="offers-check"><input type="checkbox" checked={form.active} onChange={e => change('active', e.target.checked)} /> Show this offer on the website</label>
            </div>
            <div className="offers-col">
              <span className="offers-label">Background picture</span>
              <div className={`offers-preview ${errors.image ? 'has-error' : ''}`} style={preview ? { backgroundImage: `url(${preview})` } : undefined}>
                {!preview && <span><i className="fa-regular fa-image"></i> No picture — the normal page background is used</span>}
                <div className="offers-preview-text">
                  {form.badge && <b>{form.badge}</b>}
                  <strong>{form.title || 'Your headline'}</strong>
                  {form.subtitle && <small>{form.subtitle}</small>}
                </div>
              </div>
              {errors.image && <em className="offers-err"><i className="fa-solid fa-circle-exclamation"></i> {errors.image}</em>}
              <div className="offers-actions">
                <label className="offers-btn">
                  <i className="fa-solid fa-upload"></i> {preview ? 'Change picture' : 'Choose picture'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} hidden />
                </label>
                {preview && <button type="button" className="offers-link" onClick={removeImage}>Remove picture</button>}
              </div>
              <small className="offers-hint">Wide pictures work best (landscape). Large files are shrunk automatically.</small>
            </div>
          </div>
          <div className="offers-actions">
            <button type="submit" className="offers-btn primary" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save offer'}</button>
            <button type="button" className="offers-link" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {!offers.length && !editing && (
        <div className="offers-empty"><i className="fa-solid fa-tags"></i><strong>No offers yet</strong><span>Add your first offer and it will start sliding on the website.</span></div>
      )}

      <ul className="offers-list">
        {offers.map((offer, index) => {
          const status = statusOf(offer);
          return (
            <li key={offer.id} className="offers-item">
              <div className="offers-thumb" style={offer.imageUrl ? { backgroundImage: `url(${API_BASE_URL}${offer.imageUrl})` } : undefined}>{!offer.imageUrl && <i className="fa-regular fa-image"></i>}</div>
              <div className="offers-info">
                <div className="offers-title"><strong>{offer.title}</strong><span className={`offers-status ${status.key}`}>{status.label}</span></div>
                {offer.subtitle && <p>{offer.subtitle}</p>}
                <small>
                  {offer.badge && <>Tag: {offer.badge} · </>}
                  {offer.discountType === 'percent' ? `${offer.discountValue}% off; ` : offer.discountType === 'fixed' ? `Rs ${Number(offer.discountValue).toLocaleString('en-IN')} off; ` : ''}
                  {offer.propertyIds?.length ? `Selected villas: ${offer.propertyIds.length}; ` : 'All villas; '}
                  {offer.ctaLabel ? `Button: ${offer.ctaLabel} → ${offer.ctaLink}` : 'No button'}
                  {(offer.startsAt || offer.endsAt) && <> · {offer.startsAt ? prettyDate(offer.startsAt) : 'Now'} – {offer.endsAt ? prettyDate(offer.endsAt) : 'No end date'}</>}
                </small>
              </div>
              <div className="offers-tools">
                <button type="button" className="offers-icon" disabled={busy === offer.id || index === 0} onClick={() => move(offer, 'up')} title="Show earlier" aria-label="Move earlier"><i className="fa-solid fa-arrow-up"></i></button>
                <button type="button" className="offers-icon" disabled={busy === offer.id || index === offers.length - 1} onClick={() => move(offer, 'down')} title="Show later" aria-label="Move later"><i className="fa-solid fa-arrow-down"></i></button>
                <button type="button" className="offers-btn small" disabled={busy === offer.id} onClick={() => toggle(offer)}>{offer.active ? 'Hide' : 'Show'}</button>
                <button type="button" className="offers-btn small" onClick={() => openForm(offer)}>Edit</button>
                <button type="button" className="offers-btn small danger" disabled={busy === offer.id} onClick={() => remove(offer)}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
