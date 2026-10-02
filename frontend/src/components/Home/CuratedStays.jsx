import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { stayFilters, stays } from './homeData';

const WISHLIST_KEY = 'hp-wishlist';

const loadWishlist = () => {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || {};
  } catch {
    return {};
  }
};

const sorters = {
  popular: () => 0, // keep the curated order
  'price-asc': (a, b) => a.priceValue - b.priceValue,
  'price-desc': (a, b) => b.priceValue - a.priceValue,
  rating: (a, b) => b.rating - a.rating,
};

const StayCard = ({ stay, index, saved, onToggleSave, onMapView }) => {
  const navigate = useNavigate();
  const [bounce, setBounce] = useState(false);

  const openDetails = () => navigate(`/property/${stay.id}`, { state: { property: stay } });

  const toggleSave = (e) => {
    e.stopPropagation();
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
    onToggleSave(stay.id);
  };

  return (
    <article className="hp-stay-card hp-reveal" style={{ '--d': `${(index % 4) * 0.08}s` }}>
      <div className="hp-stay-media" onClick={openDetails}>
        <img src={stay.image} alt={stay.name} loading="lazy" style={stay.imagePosition ? { objectPosition: stay.imagePosition } : undefined} />
        <span className="hp-stay-type">{stay.type}</span>
        <button
          type="button"
          className={`hp-heart ${saved ? 'is-saved' : ''} ${bounce ? 'is-bouncing' : ''}`}
          onClick={toggleSave}
          aria-label={saved ? `Remove ${stay.name} from wishlist` : `Save ${stay.name} to wishlist`}
          aria-pressed={saved}
        >
          <i className={`fa-${saved ? 'solid' : 'regular'} fa-heart`}></i>
        </button>
      </div>

      <div className="hp-stay-body">
        <div className="hp-stay-row">
          <span className="hp-stay-price">{stay.price}<small> /night</small></span>
          <span className="hp-stay-rating">
            <i className="fa-solid fa-star"></i> {stay.rating.toFixed(1)} <small>({stay.reviewsCount})</small>
          </span>
        </div>
        <h3 className="hp-stay-name" onClick={openDetails}>{stay.name}</h3>
        <p className="hp-stay-loc"><i className="fa-solid fa-location-dot"></i> {stay.location}</p>
        <div className="hp-stay-actions">
          <button type="button" className="hp-btn-dark" onClick={openDetails}>
            <i className="fa-regular fa-eye"></i> View Details
          </button>
          <button type="button" className="hp-btn-ghost" onClick={() => onMapView(stay.id)}>
            <i className="fa-regular fa-map"></i> Map View
          </button>
        </div>
      </div>
    </article>
  );
};

const CuratedStays = ({ filter, onFilterChange, onMapView }) => {
  const [sort, setSort] = useState('popular');
  const [wishlist, setWishlist] = useState(loadWishlist);

  const visible = useMemo(
    () => stays.filter((s) => filter === 'All' || s.type === filter).sort(sorters[sort]),
    [filter, sort]
  );

  const toggleSave = (id) => {
    setWishlist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory only */
      }
      return next;
    });
  };

  return (
    <section className="hp-section hp-stays" id="hp-stays">
      <div className="hp-container">
        <div className="hp-section-head hp-reveal">
          <div>
            <span className="hp-eyebrow">Our Curated Collection</span>
            <h2 className="hp-title">Explore <span className="hp-gold">Exceptional</span> Stays</h2>
          </div>
          <div className="hp-stay-tools">
            <div className="hp-chips" role="tablist" aria-label="Filter stays">
              {stayFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`hp-chip ${filter === f.key ? 'is-active' : ''}`}
                  onClick={() => onFilterChange(f.key)}
                >
                  <i className={`fa-solid ${f.icon}`}></i> {f.label}
                </button>
              ))}
            </div>
            <label className="hp-sort">
              <span className="hp-sr-only">Sort stays</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="popular">Sort by: Popular</option>
                <option value="rating">Sort by: Top Rated</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </label>
          </div>
        </div>

        <div className="hp-stay-grid" key={`${filter}-${sort}`}>
          {visible.map((stay, i) => (
            <StayCard
              key={stay.id}
              stay={stay}
              index={i}
              saved={!!wishlist[stay.id]}
              onToggleSave={toggleSave}
              onMapView={onMapView}
            />
          ))}
        </div>

        <div className="hp-stays-more hp-reveal">
          <Link to="/explore" className="hp-btn-outline">
            View All Stays <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CuratedStays;
