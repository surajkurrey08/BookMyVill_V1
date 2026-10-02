import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { destinations } from './homeData';

const HillStations = () => {
  const trackRef = useRef(null);
  const navigate = useNavigate();
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
    const card = el.querySelector('.hp-dest-card');
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section className="hp-section hp-destinations" id="hp-destinations">
      <div className="hp-container">
        <div className="hp-section-head hp-reveal">
          <div>
            <span className="hp-eyebrow">Popular Destinations</span>
            <h2 className="hp-title">Top Hill Stations Near <span className="hp-gold">Mahabaleshwar</span></h2>
            <p className="hp-lead">Explore the most beautiful places, scenic viewpoints and must-visit locations around Mahabaleshwar.</p>
          </div>
          <div className="hp-arrows">
            <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Previous destinations">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Next destinations">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div className="hp-dest-track" ref={trackRef} onScroll={updateEdges}>
          {destinations.map((dest, i) => (
            <button
              key={dest.name}
              type="button"
              className="hp-dest-card hp-reveal"
              style={{ '--d': `${Math.min(i, 3) * 0.08}s` }}
              onClick={() => navigate(`/explore?search=${encodeURIComponent(dest.name)}`)}
            >
              <img src={dest.image} alt={dest.name} loading="lazy" />
              <span className="hp-dest-shade"></span>
              <span className="hp-dest-info">
                <span>
                  <strong>{dest.name}</strong>
                  <small>{dest.tagline}</small>
                </span>
                <span className="hp-dest-go"><i className="fa-solid fa-arrow-right"></i></span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HillStations;
