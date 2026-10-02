import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories, destinations, images, stays } from './homeData';
import useSiteHero from '../../hooks/useSiteHero';

const toISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + days));
};

const formatDate = (iso) => {
  if (!iso) return 'Add date';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const locationOptions = Array.from(
  new Set([...destinations.map((d) => d.name), ...stays.map((s) => s.location)])
).sort();

const DateField = ({ label, value, min, onChange }) => {
  const inputRef = useRef(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        /* fall through to focus */
      }
    }
    input.focus();
  };

  return (
    <div className="hp-search-field hp-search-date" onClick={openPicker}>
      <i className="fa-regular fa-calendar"></i>
      <div className="hp-search-text">
        <span className="hp-search-label">{label}</span>
        <span className="hp-search-value">{formatDate(value)}</span>
      </div>
      <input
        ref={inputRef}
        type="date"
        className="hp-date-native"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        tabIndex={-1}
      />
    </div>
  );
};

const Counter = ({ label, hint, value, min, max, onChange }) => (
  <div className="hp-counter">
    <div>
      <strong>{label}</strong>
      <span>{hint}</span>
    </div>
    <div className="hp-counter-ctrl">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>+</button>
    </div>
  </div>
);

const HomeHero = ({ onCategory }) => {
  const heroImage = useSiteHero('home', images.heroVilla);
  const navigate = useNavigate();
  const today = toISO(new Date());
  const [location, setLocation] = useState('Mahabaleshwar');
  const [checkIn, setCheckIn] = useState(() => addDays(today, 1));
  const [checkOut, setCheckOut] = useState(() => addDays(today, 3));
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const guestsRef = useRef(null);

  useEffect(() => {
    if (!guestsOpen) return undefined;
    const onClick = (e) => {
      if (guestsRef.current && !guestsRef.current.contains(e.target)) setGuestsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [guestsOpen]);

  const handleCheckIn = (value) => {
    setCheckIn(value);
    if (value && checkOut && checkOut <= value) setCheckOut(addDays(value, 1));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.append('search', location.trim());
    if (checkIn) params.append('checkIn', checkIn);
    if (checkOut) params.append('checkOut', checkOut);
    params.append('guests', String(guests));
    params.append('rooms', String(rooms));
    navigate(`/explore?${params.toString()}`);
  };

  return (
    <section className="hp-hero" id="hp-top">
      <div className="hp-hero-bg" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true"></div>
      <div className="hp-hero-shade" aria-hidden="true"></div>

      <div className="hp-hero-content">
        <span className="hp-eyebrow hp-hero-eyebrow hp-rise" style={{ '--d': '0.1s' }}>Discover Mahabaleshwar</span>
        <h1 className="hp-hero-title hp-rise" style={{ '--d': '0.2s' }}>
          Your Luxury Escape
          <span className="hp-gold">Above the Clouds</span>
        </h1>
        <p className="hp-hero-sub hp-rise" style={{ '--d': '0.35s' }}>
          Breathe fresh air, explore scenic valleys, stay at handpicked hotels and create memories that last forever.
        </p>

        <form className="hp-search hp-rise" style={{ '--d': '0.5s' }} onSubmit={handleSearch}>
          <label className="hp-search-field hp-search-where">
            <i className="fa-solid fa-location-dot"></i>
            <div className="hp-search-text">
              <span className="hp-search-label">Where do you want to go?</span>
              <input
                className="hp-search-input"
                list="hp-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Search a place"
              />
              <datalist id="hp-locations">
                {locationOptions.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>
          </label>

          <DateField label="Check In" value={checkIn} min={today} onChange={handleCheckIn} />
          <DateField label="Check Out" value={checkOut} min={checkIn ? addDays(checkIn, 1) : today} onChange={setCheckOut} />

          <div className="hp-search-field hp-search-guests" ref={guestsRef}>
            <button type="button" className="hp-guests-trigger" onClick={() => setGuestsOpen((o) => !o)} aria-expanded={guestsOpen}>
              <i className="fa-solid fa-user"></i>
              <div className="hp-search-text">
                <span className="hp-search-label">Guests</span>
                <span className="hp-search-value">
                  {guests} Guest{guests > 1 ? 's' : ''} • {rooms} Room{rooms > 1 ? 's' : ''}
                </span>
              </div>
            </button>
            {guestsOpen && (
              <div className="hp-guests-pop">
                <Counter label="Guests" hint="Adults & children" value={guests} min={1} max={16} onChange={setGuests} />
                <Counter label="Rooms" hint="Max 4 guests / room" value={rooms} min={1} max={8} onChange={setRooms} />
                <button type="button" className="hp-guests-done" onClick={() => setGuestsOpen(false)}>Done</button>
              </div>
            )}
          </div>

          <button type="submit" className="hp-search-btn">
            <i className="fa-solid fa-magnifying-glass"></i> Search
          </button>
        </form>

        <div className="hp-categories">
          {categories.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              className="hp-category hp-rise"
              style={{ '--d': `${0.6 + i * 0.06}s` }}
              onClick={() => onCategory(cat.action)}
            >
              <span className="hp-category-img">
                <img src={cat.image} alt="" loading="lazy" />
              </span>
              <span className="hp-category-label">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
