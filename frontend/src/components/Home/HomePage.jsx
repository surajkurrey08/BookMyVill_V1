import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHeader from './HomeHeader';
import HomeHero from './HomeHero';
import HillStations from './HillStations';
import CuratedStays from './CuratedStays';
import LocationsMap from './LocationsMap';
import ExperienceBanner from './ExperienceBanner';
import Testimonials from './Testimonials';
import HomeFooter from './HomeFooter';
import { scrollToId } from './scroll';
import './Home.css';

// Fades `.hp-reveal` elements in as they enter the viewport, including ones
// mounted later (e.g. after a stay filter change).
const useReveal = (rootRef) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    if (!('IntersectionObserver' in window)) {
      root.querySelectorAll('.hp-reveal').forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add('is-visible');
            io.unobserve(el);
            // Drop the stagger delay once revealed so hover effects respond instantly.
            el.addEventListener('transitionend', () => el.style.setProperty('--d', '0s'), { once: true });
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const observeAll = () =>
      root.querySelectorAll('.hp-reveal:not(.is-visible)').forEach((el) => io.observe(el));
    observeAll();

    const mo = new MutationObserver(observeAll);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [rootRef]);
};

const HomePage = () => {
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const [stayFilter, setStayFilter] = useState('All');
  const [mapFocus, setMapFocus] = useState(null);

  useReveal(rootRef);

  // Land directly on the right section when the page is opened with a
  // section hash in the URL (e.g. a bookmarked or shared "/#hp-stays" link).
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      requestAnimationFrame(() => scrollToId(id));
    }
  }, []);

  const handleCategory = (action) => {
    if (action.route) {
      navigate(action.route);
      return;
    }
    if (action.filter) setStayFilter(action.filter);
    if (action.layer) setMapFocus({ layer: action.layer, at: Date.now() });
    scrollToId(action.scroll);
  };

  const handleMapView = (id) => {
    setMapFocus({ id, at: Date.now() });
    scrollToId('hp-map');
  };

  return (
    <div className="hp-root" ref={rootRef}>
      <HomeHeader />
      <main>
        <HomeHero onCategory={handleCategory} />
        <HillStations />
        <CuratedStays filter={stayFilter} onFilterChange={setStayFilter} onMapView={handleMapView} />
        <section className="hp-section hp-map-section">
          <div className="hp-container hp-map-split">
            <LocationsMap focus={mapFocus} />
            <ExperienceBanner />
          </div>
        </section>
        <Testimonials />
      </main>
      <HomeFooter />
    </div>
  );
};

export default HomePage;
