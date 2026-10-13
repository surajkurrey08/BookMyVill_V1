import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { readAdminSession } from '../../session';
import './OffersManager.css';

const emptyForm = { title: '', subtitle: '', badge: '', ctaLabel: '', ctaLink: '', startsAt: '', endsAt: '', active: true, image: undefined };
const toInput = value => (value ? new Date(value).toISOString().slice(0, 10) : '');
const prettyDate = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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
  if (offer.endsAt && new Date(offer.endsAt).getTime() + 86399999 < now) return { key: 'ended', label: 'Ended' };
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | offer id
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ type: '', message: '' });

  const load = async () => {
    setLoading(true); setLoadError('');
    try { setOffers((await api('')).offers); } catch (err) { setLoadError(err.msg); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const say = (type, message) => setNotice({ type, message });

  const openForm = offer => {
    setErrors({}); setNotice({ type: '', message: '' });
    if (offer) {
      setEditing(offer.id);
      setForm({ ...emptyForm, title: offer.title, subtitle: offer.subtitle, badge: offer.badge, ctaLabel: offer.ctaLabel, ctaLink: offer.ctaLink, startsAt: toInput(offer.startsAt), endsAt: toInput(offer.endsAt), active: offer.active });
      setPreview(offer.imageUrl ? `${API_BASE_URL}${offer.imageUrl}` : '');
    } else {
      setEditing('new'); setForm(emptyForm); setPreview('');
    }
  };
  const closeForm = () => { setEditing(null); setErrors({}); };
  const change = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); };

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
    setBusy('save'); setNotice({ type: '', message: '' });
    const body = { ...form };
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

  return (
    <div className="offers-manager">
      <div className="offers-intro">
        <div>
          <h2>Hero Offers</h2>
          <p>Offers slide across the top of the Explore Stays page. Add a picture, a short headline and a button.</p>
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
