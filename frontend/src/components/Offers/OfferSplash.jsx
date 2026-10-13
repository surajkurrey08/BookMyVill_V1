import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OfferSplash.css';

const SHOW_MS = 8000;
const OPEN_DELAY_MS = 1500;
const MAX_SHOWS_PER_SESSION = 3;
const SHOW_COUNT_KEY = 'bmv-offer-splash-count';
const discountText = offer => offer.discountType === 'percent'
  ? `${offer.discountValue}% off`
  : offer.discountType === 'fixed' ? `Rs ${Number(offer.discountValue).toLocaleString('en-IN')} off` : '';

export default function OfferSplash() {
  const { pathname } = useLocation();
  const [offers, setOffers] = useState([]);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let showCount = 0;
    try { showCount = Number(sessionStorage.getItem(SHOW_COUNT_KEY) || 0); } catch {}
    if (showCount >= MAX_SHOWS_PER_SESSION) return undefined;
    const controller = new AbortController();
    let openTimer;
    fetch(`${API_BASE_URL}/api/admin/offers/public`, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : { offers: [] })
      .then(result => {
        const live = Array.isArray(result.offers) ? result.offers : [];
        if (!live.length) return;
        setOffers(live);
        openTimer = window.setTimeout(() => {
          setOpen(true);
          try { sessionStorage.setItem(SHOW_COUNT_KEY, String(showCount + 1)); } catch {}
        }, OPEN_DELAY_MS);
      }).catch(() => {});
    return () => { controller.abort(); window.clearTimeout(openTimer); };
  }, [pathname]);

  useEffect(() => {
    if (!open || paused) return undefined;
    const timer = window.setTimeout(() => setOpen(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [open, paused]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!open || !offers.length) return null;
  const close = () => setOpen(false);
  return (
    <div className="offer-splash" role="presentation" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <button className="offer-splash-backdrop" type="button" aria-label="Close offers" onClick={close} />
      <section className="offer-splash-dialog" role="dialog" aria-modal="true" aria-labelledby="offer-splash-title" onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
        <div className="offer-splash-heading"><div><span>Handpicked for your next escape</span><h2 id="offer-splash-title">A little more to love</h2></div><button type="button" onClick={close} aria-label="Close offers">&times;</button></div>
        <div className="offer-splash-cards">
          {offers.slice(0, 3).map(offer => {
            const destination = offer.ctaLink || '/explore';
            const text = discountText(offer);
            const external = /^https:\/\//.test(destination);
            return <article className="offer-splash-card" key={offer.id} style={offer.imageUrl ? { backgroundImage: `linear-gradient(0deg,rgba(8,28,21,.94),rgba(8,28,21,.1) 85%),url(${API_BASE_URL}${offer.imageUrl})` } : undefined}>
              <div className="offer-splash-card-copy">
                {(text || offer.badge) && <span className="offer-splash-badge">{text || offer.badge}</span>}
                <h3>{offer.title}</h3>
                {offer.subtitle && <p>{offer.subtitle}</p>}
                {external ? <a href={destination} target="_blank" rel="noopener noreferrer" onClick={close}>{offer.ctaLabel || 'Explore offer'} <span aria-hidden="true">&rarr;</span></a> : <Link to={destination} onClick={close}>{offer.ctaLabel || 'Explore offer'} <span aria-hidden="true">&rarr;</span></Link>}
              </div>
            </article>;
          })}
        </div>
        <p className="offer-splash-note">Eligible villa discounts appear automatically in your booking total.</p>
      </section>
    </div>
  );
}
