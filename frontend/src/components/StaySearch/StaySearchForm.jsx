import { useEffect, useRef, useState, useTransition } from 'react';
import { addDays, formatDate, fromISO, isoDay, nightsBetween, todayISO, CURATED_LOCATIONS } from './searchUtils';
import { getPlacePredictions, getPlaceDetails, createSessionToken } from '../../services/googleMaps';
import './StaySearch.css';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const Icon = ({ name, className = '' }) => <i className={`fa-solid fa-${name} ${className}`} aria-hidden="true" />;

// Combobox with Google Places Autocomplete and fallback to curated Indian destinations
const LocationInput = ({ value, onChange, onPlaceSelect, open, onOpen, onClose }) => {
  const inputRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  const term = (value || '').trim().toLowerCase();

  // Filter fallback curated locations
  const curatedMatches = typed && term
    ? CURATED_LOCATIONS.filter(([name]) => name.toLowerCase().includes(term))
    : CURATED_LOCATIONS;

  // Decide what to display: Google predictions if available, else curated matches
  const hasPredictions = predictions.length > 0;
  const showList = open;

  // Fetch Google Places predictions when typed
  useEffect(() => {
    if (!typed) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    if (term.length < 2) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createSessionToken();
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getPlacePredictions(value, sessionTokenRef.current);
        startTransition(() => {
          setPredictions(results || []);
          setIsLoading(false);
          setActive(-1);
        });
      } catch {
        startTransition(() => {
          setPredictions([]);
          setIsLoading(false);
        });
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, typed, term]);

  const choosePrediction = async (prediction) => {
    // 1. Visible input is updated immediately
    onChange(prediction.mainText || prediction.description);
    setTyped(false);
    setActive(-1);
    onClose();

    // 2. Fetch full place details (lat, lng, formattedAddress)
    try {
      const details = await getPlaceDetails(prediction);
      sessionTokenRef.current = null; // Reset session token after selection
      if (details) {
        onPlaceSelect?.({
          placeId: details.placeId || prediction.placeId,
          name: prediction.mainText || details.name,
          formattedAddress: details.formattedAddress || prediction.description,
          lat: details.lat,
          lng: details.lng,
        });
      } else {
        onPlaceSelect?.({
          placeId: prediction.placeId,
          name: prediction.mainText || prediction.description,
          formattedAddress: prediction.description,
        });
      }
    } catch {
      onPlaceSelect?.({
        placeId: prediction.placeId,
        name: prediction.mainText || prediction.description,
        formattedAddress: prediction.description,
      });
    }
  };

  const chooseCurated = (name) => {
    onChange(name);
    setTyped(false);
    setActive(-1);
    onClose();
    sessionTokenRef.current = null;
    onPlaceSelect?.({
      placeId: '',
      name,
      formattedAddress: `${name}, Maharashtra, India`,
    });
  };

  const currentCount = hasPredictions ? predictions.length : curatedMatches.length;

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onOpen();
      setActive((index) => Math.min(index + 1, currentCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (showList && active >= 0 && active < currentCount) {
        event.preventDefault();
        if (hasPredictions) {
          choosePrediction(predictions[active]);
        } else {
          chooseCurated(curatedMatches[active][0], curatedMatches[active][1]);
        }
      }
      // If active === -1, let the enclosing form handle Enter to search with manual text
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  const handleInputChange = (event) => {
    const val = event.target.value;
    onChange(val);
    setTyped(true);
    setActive(-1);
    // Editing after selecting invalidates previous place metadata
    onPlaceSelect?.(null);
    onOpen();
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange('');
    setTyped(true);
    setPredictions([]);
    setActive(-1);
    onPlaceSelect?.(null);
    onOpen();
    inputRef.current?.focus();
  };

  return (
    <div className="es-search-field es-location-field" onClick={() => inputRef.current?.focus()}>
      <Icon name="location-dot" />
      <span className="es-search-copy">
        <span id="es-location-label">Location</span>
        <input
          ref={inputRef}
          value={value}
          placeholder="Where to? (e.g. Mahabaleshwar)"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-labelledby="es-location-label"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="es-location-list"
          aria-activedescendant={showList && active >= 0 ? `es-location-${active}` : undefined}
          onFocus={() => {
            setTyped(false);
            setActive(-1);
            onOpen();
          }}
          onBlur={onClose}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </span>
      {value && (
        <button
          type="button"
          className="es-location-clear"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
          aria-label="Clear location"
        >
          <Icon name="xmark" />
        </button>
      )}

      {showList && (
        <div id="es-location-list" className="es-popover es-location-popover" role="listbox" aria-labelledby="es-location-label">
          {isLoading && (
            <div className="es-location-loading">
              <Icon name="spinner" className="fa-spin" />
              <span>Finding destinations...</span>
            </div>
          )}

          <ul className="es-location-list">
            {hasPredictions ? (
              predictions.map((p, index) => (
                <li
                  key={p.placeId || index}
                  id={`es-location-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={(event) => {
                    event.stopPropagation();
                    choosePrediction(p);
                  }}
                >
                  <span className="es-location-pin">
                    <Icon name="location-dot" />
                  </span>
                  <span>
                    <strong>{p.mainText}</strong>
                    {p.secondaryText && <small>{p.secondaryText}</small>}
                  </span>
                </li>
              ))
            ) : curatedMatches.length > 0 ? (
              curatedMatches.map(([name, hint], index) => (
                <li
                  key={name}
                  id={`es-location-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseCurated(name, hint);
                  }}
                >
                  <span className="es-location-pin">
                    <Icon name="location-dot" />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{hint}</small>
                  </span>
                </li>
              ))
            ) : (
              <li className="es-location-empty">
                <span>No suggestions found for "{value}". Press Enter or Search to find stays.</span>
              </li>
            )}
          </ul>

          {hasPredictions && (
            <div className="es-google-attribution">
              <span>Google Maps Platform</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Month calendar used instead of the native date picker
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

  return (
    <div className="es-popover es-calendar" role="dialog" aria-label={`Choose ${label} date`} onMouseDown={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="es-calendar-head">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month"><Icon name="chevron-left" /></button>
        <strong aria-live="polite">{title}</strong>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron-right" /></button>
      </div>
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
          return (
            <button
              key={iso}
              type="button"
              className={classes}
              disabled={iso < min}
              aria-pressed={iso === value}
              aria-label={fromISO(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              onClick={() => onSelect(iso)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DateField = ({ label, value, hint, open, onToggle, children }) => (
  <div className={`es-search-field es-date-field ${open ? 'is-open' : ''}`} role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={open} onClick={(event) => { event.stopPropagation(); onToggle(); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); } }}>
    <Icon name="calendar-days" />
    <span className="es-search-copy"><span>{label}</span><strong>{formatDate(value)}{hint && <small>{hint}</small>}</strong></span>
    {open && children}
  </div>
);

const GuestStepper = ({ value, onChange, onInteract }) => (
  <div className="es-search-field es-guests-field" onMouseDown={onInteract}>
    <Icon name="user-group" />
    <span className="es-search-copy"><span>Guests</span><strong aria-live="polite">{value} Guest{value > 1 ? 's' : ''}</strong></span>
    <div className="es-stepper">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Remove a guest"><Icon name="minus" /></button>
      <button type="button" onClick={() => onChange(Math.min(16, value + 1))} disabled={value >= 16} aria-label="Add a guest"><Icon name="plus" /></button>
    </div>
  </div>
);

// Controlled search bar with Google Maps Location Autocomplete support
const StaySearchForm = ({
  destination,
  checkIn,
  checkOut,
  guests,
  onDestinationChange,
  onPlaceChange,
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
  onSubmit,
  placement = 'bottom',
  className = '',
  style,
}) => {
  const formRef = useRef(null);
  const [openField, setOpenField] = useState(null);
  const [activePlacement, setActivePlacement] = useState(placement);

  useEffect(() => {
    if (!openField || !formRef.current) return;
    const rect = formRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (placement === 'top') {
      if (spaceAbove < 340 && spaceBelow >= 280) {
        setActivePlacement('bottom');
      } else {
        setActivePlacement('top');
      }
    } else {
      if (spaceBelow < 340 && spaceAbove >= 280) {
        setActivePlacement('top');
      } else {
        setActivePlacement('bottom');
      }
    }
  }, [openField, placement]);

  useEffect(() => {
    if (!openField) return undefined;
    const closeOutside = (event) => {
      if (!formRef.current?.contains(event.target)) setOpenField(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenField(null);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openField]);

  const today = todayISO();
  const nights = nightsBetween(checkIn, checkOut);
  const toggle = (field) => setOpenField((current) => (current === field ? null : field));

  const pickCheckIn = (iso) => {
    onCheckInChange(iso);
    if (!checkOut || checkOut <= iso) onCheckOutChange(addDays(iso, 1));
    setOpenField('checkOut');
  };
  const pickCheckOut = (iso) => {
    onCheckOutChange(iso);
    setOpenField(null);
  };
  const submit = (event) => {
    event.preventDefault();
    setOpenField(null);
    onSubmit();
  };

  return (
    <form
      ref={formRef}
      className={`es-search ${activePlacement === 'top' ? 'is-top' : ''} ${className}`}
      style={style}
      onSubmit={submit}
      role="search"
    >
      <LocationInput
        value={destination}
        onChange={onDestinationChange}
        onPlaceSelect={onPlaceChange}
        open={openField === 'location'}
        onOpen={() => setOpenField('location')}
        onClose={() => setOpenField((current) => (current === 'location' ? null : current))}
      />
      <DateField label="Check In" value={checkIn} open={openField === 'checkIn'} onToggle={() => toggle('checkIn')}>
        <Calendar label="check-in" value={checkIn} min={today} rangeStart={checkIn} rangeEnd={checkOut} onSelect={pickCheckIn} />
      </DateField>
      <DateField label="Check Out" value={checkOut} hint={nights ? `${nights} night${nights > 1 ? 's' : ''}` : ''} open={openField === 'checkOut'} onToggle={() => toggle('checkOut')}>
        <Calendar label="check-out" value={checkOut} min={addDays(checkIn || today, 1)} rangeStart={checkIn} rangeEnd={checkOut} onSelect={pickCheckOut} />
      </DateField>
      <GuestStepper value={guests} onChange={onGuestsChange} onInteract={() => setOpenField(null)} />
      <button type="submit" className="es-search-submit">
        <Icon name="magnifying-glass" />
        <span>Search</span>
      </button>
    </form>
  );
};

export default StaySearchForm;
