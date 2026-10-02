import React, { useCallback, useEffect, useRef, useState } from 'react';
import { testimonials } from './homeData';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

const Testimonials = () => {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.hp-review');
    el.scrollBy({ left: dir * (card ? card.offsetWidth + 24 : 320), behavior: 'smooth' });
  };

  return (
    <section className="hp-section hp-reviews">
      <div className="hp-container">
        <div className="hp-reviews-head hp-reveal">
          <div className="hp-reviews-titles">
            <span className="hp-eyebrow">Guest Experiences &amp; Reviews</span>
            <h2 className="hp-title">What Traveler <span className="hp-gold">Guests Say</span></h2>
            <p className="hp-lead">Real stories from real travelers who experienced the beauty of Mahabaleshwar with us.</p>
          </div>
          <div className="hp-arrows">
            <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Previous reviews">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Next reviews">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div className="hp-review-track" ref={trackRef} onScroll={updateEdges}>
          {testimonials.map((t, i) => (
            <figure key={t.name} className="hp-review hp-reveal" style={{ '--d': `${Math.min(i, 2) * 0.1}s` }}>
              <i className="fa-solid fa-quote-left hp-review-quote" aria-hidden="true"></i>
              <blockquote>“{t.text}”</blockquote>
              <figcaption>
                <span className="hp-review-avatar" aria-hidden="true">{initials(t.name)}</span>
                <span className="hp-review-who">
                  <strong>{t.name}</strong>
                  <small>{t.city}</small>
                </span>
                <span className="hp-review-stars" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <i key={s} className={`fa-${s < t.rating ? 'solid' : 'regular'} fa-star`}></i>
                  ))}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
