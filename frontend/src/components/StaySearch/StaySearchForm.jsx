import { useEffect, useRef, useState } from 'react';
import { addDays, formatDate, fromISO, isoDay, nightsBetween, todayISO } from './searchUtils';
import './StaySearch.css';

const LOCATIONS = [
  ['Lonavala', 'Sahyadri getaway · Pune'],
  ['Mahabaleshwar', 'Hill station · Satara'],
  ['Panchgani', 'Table-land views · Satara'],
  ['Pune', 'City stays · Maharashtra'],
];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const Icon = ({ name }) => <i className={`fa-solid fa-${name}`} aria-hidden="true" />;

// Combobox with a styled suggestion list (a native datalist adds its own
// arrow and cannot be styled).
const LocationInput = ({ value, onChange, open, onOpen, onClose }) => {
  const inputRef = useRef(null);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const term = value.trim().toLowerCase();
  const matches = typed ? LOCATIONS.filter(([name]) => name.toLowerCase().includes(term)) : LOCATIONS;
  const showList = open && matches.length > 0;
  const choose = (name) => { onChange(name); setTyped(false); setActive(-1); onClose(); };
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); onOpen(); setActive((index) => Math.min(index + 1, matches.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === 'Enter' && showList && active >= 0) { event.preventDefault(); choose(matches[active][0]); }
  };
  return <div className="es-search-field es-location-field" onClick={() => inputRef.current?.focus()}>
    <Icon name="location-dot" />
    <span className="es-search-copy"><span id="es-location-label">Location</span><input ref={inputRef} value={value} placeholder="Where to?" autoComplete="off" spellCheck={false} role="combobox" aria-labelledby="es-location-label" aria-autocomplete="list" aria-expanded={showList} aria-controls="es-location-list" aria-activedescendant={showList && active >= 0 ? `es-location-${active}` : undefined} onFocus={() => { setTyped(false); setActive(-1); onOpen(); }} onBlur={onClose} onChange={(event) => { onChange(event.target.value); setTyped(true); setActive(-1); onOpen(); }} onKeyDown={handleKeyDown} /></span>
    {value && <button type="button" className="es-location-clear" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onChange(''); setTyped(true); onOpen(); inputRef.current?.focus(); }} aria-label="Clear location"><Icon name="xmark" /></button>}
    {showList && <ul id="es-location-list" className="es-popover es-location-list" role="listbox" aria-labelledby="es-location-label">{matches.map(([name, hint], index) => <li key={name} id={`es-location-${index}`} role="option" aria-selected={index === active} className={index === active ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={(event) => { event.stopPropagation(); choose(name); }}><span className="es-location-pin"><Icon name="location-dot" /></span><span><strong>{name}</strong><small>{hint}</small></span></li>)}</ul>}
  </div>;
};

// Month calendar used instead of the native date picker, whose position the
// page cannot control (the home hero needs it to open upwards).
const Calendar = ({ label, value, min, rangeStart, rangeEnd, onSelect }) => {
  const start = fromISO(value || min);
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const minDate = fromISO(min);
  const canGoBack = view.year > minDate.getFullYear() || (view.year === minDate.getFullYear() && view.month > minDate.getMonth());
  const shift = (step) => setView(({ year, month }) => {
    const date = new Date(year, month + step, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const offset = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const today = todayISO();
  const title = new Date(view.year, view.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  // Clicks and keys stay inside: the date field around it toggles on both.
  return <div className="es-popover es-calendar" role="dialog" aria-label={`Choose ${label} date`} onMouseDown={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <div className="es-calendar-head"><button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month"><Icon name="chevron-left" /></button><strong aria-live="polite">{title}</strong><button type="button" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron-right" /></button></div>
    <div className="es-calendar-grid">
      {WEEKDAYS.map((day) => <span key={day} className="es-calendar-weekday">{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`gap-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const iso = isoDay(view.year, view.month, index + 1);
        const classes = [
          iso === today && 'is-today',
          iso === value && 'is-selected',
          iso === rangeStart && 'is-start',
          iso === rangeEnd && 'is-end',
          rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd && 'in-range',
        ].filter(Boolean).join(' ');
        return <button key={iso} type="button" className={classes} disabled={iso < min} aria-pressed={iso === value} aria-label={fromISO(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onClick={() => onSelect(iso)}>{index + 1}</button>;
      })}
    </div>
  </div>;
};

const DateField = ({ label, value, hint, open, onToggle, children }) => <div className={`es-search-field es-date-field ${open ? 'is-open' : ''}`} role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={open} onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); } }}>
  <Icon name="calendar-days" />
  <span className="es-search-copy"><span>{label}</span><strong>{formatDate(value)}{hint && <small>{hint}</small>}</strong></span>
  {open && children}
</div>;

const GuestStepper = ({ value, onChange, onInteract }) => <div className="es-search-field es-guests-field" onMouseDown={onInteract}><Icon name="user-group" /><span className="es-search-copy"><span>Guests</span><strong aria-live="polite">{value} Guest{value > 1 ? 's' : ''}</strong></span><div className="es-stepper"><button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Remove a guest"><Icon name="minus" /></button><button type="button" onClick={() => onChange(Math.min(16, value + 1))} disabled={value >= 16} aria-label="Add a guest"><Icon name="plus" /></button></div></div>;

// Controlled search bar. `placement` sets whether popovers open below
// ("bottom") or above ("top") the bar.
const StaySearchForm = ({ destination, checkIn, checkOut, guests, onDestinationChange, onCheckInChange, onCheckOutChange, onGuestsChange, onSubmit, placement = 'bottom', className = '', style }) => {
  const formRef = useRef(null);
  const [openField, setOpenField] = useState(null);

  useEffect(() => {
    if (!openField) return undefined;
    const closeOutside = (event) => { if (!formRef.current?.contains(event.target)) setOpenField(null); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpenField(null); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openField]);

  const today = todayISO();
  const nights = nightsBetween(checkIn, checkOut);
  const toggle = (field) => setOpenField((current) => current === field ? null : field);
  // Choosing a check-in moves straight on to the check-out calendar.
  const pickCheckIn = (iso) => {
    onCheckInChange(iso);
    if (!checkOut || checkOut <= iso) onCheckOutChange(addDays(iso, 1));
    setOpenField('checkOut');
  };
  const pickCheckOut = (iso) => { onCheckOutChange(iso); setOpenField(null); };
  const submit = (event) => { event.preventDefault(); setOpenField(null); onSubmit(); };

  return <form ref={formRef} className={`es-search ${placement === 'top' ? 'is-top' : ''} ${className}`} style={style} onSubmit={submit} role="search">
    <LocationInput value={destination} onChange={onDestinationChange} open={openField === 'location'} onOpen={() => setOpenField('location')} onClose={() => setOpenField((current) => current === 'location' ? null : current)} />
    <DateField label="Check In" value={checkIn} open={openField === 'checkIn'} onToggle={() => toggle('checkIn')}>
      <Calendar label="check-in" value={checkIn} min={today} rangeStart={checkIn} rangeEnd={checkOut} onSelect={pickCheckIn} />
    </DateField>
    <DateField label="Check Out" value={checkOut} hint={nights ? `${nights} night${nights > 1 ? 's' : ''}` : ''} open={openField === 'checkOut'} onToggle={() => toggle('checkOut')}>
      <Calendar label="check-out" value={checkOut} min={addDays(checkIn || today, 1)} rangeStart={checkIn} rangeEnd={checkOut} onSelect={pickCheckOut} />
    </DateField>
    <GuestStepper value={guests} onChange={onGuestsChange} onInteract={() => setOpenField(null)} />
    <button type="submit" className="es-search-submit"><Icon name="magnifying-glass" /><span>Search</span></button>
  </form>;
};

export default StaySearchForm;
