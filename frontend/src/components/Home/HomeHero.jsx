import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { categories, images } from './homeData';
import useSiteHero from '../../hooks/useSiteHero';
import StaySearchForm from '../StaySearch/StaySearchForm';
import { DEFAULT_LOCATION, addDays, todayISO } from '../StaySearch/searchUtils';

const HomeHero = ({ onCategory }) => {
  const heroImage = useSiteHero('home', images.heroVilla);
  const navigate = useNavigate();
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [checkIn, setCheckIn] = useState(() => addDays(todayISO(), 1));
  const [checkOut, setCheckOut] = useState(() => addDays(todayISO(), 3));
  const [guests, setGuests] = useState(1);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const storyDialogRef = useRef(null);
  const storyOpen = activeStoryIndex !== null;

  useEffect(() => {
    if (!storyOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const handleKeyDown = event => {
      if (event.key === 'Escape') setActiveStoryIndex(null);
      if (event.key === 'ArrowRight') setActiveStoryIndex(current => (current + 1) % categories.length);
      if (event.key === 'ArrowLeft') setActiveStoryIndex(current => (current - 1 + categories.length) % categories.length);
      if (event.key === 'Tab') {
        const focusable = [...(storyDialogRef.current?.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [storyOpen]);

  // Explore Stays reads these parameters, shows the searched place and
  // scrolls to its results.
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location.trim()) params.set('search', location.trim());
    if (selectedPlace?.placeId) params.set('placeId', selectedPlace.placeId);
    if (
      selectedPlace?.lat !== undefined &&
      selectedPlace?.lat !== null &&
      selectedPlace?.lng !== undefined &&
      selectedPlace?.lng !== null &&
      !isNaN(selectedPlace.lat) &&
      !isNaN(selectedPlace.lng)
    ) {
      params.set('lat', String(selectedPlace.lat));
      params.set('lng', String(selectedPlace.lng));
    }
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', String(guests));
    navigate(params.toString() ? `/explore?${params}` : '/explore');
  };

  const activeStory = activeStoryIndex === null ? null : categories[activeStoryIndex];
  const moveStory = direction => setActiveStoryIndex(current => (current + direction + categories.length) % categories.length);
  const continueFromStory = () => {
    const action = activeStory.action;
    setActiveStoryIndex(null);
    requestAnimationFrame(() => onCategory(action));
  };

  return (
    <>
      <section className="hp-hero" id="hp-top">
        <div className="hp-hero-bg" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true"></div>
        <div className="hp-hero-shade" aria-hidden="true"></div>

        <div className="hp-hero-content">
          <span className="hp-eyebrow hp-hero-eyebrow hp-rise" style={{ '--d': '0.1s' }}>Discover Mahabaleshwar</span>
          <h1 className="hp-hero-title hp-rise" style={{ '--d': '0.2s' }}>
            Book Your Villa
            <span className="hp-gold">in Mahabaleshwar</span>
          </h1>
          <p className="hp-hero-sub hp-rise" style={{ '--d': '0.35s' }}>
            Explore handpicked villas, resorts and holiday stays in Mahabaleshwar for your next hill-station getaway.
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
            onPlaceChange={setSelectedPlace}
            onCheckInChange={setCheckIn}
            onCheckOutChange={setCheckOut}
            onGuestsChange={setGuests}
            onSubmit={handleSearch}
          />

          <div className="hp-categories" aria-label="Villa discovery stories">
            {categories.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                className="hp-category hp-rise"
                style={{ '--d': `${0.6 + i * 0.06}s` }}
                onClick={() => setActiveStoryIndex(i)}
                aria-haspopup="dialog"
                aria-expanded={activeStoryIndex === i}
                aria-label={`View ${cat.label} story`}
              >
                <span className="hp-category-img">
                  <img src={cat.image} alt="" loading="lazy" />
                  <span className="hp-category-play" aria-hidden="true"><i className="fa-solid fa-play"></i></span>
                </span>
                <span className="hp-category-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeStory && createPortal(
        <div className="hp-story-overlay" onMouseDown={event => { if (event.currentTarget === event.target) setActiveStoryIndex(null); }}>
          <article ref={storyDialogRef} className="hp-story-card" role="dialog" aria-modal="true" aria-labelledby="hp-story-title">
            <div className="hp-story-progress" aria-hidden="true">
              {categories.map((category, index) => <span key={category.label} className={index === activeStoryIndex ? 'active' : index < activeStoryIndex ? 'seen' : ''}></span>)}
            </div>
            <button type="button" className="hp-story-close" onClick={() => setActiveStoryIndex(null)} aria-label="Close story" autoFocus>
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="hp-story-media">
              <img src={activeStory.image} alt="" />
              <div className="hp-story-media-shade" aria-hidden="true"></div>
              <span className="hp-story-number">Villa story {activeStoryIndex + 1} of {categories.length}</span>
              <span className="hp-story-media-note"><i className="fa-solid fa-house"></i> Complete villa booking</span>
            </div>

            <div className="hp-story-content" aria-live="polite">
              <span className="hp-story-eyebrow">{activeStory.story.eyebrow}</span>
              <h2 id="hp-story-title">{activeStory.story.title}</h2>
              <p>{activeStory.story.description}</p>
              <ul>
                {activeStory.story.highlights.map(item => <li key={item}><i className="fa-solid fa-circle-check"></i> {item}</li>)}
              </ul>
              <div className="hp-story-price-note">
                <i className="fa-solid fa-key"></i>
                <span><strong>One booking. The complete villa.</strong><small>The displayed villa price covers the full property for your group.</small></span>
              </div>
              <div className="hp-story-actions">
                <button type="button" className="hp-story-cta" onClick={continueFromStory}>{activeStory.story.cta} <i className="fa-solid fa-arrow-right"></i></button>
                <button type="button" className="hp-story-next" onClick={() => moveStory(1)}>Next story</button>
              </div>
            </div>

            <button type="button" className="hp-story-arrow prev" onClick={() => moveStory(-1)} aria-label="Previous story"><i className="fa-solid fa-chevron-left"></i></button>
            <button type="button" className="hp-story-arrow next" onClick={() => moveStory(1)} aria-label="Next story"><i className="fa-solid fa-chevron-right"></i></button>
          </article>
        </div>,
        document.body
      )}
    </>
  );
};

export default HomeHero;
