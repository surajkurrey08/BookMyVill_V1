import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './HeroOffers.css';

const SLIDE_MS = 6000;

// Loads the live offers that the admin manages in Admin > Hero Offers, and drives the slideshow.
export function useHeroOffers() {
  const [offers, setOffers] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/admin/offers/public`, { signal: controller.signal, cache: 'no-store' })
      .then(response => (response.ok ? response.json() : { offers: [] }))
      .then(result => setOffers(Array.isArray(result.offers) ? result.offers : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const count = offers.length;
  const go = useCallback(step => setIndex(current => (current + step + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setIndex(current => (current + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, paused, index]);

  useEffect(() => { if (index >= count && count) setIndex(0); }, [count, index]);

  return { offers, index, setIndex, go, setPaused };
}

// Full-bleed background pictures that cross-fade. Offers without a picture show the page's normal background.
export function OfferBackdrop({ offers, index, fallback }) {
  if (!offers.length) return null;
  return (
    <div className="ho-backdrop" aria-hidden="true">
      {offers.map((offer, i) => (
        <div key={offer.id} className={`ho-slide ${i === index ? 'is-active' : ''}`} style={{ backgroundImage: `url(${offer.imageUrl ? `${API_BASE_URL}${offer.imageUrl}` : fallback})` }} />
      ))}
    </div>
  );
}

function OfferButton({ offer }) {
  if (!offer.ctaLabel || !offer.ctaLink) return null;
  const external = /^https?:\/\//.test(offer.ctaLink);
  return external
    ? <a className="ho-cta" href={offer.ctaLink} target="_blank" rel="noopener noreferrer">{offer.ctaLabel} →</a>
    : <Link className="ho-cta" to={offer.ctaLink}>{offer.ctaLabel} →</Link>;
}

// The offer text, arrows and dots shown over the background.
export function OfferBanner({ offers, index, setIndex, go, setPaused }) {
  if (!offers.length) return null;
  const offer = offers[index];
  return (
    <div className="ho-banner" role="region" aria-roledescription="carousel" aria-label="Current offers" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {offers.length > 1 && <button type="button" className="ho-arrow" onClick={() => go(-1)} aria-label="Previous offer">‹</button>}
      <div className="ho-card" key={offer.id} aria-live="polite">
        {offer.badge && <span className="ho-badge">{offer.badge}</span>}
        <strong className="ho-title">{offer.title}</strong>
        {offer.subtitle && <span className="ho-sub">{offer.subtitle}</span>}
        <OfferButton offer={offer} />
      </div>
      {offers.length > 1 && <button type="button" className="ho-arrow" onClick={() => go(1)} aria-label="Next offer">›</button>}
      {offers.length > 1 && (
        <div className="ho-dots" role="tablist" aria-label="Choose offer">
          {offers.map((item, i) => <button type="button" key={item.id} role="tab" aria-selected={i === index} aria-label={`Offer ${i + 1}: ${item.title}`} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)} />)}
        </div>
      )}
    </div>
  );
}
