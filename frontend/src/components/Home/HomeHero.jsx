import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories, images } from './homeData';
import useSiteHero from '../../hooks/useSiteHero';
import StaySearchForm from '../StaySearch/StaySearchForm';
import { DEFAULT_LOCATION, addDays, todayISO } from '../StaySearch/searchUtils';

const HomeHero = ({ onCategory }) => {
  const heroImage = useSiteHero('home', images.heroVilla);
  const navigate = useNavigate();
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [checkIn, setCheckIn] = useState(() => addDays(todayISO(), 1));
  const [checkOut, setCheckOut] = useState(() => addDays(todayISO(), 3));
  const [guests, setGuests] = useState(2);

  // Explore Stays reads these parameters, shows the searched place and
  // scrolls to its results.
  const handleSearch = () => {
    const params = new URLSearchParams();
    params.set('search', location.trim());
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    params.set('guests', String(guests));
    navigate(`/explore?${params}`);
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

        {/* Popovers open upwards: the bar sits near the bottom of the hero. */}
        <StaySearchForm
          className="hp-hero-search hp-rise"
          style={{ '--d': '0.5s' }}
          placement="top"
          destination={location}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          onDestinationChange={setLocation}
          onCheckInChange={setCheckIn}
          onCheckOutChange={setCheckOut}
          onGuestsChange={setGuests}
          onSubmit={handleSearch}
        />

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
