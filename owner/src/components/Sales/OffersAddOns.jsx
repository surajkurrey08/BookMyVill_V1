import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { canOperateProperty, isManagedProperty } from '../../lib/propertyAccess';
import { rupees, shortDate } from '../../lib/format';
import { ADDON_CATEGORIES, PRICING_UNITS, PROMO_TYPES } from './salesConfig';
import { Alert, EmptyState, Icon, Labelled, Modal, StatusChip } from './ui';
import './Sales.css';

const PROMO_STATE = {
  live: { label: 'Live', icon: 'fa-circle-play', tone: 'emerald' },
  scheduled: { label: 'Scheduled', icon: 'fa-calendar', tone: 'blue' },
  paused: { label: 'Paused', icon: 'fa-pause', tone: 'muted' },
  ended: { label: 'Ended', icon: 'fa-flag-checkered', tone: 'muted' },
  used_up: { label: 'Limit reached', icon: 'fa-ban', tone: 'amber' }
};

const blankAddOn = { name: '', description: '', category: 'meal', pricingUnit: 'per_stay', price: '', taxRate: 0, maxQuantity: '', propertyId: '' };
const blankPromo = { code: '', name: '', description: '', type: 'promo_code', discountType: 'percent', discountValue: '', maxDiscount: '', properties: [], minNights: '', minAmount: '', minGuests: '', advanceDaysMin: '', advanceDaysMax: '', bookFrom: '', bookUntil: '', stayFrom: '', stayUntil: '', maxUses: '', maxUsesPerGuest: '' };

function promoRules(promo) {
  const rules = [];
  if (promo.minNights) rules.push(`${promo.minNights}+ nights`);
  if (promo.minGuests) rules.push(`${promo.minGuests}+ guests`);
  if (promo.minAmount) rules.push(`stay of ${rupees(promo.minAmount)}+`);
  if (promo.advanceDaysMin !== null && promo.advanceDaysMin !== undefined) rules.push(`book ${promo.advanceDaysMin}+ days ahead`);
  if (promo.advanceDaysMax !== null && promo.advanceDaysMax !== undefined) rules.push(`check-in within ${promo.advanceDaysMax} days`);
  if (promo.stayFrom || promo.stayUntil) rules.push(`check-in ${promo.stayFrom ? shortDate(promo.stayFrom) : '…'} – ${promo.stayUntil ? shortDate(promo.stayUntil) : '…'}`);
  if (promo.bookFrom || promo.bookUntil) rules.push(`usable ${promo.bookFrom ? shortDate(promo.bookFrom) : 'now'} – ${promo.bookUntil ? shortDate(promo.bookUntil) : 'no end'}`);
  if (promo.type === 'repeat_guest') rules.push('returning guests only');
  if (promo.maxUsesPerGuest) rules.push(`${promo.maxUsesPerGuest} per guest`);
  rules.push(promo.properties?.length ? promo.properties.map(item => item.name).join(', ') : 'all properties');
  return rules;
}

export default function OffersAddOns({ ownerProperties }) {
  const [tab, setTab] = useState('addons');
  const [properties, setProperties] = useState([]);
  const [addOns, setAddOns] = useState(null);
  const [promotions, setPromotions] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const hasManaged = ownerProperties.some(isManagedProperty);
  const canModify = (kind, item) => { const ids = kind === 'addon' ? (item.property ? [item.property?._id || item.property] : []) : (item.properties || []).map(property => property?._id || property); return ids.length ? ids.every(id => canOperateProperty(ownerProperties.find(property => property._id === String(id)))) : ownerProperties.length > 0 && ownerProperties.every(canOperateProperty); };
  const newAddOn = () => ({ ...blankAddOn, propertyId: hasManaged ? properties[0]?._id || '' : '' });
  const newPromo = () => ({ ...blankPromo, properties: hasManaged ? properties.map(property => property._id) : [] });
  const load = useCallback(async () => {
    try {
      const [meta, addOnList, promoList] = await Promise.all([api('/owner-crm/meta'), api('/owner-catalog/add-ons?includeInactive=1'), api('/owner-catalog/promotions')]);
      setProperties(meta.properties.filter(property => canOperateProperty(ownerProperties.find(item => item._id === property._id)))); setAddOns(addOnList); setPromotions(promoList); setError('');
    } catch (err) { setError(err.message); }
  }, [ownerProperties]);
  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setFormError('');
    const { kind, id, form } = editing;
    if (!canModify(kind, kind === 'addon' ? { property: form.propertyId || null } : { properties: form.properties })) { setFormError('Choose only self-managed properties for pricing changes.'); setBusy(false); return; }
    try {
      if (kind === 'addon') {
        const body = { ...form, price: Number(form.price), taxRate: Number(form.taxRate), maxQuantity: form.maxQuantity === '' ? null : Number(form.maxQuantity), propertyId: form.propertyId || null };
        await api(id ? `/owner-catalog/add-ons/${id}` : '/owner-catalog/add-ons', { method: id ? 'PATCH' : 'POST', body });
      } else {
        await api(id ? `/owner-catalog/promotions/${id}` : '/owner-catalog/promotions', { method: id ? 'PATCH' : 'POST', body: form });
      }
      setNotice(`${kind === 'addon' ? 'Add-on' : 'Promotion'} ${id ? 'updated' : 'created'}.`);
      setEditing(null);
      await load();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }

  async function toggle(kind, item) {
    if (!canModify(kind, item)) { setError('Pricing managed by BookMyVilla. This offer is read-only.'); return; }
    setBusy(true);
    try {
      await api(`/owner-catalog/${kind === 'addon' ? 'add-ons' : 'promotions'}/${item._id}`, { method: 'PATCH', body: { active: !item.active } });
      setNotice(`${item.name} ${item.active ? 'paused' : 'activated'}.`);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function removeAddOn(item) {
    if (!canModify('addon', item)) { setError('Pricing managed by BookMyVilla. This add-on is read-only.'); return; }
    if (!window.confirm(`Delete ${item.name}? This only works if it was never used on a quotation.`)) return;
    try { await api(`/owner-catalog/add-ons/${item._id}`, { method: 'DELETE' }); setNotice('Add-on deleted.'); await load(); }
    catch (err) { setError(err.message); }
  }

  const setField = (key, value) => setEditing(current => ({ ...current, form: { ...current.form, [key]: value } }));
  const form = editing?.form;

  return <div className="sd-panel">
    <div className="sd-head">
      <div><h2>Offers & Add-ons</h2><p>Extras guests can add to a stay, and the discount codes you apply to quotations.</p></div>
      <div className="sd-head-actions">
        {tab === 'addons' ? <button type="button" className="sd-btn" disabled={!properties.length} onClick={() => { setFormError(''); setEditing({ kind: 'addon', form: newAddOn() }); }}><Icon name="fa-plus" /> New add-on</button>
          : <button type="button" className="sd-btn" onClick={() => { setFormError(''); setEditing({ kind: 'promo', form: newPromo() }); }}><Icon name="fa-plus" /> New promotion</button>}
      </div>
    </div>
    <nav className="sd-subnav" aria-label="Offers sections">
      <button type="button" className={tab === 'addons' ? 'active' : ''} aria-current={tab === 'addons' ? 'page' : undefined} onClick={() => setTab('addons')}><Icon name="fa-mug-hot" /> Add-ons</button>
      <button type="button" className={tab === 'promos' ? 'active' : ''} aria-current={tab === 'promos' ? 'page' : undefined} onClick={() => setTab('promos')}><Icon name="fa-tags" /> Promotions</button>
    </nav>
    {hasManaged && <p className="sd-muted">Pricing managed by BookMyVilla for company-managed properties. Offers covering those properties are read-only; new offers apply to self-managed properties.</p>}
    <Alert onClose={() => setError('')}>{error}</Alert>
    {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}

    {tab === 'addons' && <section className="sd-card">
      {!addOns ? <p className="sd-muted">Loading add-ons…</p> : addOns.length === 0 ? <EmptyState icon="fa-mug-hot" title="No add-ons yet" action={<button type="button" className="sd-btn small" disabled={!properties.length} onClick={() => setEditing({ kind: 'addon', form: newAddOn() })}>Create your first add-on</button>}>Breakfast, BBQ, bonfire, decoration, extra bed, airport pickup… priced once and reused in every quotation.</EmptyState>
        : <div className="sd-table-wrap"><table className="sd-table sd-rows">
          <thead><tr><th scope="col">Add-on</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Tax</th><th scope="col">Offered at</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{addOns.map(item => <tr key={item._id} onClick={() => canModify('addon', item) && setEditing({ kind: 'addon', id: item._id, form: { ...Object.fromEntries(Object.keys(blankAddOn).map(key => [key, item[key] ?? ''])), propertyId: item.property?._id || '', maxQuantity: item.maxQuantity ?? '' } })}>
            <td data-label="Add-on"><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</td>
            <td data-label="Category">{ADDON_CATEGORIES[item.category]}</td>
            <td data-label="Price">{rupees(item.price)} <small>{PRICING_UNITS[item.pricingUnit]}</small></td>
            <td data-label="Tax">{item.taxRate}%</td>
            <td data-label="Offered at">{item.property?.name || 'All properties'}</td>
            <td data-label="Status"><StatusChip meta={item.active ? { label: 'Available', icon: 'fa-circle-check', tone: 'emerald' } : { label: 'Paused', icon: 'fa-pause', tone: 'muted' }} /></td>
            <td data-label="Actions" onClick={event => event.stopPropagation()}><div className="sd-inline-actions">
              <button type="button" className="sd-btn ghost small" disabled={busy || !canModify('addon', item)} onClick={() => toggle('addon', item)}>{item.active ? 'Pause' : 'Activate'}</button>
              <button type="button" className="sd-icon-btn" aria-label={`Delete ${item.name}`} disabled={!canModify('addon', item)} onClick={() => removeAddOn(item)}><Icon name="fa-trash-can" /></button>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </section>}

    {tab === 'promos' && <section className="sd-card">
      <p className="sd-hint"><Icon name="fa-circle-info" /> Promotions apply to accommodation charges on quotations. A use is counted only when a quotation becomes a booking.</p>
      {!promotions ? <p className="sd-muted">Loading promotions…</p> : promotions.length === 0 ? <EmptyState icon="fa-tags" title="No promotions yet" action={<button type="button" className="sd-btn small" onClick={() => setEditing({ kind: 'promo', form: newPromo() })}>Create a promotion</button>}>Early-bird, last-minute, long-stay and returning-guest offers with clear rules and usage limits.</EmptyState>
        : <div className="sd-offer-grid">{promotions.map(promo => <article key={promo._id} className={`sd-offer ${promo.active ? '' : 'paused'}`}>
          <div className="sd-offer-top"><div><span className="sd-offer-code">{promo.code}</span><h4>{promo.name}</h4></div><StatusChip meta={PROMO_STATE[promo.state]} /></div>
          <p><strong>{promo.discountType === 'percent' ? `${promo.discountValue}% off` : `${rupees(promo.discountValue)} off`}</strong>{promo.maxDiscount ? ` (max ${rupees(promo.maxDiscount)})` : ''} · {PROMO_TYPES[promo.type]}</p>
          <p>{promoRules(promo).join(' · ')}</p>
          <div className="sd-offer-stats"><span>Used <strong>{promo.usedCount}{promo.maxUses ? ` / ${promo.maxUses}` : ''}</strong></span><span>Discount given <strong>{rupees(promo.discountGiven)}</strong></span><span>On open quotes <strong>{promo.openQuotes}</strong></span></div>
          <div className="sd-inline-actions">
            <button type="button" className="sd-btn ghost small" disabled={!canModify('promo', promo)} onClick={() => setEditing({ kind: 'promo', id: promo._id, form: { ...Object.fromEntries(Object.keys(blankPromo).map(key => [key, promo[key] ?? ''])), properties: promo.properties.map(item => item._id) } })}>Edit</button>
            <button type="button" className="sd-btn ghost small" disabled={busy || !canModify('promo', promo)} onClick={() => toggle('promo', promo)}>{promo.active ? 'Pause' : 'Activate'}</button>
          </div>
        </article>)}</div>}
    </section>}

    {editing?.kind === 'addon' && <Modal title={editing.id ? `Edit ${form.name}` : 'New add-on'} onClose={() => setEditing(null)} width={640}>
      <form className="sd-form" onSubmit={save}>
        <Alert onClose={() => setFormError('')}>{formError}</Alert>
        <div className="sd-grid two">
          <Labelled label="Name *"><input required maxLength="80" value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Breakfast" /></Labelled>
          <Labelled label="Category"><select value={form.category} onChange={event => setField('category', event.target.value)}>{Object.entries(ADDON_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
        </div>
        <Labelled label="Description (shown on quotations)"><input maxLength="300" value={form.description} onChange={event => setField('description', event.target.value)} placeholder="Maharashtrian & continental buffet, 8–10:30 AM" /></Labelled>
        <div className="sd-grid three">
          <Labelled label="Price (₹) *"><input required type="number" min="0" value={form.price} onChange={event => setField('price', event.target.value)} /></Labelled>
          <Labelled label="Charged"><select value={form.pricingUnit} onChange={event => setField('pricingUnit', event.target.value)}>{Object.entries(PRICING_UNITS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
          <Labelled label="Tax rate"><select value={form.taxRate} onChange={event => setField('taxRate', event.target.value)}>{[0, 5, 12, 18, 28].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></Labelled>
        </div>
        <div className="sd-grid two">
          <Labelled label="Offered at"><select value={form.propertyId} onChange={event => setField('propertyId', event.target.value)}>{!hasManaged && <option value="">All my properties</option>}{properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Labelled>
          <Labelled label="Maximum quantity" hint="Leave empty for no limit"><input type="number" min="1" max="100" value={form.maxQuantity} onChange={event => setField('maxQuantity', event.target.value)} /></Labelled>
        </div>
        <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="sd-btn" disabled={busy}>{editing.id ? 'Save add-on' : 'Create add-on'}</button></div>
      </form>
    </Modal>}

    {editing?.kind === 'promo' && <Modal title={editing.id ? `Edit ${form.code}` : 'New promotion'} onClose={() => setEditing(null)} width={760}>
      <form className="sd-form" onSubmit={save}>
        <Alert onClose={() => setFormError('')}>{formError}</Alert>
        <fieldset><legend>Offer</legend>
          <div className="sd-grid three">
            <Labelled label="Code *" hint="Letters, numbers, - and _"><input required maxLength="20" value={form.code} onChange={event => setField('code', event.target.value.toUpperCase())} placeholder="MONSOON15" /></Labelled>
            <Labelled label="Name *"><input required maxLength="80" value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Monsoon getaway" /></Labelled>
            <Labelled label="Type"><select value={form.type} onChange={event => setField('type', event.target.value)}>{Object.entries(PROMO_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
          </div>
          <div className="sd-grid three">
            <Labelled label="Discount"><select value={form.discountType} onChange={event => setField('discountType', event.target.value)}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></Labelled>
            <Labelled label={form.discountType === 'percent' ? 'Percent off *' : 'Amount off (₹) *'}><input required type="number" min="1" max={form.discountType === 'percent' ? 90 : 1000000} value={form.discountValue} onChange={event => setField('discountValue', event.target.value)} /></Labelled>
            {form.discountType === 'percent' && <Labelled label="Maximum discount (₹)"><input type="number" min="1" value={form.maxDiscount} onChange={event => setField('maxDiscount', event.target.value)} /></Labelled>}
          </div>
          <Labelled label="Description (internal)"><input maxLength="300" value={form.description} onChange={event => setField('description', event.target.value)} /></Labelled>
        </fieldset>
        <fieldset><legend>Rules</legend>
          <div className="sd-grid three">
            <Labelled label={`Minimum nights${form.type === 'long_stay' ? ' *' : ''}`}><input type="number" min="1" value={form.minNights} onChange={event => setField('minNights', event.target.value)} /></Labelled>
            <Labelled label={`Minimum guests${form.type === 'group' ? ' *' : ''}`}><input type="number" min="1" value={form.minGuests} onChange={event => setField('minGuests', event.target.value)} /></Labelled>
            <Labelled label="Minimum stay value (₹)"><input type="number" min="1" value={form.minAmount} onChange={event => setField('minAmount', event.target.value)} /></Labelled>
          </div>
          <div className="sd-grid two">
            <Labelled label={`Booked at least … days ahead${form.type === 'early_bird' ? ' *' : ''}`}><input type="number" min="0" value={form.advanceDaysMin} onChange={event => setField('advanceDaysMin', event.target.value)} /></Labelled>
            <Labelled label={`Check-in within … days${form.type === 'last_minute' ? ' *' : ''}`}><input type="number" min="0" value={form.advanceDaysMax} onChange={event => setField('advanceDaysMax', event.target.value)} /></Labelled>
          </div>
          <div className="sd-grid four">
            <Labelled label="Code usable from"><input type="date" value={form.bookFrom} onChange={event => setField('bookFrom', event.target.value)} /></Labelled>
            <Labelled label="Code usable until"><input type="date" value={form.bookUntil} onChange={event => setField('bookUntil', event.target.value)} /></Labelled>
            <Labelled label={`Check-in from${form.type === 'seasonal' ? ' *' : ''}`}><input type="date" value={form.stayFrom} onChange={event => setField('stayFrom', event.target.value)} /></Labelled>
            <Labelled label={`Check-in until${form.type === 'seasonal' ? ' *' : ''}`}><input type="date" value={form.stayUntil} onChange={event => setField('stayUntil', event.target.value)} /></Labelled>
          </div>
          <div className="sd-grid two">
            <Labelled label="Total uses" hint="Empty = unlimited"><input type="number" min="1" value={form.maxUses} onChange={event => setField('maxUses', event.target.value)} /></Labelled>
            <Labelled label="Uses per guest" hint="Matched by phone or email"><input type="number" min="1" value={form.maxUsesPerGuest} onChange={event => setField('maxUsesPerGuest', event.target.value)} /></Labelled>
          </div>
          <fieldset className="sd-subcard"><legend>Properties</legend>
            <div className="sd-tags">{properties.map(item => <label key={item._id} className="sd-check"><input type="checkbox" checked={form.properties.includes(item._id)} onChange={event => setField('properties', event.target.checked ? [...form.properties, item._id] : form.properties.filter(id => id !== item._id))} /> {item.name}</label>)}</div>
            <p className="sd-hint">None selected = valid at all your properties.</p>
          </fieldset>
        </fieldset>
        <div className="sd-form-actions"><button type="button" className="sd-btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="sd-btn" disabled={busy}>{editing.id ? 'Save promotion' : 'Create promotion'}</button></div>
      </form>
    </Modal>}
  </div>;
}
