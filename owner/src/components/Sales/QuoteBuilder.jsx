import { useEffect, useMemo, useRef, useState } from 'react';
import { api, query } from '../../lib/api';
import { rupees, localDateIso, addDaysIso, nightsBetween, longDate, shortDate } from '../../lib/format';
import { ADDON_CATEGORIES, PRICING_UNITS, VALIDITY_OPTIONS, HOLD_MAX_MINUTES, CANCELLATION_POLICIES, TAX_MODES } from './salesConfig';
import { Alert, Icon, Labelled, Modal } from './ui';

function initialForm({ quote, inquiry, meta }) {
  if (quote) {
    return {
      propertyId: String(quote.property?._id || quote.property), roomId: String(quote.room?._id || quote.room), inquiryId: quote.inquiry ? String(quote.inquiry._id || quote.inquiry) : '',
      guestName: quote.guest.name, guestPhone: quote.guest.phone, guestEmail: quote.guest.email,
      checkIn: quote.checkIn, checkOut: quote.checkOut, adults: quote.adults, children: quote.children, infants: quote.infants, pets: quote.pets,
      customRate: quote.nightlyRate !== quote.baseNightlyRate, nightlyRate: quote.nightlyRate,
      addOns: Object.fromEntries(quote.addOns.map(line => [String(line.addOn), String(line.quantity)])),
      fees: quote.fees.map(line => ({ label: line.label, amount: line.amount, taxRate: line.taxRate })),
      promotionCode: quote.promotion?.code || '', discountAmount: quote.manualDiscount?.amount || '', discountReason: quote.manualDiscount?.reason || '',
      taxMode: quote.taxMode, customTaxRate: quote.customTaxRate, securityDeposit: quote.securityDeposit,
      advancePercent: quote.advancePercent, balanceDueDaysBeforeCheckIn: quote.balanceDueDaysBeforeCheckIn,
      cancellationPolicy: quote.cancellationPolicy, cancellationText: quote.cancellationPolicy === 'custom' ? quote.cancellationText : '',
      notesToGuest: quote.notesToGuest, internalNotes: quote.internalNotes, validityMinutes: quote.validityMinutes, holdInventory: quote.holdInventory
    };
  }
  const tomorrow = addDaysIso(localDateIso(), 1);
  const checkIn = inquiry?.checkIn && inquiry.checkIn >= localDateIso() ? inquiry.checkIn : tomorrow;
  const checkOut = inquiry?.checkOut && inquiry.checkOut > checkIn ? inquiry.checkOut : addDaysIso(checkIn, 1);
  return {
    propertyId: String(inquiry?.property?._id || inquiry?.property || meta?.properties?.[0]?._id || ''), roomId: '', inquiryId: inquiry?._id || '',
    guestName: inquiry?.guestName || '', guestPhone: inquiry?.guestPhone || '', guestEmail: inquiry?.guestEmail || '',
    checkIn, checkOut, adults: inquiry?.adults ?? 2, children: inquiry?.children ?? 0, infants: inquiry?.infants ?? 0, pets: inquiry?.pets ?? 0,
    customRate: false, nightlyRate: '', addOns: {}, fees: [], promotionCode: '', discountAmount: '', discountReason: '',
    taxMode: 'none', customTaxRate: 12, securityDeposit: 0, advancePercent: 100, balanceDueDaysBeforeCheckIn: 3,
    cancellationPolicy: 'moderate', cancellationText: '', notesToGuest: '', internalNotes: '', validityMinutes: 1440, holdInventory: false
  };
}

function toBody(form) {
  return {
    propertyId: form.propertyId, roomId: form.roomId, inquiryId: form.inquiryId || undefined,
    guestName: form.guestName, guestPhone: form.guestPhone, guestEmail: form.guestEmail,
    checkIn: form.checkIn, checkOut: form.checkOut,
    adults: Number(form.adults || 0), children: Number(form.children || 0), infants: Number(form.infants || 0), pets: Number(form.pets || 0),
    nightlyRate: form.customRate && form.nightlyRate !== '' ? Number(form.nightlyRate) : undefined,
    addOns: Object.entries(form.addOns).map(([addOnId, quantity]) => ({ addOnId, quantity: quantity === '' ? undefined : Number(quantity) })),
    fees: form.fees.filter(fee => fee.label || fee.amount).map(fee => ({ label: fee.label, amount: Number(fee.amount || 0), taxRate: Number(fee.taxRate || 0) })),
    promotionCode: form.promotionCode.trim(),
    manualDiscount: { amount: Number(form.discountAmount || 0), reason: form.discountReason },
    taxMode: form.taxMode, customTaxRate: Number(form.customTaxRate || 0), securityDeposit: Number(form.securityDeposit || 0),
    advancePercent: Number(form.advancePercent), balanceDueDaysBeforeCheckIn: Number(form.balanceDueDaysBeforeCheckIn || 0),
    cancellationPolicy: form.cancellationPolicy, cancellationText: form.cancellationText,
    notesToGuest: form.notesToGuest, internalNotes: form.internalNotes, validityMinutes: Number(form.validityMinutes), holdInventory: form.holdInventory
  };
}

export default function QuoteBuilder({ meta, quote, inquiry, onClose, onSaved }) {
  const [form, setForm] = useState(() => initialForm({ quote, inquiry, meta }));
  const [rooms, setRooms] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const nights = nightsBetween(form.checkIn, form.checkOut);

  useEffect(() => {
    if (!form.propertyId) { setRooms([]); setAddOns([]); return; }
    let cancelled = false;
    Promise.all([api(`/owner-quotes/rooms/${form.propertyId}`), api(`/owner-catalog/add-ons${query({ propertyId: form.propertyId })}`)])
      .then(([roomList, addOnList]) => {
        if (cancelled) return;
        setRooms(roomList);
        setAddOns(addOnList);
        setForm(current => ({ ...current, roomId: roomList.some(room => room._id === current.roomId) ? current.roomId : (roomList[0]?._id || '') }));
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [form.propertyId]);

  const body = useMemo(() => toBody(form), [form]);
  useEffect(() => {
    if (!body.propertyId || !body.roomId || !body.checkIn || !body.checkOut || !body.guestName) { setPreview(null); setPreviewError(''); return undefined; }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPricing(true);
      try {
        const result = await api('/owner-quotes/preview', { method: 'POST', body: { ...body, quoteId: quote?._id }, signal: controller.signal });
        setPreview(result); setPreviewError('');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setPreview(null); setPreviewError(err.message);
      } finally { if (!controller.signal.aborted) setPricing(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [body, quote?._id]);

  const selectedRoom = rooms.find(room => room._id === form.roomId);
  const holdAllowed = Number(form.validityMinutes) <= HOLD_MAX_MINUTES;

  async function save(send) {
    setSaving(true); setError('');
    try {
      let saved = quote ? await api(`/owner-quotes/${quote._id}`, { method: 'PUT', body }) : await api('/owner-quotes', { method: 'POST', body });
      if (send) saved = await api(`/owner-quotes/${saved._id}/send`, { method: 'POST', body: {} });
      onSaved(saved, send ? `${saved.code} is ready to share — valid until ${new Date(saved.validUntil).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : `Draft ${saved.code} saved.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const toggleAddOn = id => setForm(current => {
    const next = { ...current.addOns };
    if (id in next) delete next[id]; else next[id] = '';
    return { ...current, addOns: next };
  });

  return <Modal title={quote ? `Edit draft ${quote.code}` : 'New quotation'} onClose={onClose} width={1180}>
    <div className="sd-builder">
      <div className="sd-builder-form">
        <Alert onClose={() => setError('')}>{error}</Alert>
        <fieldset>
          <legend>Stay</legend>
          <div className="sd-grid two">
            <Labelled label="Property"><select value={form.propertyId} onChange={event => set('propertyId', event.target.value)}>{meta?.properties.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Labelled>
            <Labelled label="Room / unit" hint={selectedRoom ? `Sleeps ${selectedRoom.capacity} · base ${rupees(selectedRoom.baseRate)}/night` : undefined}>
              <select value={form.roomId} onChange={event => set('roomId', event.target.value)} disabled={!rooms.length}>{rooms.length === 0 && <option value="">No active rooms — add one in Rooms & Availability</option>}{rooms.map(room => <option key={room._id} value={room._id}>{room.name} · {room.type}</option>)}</select>
            </Labelled>
          </div>
          <div className="sd-grid four">
            <Labelled label="Check-in"><input type="date" min={localDateIso()} value={form.checkIn} onChange={event => { const value = event.target.value; setForm(current => ({ ...current, checkIn: value, checkOut: current.checkOut > value ? current.checkOut : addDaysIso(value, 1) })); }} /></Labelled>
            <Labelled label="Check-out" hint={nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : undefined}><input type="date" min={form.checkIn ? addDaysIso(form.checkIn, 1) : undefined} value={form.checkOut} onChange={event => set('checkOut', event.target.value)} /></Labelled>
            <Labelled label="Adults"><input type="number" min="0" max="50" value={form.adults} onChange={event => set('adults', event.target.value)} /></Labelled>
            <Labelled label="Children"><input type="number" min="0" max="50" value={form.children} onChange={event => set('children', event.target.value)} /></Labelled>
          </div>
          <div className="sd-grid four">
            <Labelled label="Infants"><input type="number" min="0" max="20" value={form.infants} onChange={event => set('infants', event.target.value)} /></Labelled>
            <Labelled label="Pets"><input type="number" min="0" max="10" value={form.pets} onChange={event => set('pets', event.target.value)} /></Labelled>
            <label className="sd-check"><input type="checkbox" checked={form.customRate} onChange={event => setForm(current => ({ ...current, customRate: event.target.checked, nightlyRate: event.target.checked ? (current.nightlyRate || selectedRoom?.baseRate || '') : '' }))} /> Custom nightly rate</label>
            {form.customRate && <Labelled label="Rate per night (₹)"><input type="number" min="0" step="100" value={form.nightlyRate} onChange={event => set('nightlyRate', event.target.value)} /></Labelled>}
          </div>
        </fieldset>

        <fieldset>
          <legend>Guest</legend>
          <div className="sd-grid three">
            <Labelled label="Name"><input maxLength="100" value={form.guestName} onChange={event => set('guestName', event.target.value)} /></Labelled>
            <Labelled label="Phone (for WhatsApp)"><input type="tel" maxLength="20" value={form.guestPhone} onChange={event => set('guestPhone', event.target.value)} /></Labelled>
            <Labelled label="Email"><input type="email" maxLength="120" value={form.guestEmail} onChange={event => set('guestEmail', event.target.value)} /></Labelled>
          </div>
        </fieldset>

        <fieldset>
          <legend>Add-ons</legend>
          {addOns.length === 0 ? <p className="sd-muted">No add-ons for this property yet. Create breakfast, bonfire, decoration and more in Offers & Add-ons.</p> : <ul className="sd-addon-pick">{addOns.map(item => {
            const selected = item._id in form.addOns;
            const perGuest = item.pricingUnit === 'per_guest' || item.pricingUnit === 'per_guest_per_night';
            return <li key={item._id} className={selected ? 'selected' : ''}>
              <label className="sd-check"><input type="checkbox" checked={selected} onChange={() => toggleAddOn(item._id)} /> <span><strong>{item.name}</strong><small>{ADDON_CATEGORIES[item.category]} · {rupees(item.price)} {PRICING_UNITS[item.pricingUnit].toLowerCase()}{item.taxRate ? ` · ${item.taxRate}% tax` : ''}</small></span></label>
              {selected && <label className="sd-qty"><span>{perGuest ? 'Guests' : 'Qty'}</span><input type="number" min="1" max={item.maxQuantity || 100} value={form.addOns[item._id]} placeholder={perGuest ? 'All' : '1'} onChange={event => setForm(current => ({ ...current, addOns: { ...current.addOns, [item._id]: event.target.value } }))} /></label>}
            </li>;
          })}</ul>}
          <div className="sd-fees">
            {form.fees.map((fee, index) => <div className="sd-grid fee" key={index}>
              <Labelled label="Extra charge"><input maxLength="80" value={fee.label} onChange={event => set('fees', form.fees.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))} placeholder="Deep cleaning, DJ setup…" /></Labelled>
              <Labelled label="Amount (₹)"><input type="number" min="0" value={fee.amount} onChange={event => set('fees', form.fees.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)))} /></Labelled>
              <Labelled label="Tax %"><select value={fee.taxRate} onChange={event => set('fees', form.fees.map((item, i) => (i === index ? { ...item, taxRate: event.target.value } : item)))}>{[0, 5, 12, 18, 28].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></Labelled>
              <button type="button" className="sd-icon-btn" aria-label="Remove charge" onClick={() => set('fees', form.fees.filter((_, i) => i !== index))}><Icon name="fa-trash-can" /></button>
            </div>)}
            {form.fees.length < 10 && <button type="button" className="sd-btn ghost small" onClick={() => set('fees', [...form.fees, { label: '', amount: '', taxRate: 0 }])}><Icon name="fa-plus" /> Extra charge</button>}
          </div>
        </fieldset>

        <fieldset>
          <legend>Discounts & tax</legend>
          <div className="sd-grid three">
            <Labelled label="Promotion code" hint="Checked against the offer's rules"><input maxLength="20" value={form.promotionCode} onChange={event => set('promotionCode', event.target.value.toUpperCase())} placeholder="e.g. MONSOON15" /></Labelled>
            <Labelled label="Extra discount (₹)"><input type="number" min="0" value={form.discountAmount} onChange={event => set('discountAmount', event.target.value)} /></Labelled>
            <Labelled label="Discount reason" hint="Internal; the guest sees “Special discount”"><input maxLength="120" value={form.discountReason} onChange={event => set('discountReason', event.target.value)} /></Labelled>
          </div>
          <div className="sd-grid two">
            <Labelled label="Tax on this quotation"><select value={form.taxMode} onChange={event => set('taxMode', event.target.value)}>{Object.entries(TAX_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
            {form.taxMode === 'custom' && <Labelled label="Accommodation tax %"><input type="number" min="0" max="28" value={form.customTaxRate} onChange={event => set('customTaxRate', event.target.value)} /></Labelled>}
          </div>
          {form.taxMode === 'gst_hotel' && <p className="sd-hint"><Icon name="fa-circle-info" /> 5% when the nightly tariff after discounts is up to ₹7,500, otherwise 18%. Add-on and extra-charge taxes use their own rates. Confirm current GST rates with your tax advisor.</p>}
        </fieldset>

        <fieldset>
          <legend>Payment & policy</legend>
          <div className="sd-grid four">
            <Labelled label="Advance to confirm"><select value={form.advancePercent} onChange={event => set('advancePercent', event.target.value)}>{[100, 50, 30, 25, 20, 0].map(value => <option key={value} value={value}>{value === 100 ? 'Full payment' : value === 0 ? 'Pay at check-in' : `${value}% advance`}</option>)}</select></Labelled>
            {Number(form.advancePercent) > 0 && Number(form.advancePercent) < 100 && <Labelled label="Balance due (days before check-in)"><input type="number" min="0" max="60" value={form.balanceDueDaysBeforeCheckIn} onChange={event => set('balanceDueDaysBeforeCheckIn', event.target.value)} /></Labelled>}
            <Labelled label="Refundable security deposit (₹)" hint="Collected separately, not in the total"><input type="number" min="0" step="500" value={form.securityDeposit} onChange={event => set('securityDeposit', event.target.value)} /></Labelled>
            <Labelled label="Cancellation policy"><select value={form.cancellationPolicy} onChange={event => set('cancellationPolicy', event.target.value)}>{Object.entries(CANCELLATION_POLICIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labelled>
          </div>
          {form.cancellationPolicy !== 'custom' && preview?.cancellationText && <p className="sd-hint"><Icon name="fa-file-contract" /> Guest sees: {preview.cancellationText}</p>}
          {form.cancellationPolicy === 'custom' && <Labelled label="Custom policy text"><textarea rows="2" maxLength="1200" value={form.cancellationText} onChange={event => set('cancellationText', event.target.value)} /></Labelled>}
          <div className="sd-grid two">
            <Labelled label="Note to guest (shown on the quotation)"><textarea rows="2" maxLength="1000" value={form.notesToGuest} onChange={event => set('notesToGuest', event.target.value)} placeholder="Check-in from 2 PM. Complimentary welcome drinks." /></Labelled>
            <Labelled label="Internal note (never shown to the guest)"><textarea rows="2" maxLength="1000" value={form.internalNotes} onChange={event => set('internalNotes', event.target.value)} /></Labelled>
          </div>
        </fieldset>

        <fieldset>
          <legend>Validity & room hold</legend>
          <div className="sd-grid two">
            <Labelled label="Quote valid for" hint="The clock starts when you send it"><select value={form.validityMinutes} onChange={event => { const value = Number(event.target.value); setForm(current => ({ ...current, validityMinutes: value, holdInventory: value <= HOLD_MAX_MINUTES ? current.holdInventory : false })); }}>{VALIDITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Labelled>
            <label className={`sd-check ${holdAllowed ? '' : 'disabled'}`}><input type="checkbox" checked={form.holdInventory} disabled={!holdAllowed} onChange={event => set('holdInventory', event.target.checked)} /> <span><strong>Hold the room until the quote expires</strong><small>{holdAllowed ? 'No one else can book these nights while the hold lasts. Released automatically on expiry, decline or withdrawal.' : 'Holds are limited to 72 hours so rooms are never blocked indefinitely.'}</small></span></label>
          </div>
        </fieldset>
      </div>

      <aside className="sd-builder-summary" aria-live="polite" aria-busy={pricing}>
        <h3>Price summary {pricing && <span className="sd-muted small">updating…</span>}</h3>
        {previewError && <Alert kind="warning">{previewError}</Alert>}
        {!preview && !previewError && <p className="sd-muted">Choose a room and dates to price the stay.</p>}
        {preview && <>
          <p className="sd-summary-stay">{preview.roomSnapshot?.name} · {shortDate(preview.checkIn)} → {shortDate(preview.checkOut)} · {preview.nights} night{preview.nights === 1 ? '' : 's'}</p>
          <dl className="sd-lines">
            <div><dt>{rupees(preview.nightlyRate)} × {preview.nights} night{preview.nights === 1 ? '' : 's'}</dt><dd>{rupees(preview.totals.accommodation)}</dd></div>
            {preview.addOns.map(line => <div key={line.addOn}><dt>{line.name} <small>× {line.quantity}{line.pricingUnit.includes('night') ? ` × ${preview.nights} nights` : ''}</small></dt><dd>{rupees(line.amount)}</dd></div>)}
            {preview.fees.map((line, index) => <div key={index}><dt>{line.label}</dt><dd>{rupees(line.amount)}</dd></div>)}
            {preview.promotion?.discountAmount > 0 && <div className="discount"><dt>Offer {preview.promotion.code}</dt><dd>−{rupees(preview.promotion.discountAmount)}</dd></div>}
            {preview.manualDiscount?.amount > 0 && <div className="discount"><dt>Extra discount</dt><dd>−{rupees(preview.manualDiscount.amount)}</dd></div>}
            {preview.totals.tax > 0 && <div><dt>Taxes {preview.accommodationTaxRate ? <small>(stay {preview.accommodationTaxRate}%)</small> : null}</dt><dd>{rupees(preview.totals.tax)}</dd></div>}
            <div className="total"><dt>Total</dt><dd>{rupees(preview.totals.total)}</dd></div>
          </dl>
          <dl className="sd-lines secondary">
            {preview.schedule.balanceAmount > 0 ? <>
              <div><dt>{preview.advancePercent > 0 ? `Advance (${preview.advancePercent}%) to confirm` : 'Due before arrival'}</dt><dd>{rupees(preview.schedule.advanceAmount)}</dd></div>
              <div><dt>Balance by {longDate(preview.schedule.balanceDueDate)}</dt><dd>{rupees(preview.schedule.balanceAmount)}</dd></div>
            </> : <div><dt>Full payment to confirm</dt><dd>{rupees(preview.totals.total)}</dd></div>}
            {preview.securityDeposit > 0 && <div><dt>Refundable deposit (separate)</dt><dd>{rupees(preview.securityDeposit)}</dd></div>}
          </dl>
          {preview.warnings.length > 0 && <ul className="sd-warnings">{preview.warnings.map(text => <li key={text}><Icon name="fa-triangle-exclamation" /> {text}</li>)}</ul>}
          {!preview.onlinePayment && <p className="sd-hint"><Icon name="fa-circle-info" /> Online payment is not configured, so guests will accept online and pay you directly. Record their payment in Payments & Reports.</p>}
        </>}
        <div className="sd-summary-actions">
          <button type="button" className="sd-btn ghost" onClick={() => save(false)} disabled={saving || !preview}>Save draft</button>
          <button type="button" className="sd-btn" onClick={() => save(true)} disabled={saving || !preview || preview.conflicts?.length > 0}>{saving ? 'Saving…' : 'Save & send'}</button>
        </div>
        {preview?.conflicts?.length > 0 && <p className="sd-hint warn">This room is not free on {preview.conflicts.map(night => shortDate(night.date)).join(', ')}. Change dates or room to send.</p>}
      </aside>
    </div>
  </Modal>;
}
