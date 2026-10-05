import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import HomeFooter from '../Home/HomeFooter';
import { stays, testimonials } from '../Home/homeData';
import { properties as mockProperties } from '../../data/mockData';
import { API_BASE_URL } from '../../config';
import defaultHeroImage from '../../assets/hero_page1.png';
import useSiteHero from '../../hooks/useSiteHero';
import StaySearchForm from '../StaySearch/StaySearchForm';
import { DEFAULT_LOCATION, addDays, todayISO } from '../StaySearch/searchUtils';
import '../Home/Home.css';
import './ExploreStaysPage.css';

const PAGE_SIZE = 6;
const PRICE_LIMIT = 25000;
const emptyFilters = () => ({ types: [], amenities: [], idealFor: [], rating: 0, maxPrice: PRICE_LIMIT });
const typeOptions = [
  ['Villas', 'Villa'], ['Resorts', 'Resort'], ['Cottages', 'Cottage'],
  ['Homestays', 'Homestay'], ['Budget Stays', 'Budget'], ['Luxury Stays', 'Luxury'],
];
const amenityOptions = ['Swimming Pool', 'Breakfast Included', 'WiFi', 'Parking', 'AC Rooms', 'Pet Friendly', 'Bonfire', 'Mountain View'];
const idealOptions = ['Family', 'Couples', 'Group', 'Solo'];
const curatedImages = [stays[3].image, stays[2].image, stays[1].image, stays[4].image, stays[2].image, stays[0].image, stays[6].image, stays[7].image];
const Icon = ({ name }) => <i className={`fa-solid fa-${name}`} aria-hidden="true" />;
const numberPrice = (value) => typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d]/g, '')) || 0;
const priceLabel = (value) => `₹${value.toLocaleString('en-IN')}`;
const imageUrl = (value, fallback) => {
  if (!value || typeof value !== 'string') return fallback;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return value.startsWith('/') ? `${API_BASE_URL}${value}` : fallback;
};
const normalizeStay = (item, index, source) => {
  const image = source === 'database' ? imageUrl(item.photos?.[0] || item.image, curatedImages[index % curatedImages.length]) : curatedImages[index % curatedImages.length];
  const amenities = Array.isArray(item.amenities) && item.amenities.length ? item.amenities : source === 'mock' ? ['WiFi', index % 2 ? 'Breakfast Included' : 'Parking', index % 3 ? 'Mountain View' : 'Swimming Pool'] : [];
  const priceValue = numberPrice(item.priceValue ?? item.price);
  return {
    ...item,
    id: item._id || item.id,
    name: item.name || 'Hill View Stay',
    location: item.location || 'Mahabaleshwar',
    region: source === 'home' ? 'Mahabaleshwar' : (item.location || ''),
    type: item.type || 'Villa',
    priceValue,
    price: priceLabel(priceValue),
    rating: Number(item.rating) || 4.8,
    reviewsCount: Number(item.reviewsCount) || 85,
    amenities,
    image,
    photos: source === 'database' ? (item.photos?.length ? item.photos.map((photo) => imageUrl(photo, image)) : [image]) : [image, ...(item.photos || []).filter((photo) => photo !== image)],
    badge: item.tag || (index % 3 === 0 ? 'Bestseller' : index % 3 === 1 ? 'Popular' : 'Luxury'),
    order: index,
    source,
  };
};
const localProperties = [
  ...stays.map((item, index) => normalizeStay(item, index, 'home')),
  ...mockProperties.map((item, index) => normalizeStay(item, index + stays.length, 'mock')),
];
const contains = (value, term) => String(value || '').toLowerCase().includes(term);
const hasAmenity = (property, selected) => {
  const terms = {
    'Swimming Pool': ['pool'], 'Breakfast Included': ['breakfast'], WiFi: ['wifi', 'wi-fi'],
    Parking: ['parking'], 'AC Rooms': ['ac rooms', 'air conditioning'], 'Pet Friendly': ['pet'],
    Bonfire: ['bonfire'], 'Mountain View': ['mountain', 'valley view', 'forest view', 'lake view'],
  }[selected];
  return terms.some((term) => property.amenities.some((amenity) => contains(amenity, term)));
};
const isType = (property, selected) => {
  const type = String(property.type).toLowerCase();
  if (selected === 'Budget') return property.priceValue <= 6000;
  if (selected === 'Luxury') return property.priceValue >= 9000 || contains(property.badge, 'luxury');
  if (selected === 'Cottage') return /cottage|cabin|chalet/.test(`${type} ${property.name.toLowerCase()}`);
  return type.includes(selected.toLowerCase());
};
const isIdeal = (property, selected) => {
  const description = `${property.name} ${property.type} ${property.amenities.join(' ')}`.toLowerCase();
  if (selected === 'Family') return /villa|resort|family|pool|kitchen|garden/.test(description);
  if (selected === 'Couples') return /villa|suite|cottage|chalet|balcony|spa/.test(description);
  if (selected === 'Group') return /villa|resort|pool|garden/.test(description);
  return /hotel|homestay|cottage|cabin/.test(description);
};
// Desktop keeps the search bar sticky over the listing (see .es-search-dock),
// so results are brought into view below its 102px band.
const STICKY_SEARCH_QUERY = '(min-width: 851px)';
const revealResults = (section, { smooth = true } = {}) => {
  if (!section) return;
  const offset = window.matchMedia(STICKY_SEARCH_QUERY).matches ? 120 : 16;
  const top = section.getBoundingClientRect().top + window.scrollY - offset;
  if (window.__lenis) window.__lenis.scrollTo(top, smooth ? { duration: 1.1 } : { immediate: true });
  else window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
};

const PropertyCard = ({ property, favorite, onFavorite, searchParams }) => {
  const params = new URLSearchParams();
  for (const key of ['checkIn', 'checkOut', 'guests']) if (searchParams.get(key)) params.set(key, searchParams.get(key));
  const href = `/property/${property.id}${params.size ? `?${params}` : ''}`;
  const detailsState = { property };
  const amenities = property.amenities.length ? property.amenities.slice(0, 3) : ['Parking', 'Breakfast', 'WiFi'];
  const amenityIcon = (label) => /pool|lake/i.test(label) ? 'water-ladder' : /breakfast|meal|restaurant/i.test(label) ? 'mug-hot' : /wi-?fi/i.test(label) ? 'wifi' : /park/i.test(label) ? 'square-parking' : /view|balcony/i.test(label) ? 'mountain-sun' : 'check';
  return <article className="es-stay-card">
    <div className="es-card-photo"><Link to={href} state={detailsState} aria-label={`View ${property.name}`}><img src={property.image} alt={property.name} loading="lazy" /></Link><span className="es-card-badge">{property.badge}</span><button type="button" className={`es-favorite ${favorite ? 'is-saved' : ''}`} onClick={() => onFavorite(property.id)} aria-label={`${favorite ? 'Remove' : 'Add'} ${property.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite}><i className={`${favorite ? 'fa-solid' : 'fa-regular'} fa-heart`} aria-hidden="true" /></button></div>
    <div className="es-card-body"><div className="es-card-heading"><Link to={href} state={detailsState}>{property.name}</Link><span className="es-card-rating"><Icon name="star" /> {property.rating.toFixed(1)} <small>({property.reviewsCount})</small></span></div><p className="es-card-location"><Icon name="location-dot" /> {property.location}</p><div className="es-card-facts"><Icon name="user-group" /> 2 guests / night</div><div className="es-card-amenities">{amenities.map((amenity) => <span key={amenity}><Icon name={amenityIcon(amenity)} /> {amenity.replace(' Included', '')}</span>)}</div><div className="es-card-bottom"><div><strong>{priceLabel(property.priceValue)}</strong><span> / night</span></div><Link to={href} state={detailsState} className="es-details-btn">View Details <Icon name="arrow-right" /></Link></div></div>
  </article>;
};
const FilterGroup = ({ title, children }) => <fieldset className="es-filter-group"><legend>{title}</legend>{children}</fieldset>;

const ExploreStaysPage = () => {
  const heroImage = useSiteHero('explore', defaultHeroImage);
  const { search } = useLocation();
  const navigate = useNavigate();
  const resultsRef = useRef(null);
  const searchDockRef = useRef(null);
  const [searchStuck, setSearchStuck] = useState(false);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const searchTerm = params.has('search') ? params.get('search').trim() : DEFAULT_LOCATION;
  const [destination, setDestination] = useState(searchTerm);
  const [checkIn, setCheckIn] = useState(params.get('checkIn') || addDays(todayISO(), 1));
  const [checkOut, setCheckOut] = useState(params.get('checkOut') || addDays(todayISO(), 3));
  const [guests, setGuests] = useState(Math.max(1, Number(params.get('guests')) || 2));
  const [databaseProperties, setDatabaseProperties] = useState([]);
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; } });

  useEffect(() => { window.scrollTo(0, 0); }, []);
  // The dock is sticky at top: 0. A root shrunk by 1px makes it "partly
  // hidden" exactly while it is pinned, which switches on its solid band.
  useEffect(() => {
    const dock = searchDockRef.current;
    if (!dock || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setSearchStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= 1);
    }, { rootMargin: '-1px 0px 0px 0px', threshold: [1] });
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setDestination(searchTerm);
    setCheckIn(params.get('checkIn') || addDays(todayISO(), 1));
    setCheckOut(params.get('checkOut') || addDays(todayISO(), 3));
    setGuests(Math.max(1, Number(params.get('guests')) || 2));
    setPage(1);
  }, [params, searchTerm]);
  useEffect(() => {
    if (!params.has('search')) return undefined;
    const frame = requestAnimationFrame(() => {
      revealResults(resultsRef.current, { smooth: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/properties/all`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => { if (Array.isArray(data)) setDatabaseProperties(data.map((item, index) => normalizeStay(item, index, 'database'))); })
      .catch((error) => { if (error.name !== 'AbortError') console.warn('Explore stays are using the local collection.', error); });
    return () => controller.abort();
  }, []);

  const allProperties = useMemo(() => {
    const names = new Set(databaseProperties.map((item) => item.name.trim().toLowerCase()));
    return [...databaseProperties, ...localProperties.filter((item) => !names.has(item.name.trim().toLowerCase()))];
  }, [databaseProperties]);
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const result = allProperties.filter((property) => {
      if (term && ![property.name, property.location, property.region, property.type].some((value) => contains(value, term))) return false;
      if (property.priceValue > applied.maxPrice || property.rating < applied.rating) return false;
      if (applied.types.length && !applied.types.some((type) => isType(property, type))) return false;
      if (applied.amenities.length && !applied.amenities.every((amenity) => hasAmenity(property, amenity))) return false;
      if (applied.idealFor.length && !applied.idealFor.some((ideal) => isIdeal(property, ideal))) return false;
      return true;
    });
    if (sort === 'price-low') result.sort((a, b) => a.priceValue - b.priceValue);
    else if (sort === 'price-high') result.sort((a, b) => b.priceValue - a.priceValue);
    else if (sort === 'rating') result.sort((a, b) => b.rating - a.rating);
    else result.sort((a, b) => {
      const rank = { database: 0, home: 1, mock: 2 };
      return rank[a.source] - rank[b.source] || a.order - b.order;
    });
    return result;
  }, [allProperties, searchTerm, applied, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleProperties = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const cardParams = new URLSearchParams(params);
  if (!cardParams.has('checkIn')) cardParams.set('checkIn', checkIn);
  if (!cardParams.has('checkOut')) cardParams.set('checkOut', checkOut);
  if (!cardParams.has('guests')) cardParams.set('guests', String(guests));
  const updateList = (key, value) => setDraft((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const clearFilters = () => { setDraft(emptyFilters()); setApplied(emptyFilters()); setPage(1); };
  const showResults = () => revealResults(resultsRef.current);
  const applyFilters = () => { setApplied({ ...draft }); setPage(1); setFiltersOpen(false); showResults(); };
  const changePage = (number) => { setPage(number); showResults(); };
  const toggleFavorite = (id) => setFavorites((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; try { localStorage.setItem('bookmyvilla-explore-favorites', JSON.stringify(next)); } catch { /* storage unavailable */ } return next; });
  const handleSearch = () => { const next = new URLSearchParams(); next.set('search', destination.trim()); if (checkIn) next.set('checkIn', checkIn); if (checkOut) next.set('checkOut', checkOut); next.set('guests', String(guests)); navigate(`/explore?${next}`); showResults(); };
  // React Router records its history index; with nothing earlier in this tab, go home.
  const goBack = () => { if (window.history.state?.idx > 0) navigate(-1); else navigate('/'); };

  return <div className="hp-root es-page"><main>
    <section className="es-hero" style={{ backgroundImage: `url(${heroImage})` }}><div className="es-hero-shade" /><div className="es-hero-inner"><div className="es-hero-top"><button type="button" className="es-back" onClick={goBack} aria-label="Go back"><Icon name="arrow-left" /></button><nav className="es-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>›</span><span>Explore Stays</span></nav></div><div className="es-hero-copy"><h1>{searchTerm ? <><span>Explore Stays in</span> {searchTerm.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())}</> : <><span>Explore</span> All Stays</>}</h1><p>Find the perfect stay for your next trip</p></div>
    </div></section>
    <section className="es-listing-section">
      {/* Sticky within this section: it starts over the hero's bottom edge, stays
          pinned while the stays scroll past, and leaves with the listing. */}
      <div className={`es-search-dock ${searchStuck ? 'is-stuck' : ''}`} ref={searchDockRef}><div className="es-search-dock-inner"><StaySearchForm destination={destination} checkIn={checkIn} checkOut={checkOut} guests={guests} onDestinationChange={setDestination} onCheckInChange={setCheckIn} onCheckOutChange={setCheckOut} onGuestsChange={setGuests} onSubmit={handleSearch} /></div></div>
      <div className="es-layout" ref={resultsRef}><button type="button" className="es-mobile-filter-toggle" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="es-filters"><Icon name="sliders" /> Filters <Icon name={filtersOpen ? 'chevron-up' : 'chevron-down'} /></button><aside id="es-filters" className={`es-sidebar ${filtersOpen ? 'is-open' : ''}`} aria-label="Filter stays" tabIndex={0} data-lenis-prevent><div className="es-filter-top"><h2>Filter Stays</h2><button type="button" onClick={clearFilters}>Clear All</button></div>
      <FilterGroup title="Price Range (per night)"><input className="es-price-slider" type="range" min="0" max={PRICE_LIMIT} step="500" value={draft.maxPrice} onChange={(event) => setDraft((current) => ({ ...current, maxPrice: Number(event.target.value) }))} aria-label="Maximum nightly price" style={{ '--fill': `${draft.maxPrice / PRICE_LIMIT * 100}%` }} /><div className="es-price-ends"><span>₹0</span><span>{priceLabel(draft.maxPrice)}{draft.maxPrice === PRICE_LIMIT ? '+' : ''}</span></div></FilterGroup>
      <FilterGroup title="Property Type">{typeOptions.map(([label, value]) => <label className="es-filter-option" key={value}><input type="checkbox" checked={draft.types.includes(value)} onChange={() => updateList('types', value)} /><span>{label}</span><small>{allProperties.filter((property) => isType(property, value)).length}</small></label>)}</FilterGroup>
      <FilterGroup title="Amenities">{amenityOptions.map((amenity) => <label className="es-filter-option" key={amenity}><input type="checkbox" checked={draft.amenities.includes(amenity)} onChange={() => updateList('amenities', amenity)} /><span>{amenity}</span></label>)}</FilterGroup>
      <FilterGroup title="Ideal For">{idealOptions.map((ideal) => <label className="es-filter-option" key={ideal}><input type="checkbox" checked={draft.idealFor.includes(ideal)} onChange={() => updateList('idealFor', ideal)} /><span>{ideal}</span></label>)}</FilterGroup>
      <FilterGroup title="Guest Rating">{[4.5, 4, 3.5].map((rating) => <label className="es-filter-option es-rating-option" key={rating}><input type="radio" name="rating" checked={draft.rating === rating} onChange={() => setDraft((current) => ({ ...current, rating }))} /><span className="es-rating-stars">★★★</span><span>{rating} &amp; above</span></label>)}</FilterGroup>
      <button type="button" className="es-apply-btn" onClick={applyFilters}>Apply Filters</button><div className="es-help-card"><span className="es-help-icon"><Icon name="phone" /></span><div><strong>Need Help?</strong><span>Talk to our travel expert</span></div><a href="tel:+919876543210">+91 98765 43210</a><small>24/7 Support · Free Consultation</small></div>
    </aside><div className="es-results" role="region" aria-label="Stay search results"><div className="es-results-head"><div><h2 aria-live="polite">{filtered.length} Stays in {searchTerm || 'All Destinations'}</h2><p>Explore the matching properties below.</p></div><label>Sort by <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="popular">Most Popular</option><option value="rating">Top Rated</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select></label></div>
      {visibleProperties.length ? <div className="es-card-grid">{visibleProperties.map((property) => <PropertyCard key={`${property.source}-${property.id}`} property={property} favorite={favorites.includes(property.id)} onFavorite={toggleFavorite} searchParams={cardParams} />)}</div> : <div className="es-empty"><Icon name="mountain-sun" /><h3>No stays found</h3><p>Try another destination or clear some filters to see more stays.</p><button type="button" onClick={() => { clearFilters(); navigate(`/explore?search=${DEFAULT_LOCATION}`); }}>Show All Stays</button></div>}
      {filtered.length > PAGE_SIZE && <nav className="es-pagination" aria-label="Stay pages">{Array.from({ length: pages }, (_, index) => <button key={index + 1} type="button" className={currentPage === index + 1 ? 'is-current' : ''} onClick={() => changePage(index + 1)} aria-current={currentPage === index + 1 ? 'page' : undefined}>{index + 1}</button>)}<button type="button" disabled={currentPage === pages} onClick={() => changePage(currentPage + 1)} aria-label="Next page"><Icon name="arrow-right" /></button></nav>}
    </div></div></section>
    <section className="es-testimonials"><div className="es-testimonials-inner"><div className="es-testimonials-heading"><span>Guest Experiences &amp; Reviews</span><h2>What Our Travelers Say</h2></div><div className="es-testimonial-grid">{testimonials.slice(0, 3).map((item) => <figure className="es-quote-card" key={item.name}><div className="es-quote-top"><span className="es-quote-avatar">{item.name.split(' ').map((part) => part[0]).join('')}</span><blockquote>“{item.text}”</blockquote></div><figcaption><span>{item.name}<small>{item.city}</small></span><span className="es-quote-stars" aria-label={`${item.rating} out of 5 stars`}>{'★'.repeat(item.rating)}</span></figcaption></figure>)}</div></div></section>
  </main><HomeFooter /></div>;
};

export default ExploreStaysPage;
