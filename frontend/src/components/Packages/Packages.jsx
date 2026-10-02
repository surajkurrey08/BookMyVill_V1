import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeHeader from '../Home/HomeHeader';
import HomeFooter from '../Home/HomeFooter';
import useSiteHero from '../../hooks/useSiteHero';
import '../Home/Home.css';
import './Packages.css';

import lakeValley from '../../assets/home/lake-valley.jpg';
import hillChalet from '../../assets/home/hill-chalet.jpg';
import lakesideResort from '../../assets/home/lakeside-resort.jpg';
import cliffValley from '../../assets/home/cliff-valley.jpg';
import heroVilla from '../../assets/home/hero-villa.jpg';
import waterfallValley from '../../assets/waterfallvalley.jpg';

const categories = ['All Packages', 'Family', 'Couples', 'Adventure', 'Luxury', 'Weekend', 'Custom'];

const packages = [
  {
    id: 1, propertyId: 1, name: 'Mahabaleshwar Weekend Getaway', badge: 'Bestseller',
    categories: ['Weekend'], image: hillChalet, days: '3 Days · 2 Nights', price: 6999,
    description: 'A refreshing hill escape with a scenic stay, local flavours and the best-loved viewpoints of Mahabaleshwar.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
  {
    id: 2, propertyId: 4, name: 'Family Fun Package', badge: 'Family Special',
    categories: ['Family', 'Weekend'], image: lakesideResort, days: '3 Days · 2 Nights', price: 9999,
    description: 'Make room for everyone with a relaxed villa stay, family friendly activities and time together in the hills.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
  {
    id: 3, propertyId: 3, name: 'Romantic Escape', badge: 'Couple Favourite',
    categories: ['Couples', 'Luxury'], image: lakeValley, days: '3 Days · 2 Nights', price: 12999,
    description: 'Slow down together with sunset views, a private retreat and thoughtfully planned moments for two.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
  {
    id: 4, propertyId: 2, name: 'Adventure Package', badge: 'Adventure',
    categories: ['Adventure'], image: cliffValley, days: '3 Days · 2 Nights', price: 8999,
    description: 'Follow the mountain trails, discover valley viewpoints and return to a comfortable stay each evening.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
  {
    id: 5, propertyId: 5, name: 'Luxury Retreat', badge: 'Luxury',
    categories: ['Luxury', 'Couples'], image: heroVilla, days: '3 Days · 2 Nights', price: 18999,
    description: 'A polished villa getaway with indulgent comforts, sweeping views and an easy, unhurried itinerary.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
  {
    id: 6, propertyId: 6, name: 'Nature & Wellness', badge: 'Wellness',
    categories: ['Weekend'], image: waterfallValley, days: '2 Days · 1 Night', price: 7999,
    description: 'Reconnect with nature around waterfalls, peaceful walks and restorative time away from the city.',
    includes: ['Stay', 'Meals', 'Sightseeing'],
  },
];

const reasons = [
  { icon: 'fa-shield-heart', title: 'Handpicked Experiences', copy: 'Carefully curated stays and activities' },
  { icon: 'fa-tags', title: 'Best Price Guarantee', copy: 'Get the best deals with no hidden charges' },
  { icon: 'fa-headset', title: '24x7 Travel Support', copy: 'We are always here to help you' },
  { icon: 'fa-map-location-dot', title: 'Flexible Itineraries', copy: 'Customize as per your preference' },
];

const inclusionIcons = { Stay: 'fa-house', Meals: 'fa-utensils', Sightseeing: 'fa-binoculars' };

const Packages = () => {
  const heroImage = useSiteHero('packages', lakeValley);
  const [activeCategory, setActiveCategory] = useState('All Packages');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [tripStyle, setTripStyle] = useState('Nature & relaxation');
  const [tripGuests, setTripGuests] = useState('2');
  const [tripDays, setTripDays] = useState('3');
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!selectedPackage && !customOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape') { setSelectedPackage(null); setCustomOpen(false); }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectedPackage, customOpen]);

  const visiblePackages = useMemo(() => {
    if (activeCategory === 'All Packages') return packages;
    return packages.filter((item) => item.categories.includes(activeCategory));
  }, [activeCategory]);

  const handleCategory = (category) => {
    if (category === 'Custom') { setPlanReady(false); setCustomOpen(true); return; }
    setActiveCategory(category);
  };

  return (
    <div className="hp-root packages-page">
      <HomeHeader />
      <main>
        <section className="packages-hero" aria-labelledby="packages-hero-heading">
          <img className="packages-hero-image" src={heroImage} alt="" />
          <div className="packages-hero-shade" />
          <div className="hp-container packages-hero-content">
            <div className="packages-breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">›</span><span>Packages</span></div>
            <h1 id="packages-hero-heading">Curated Travel Packages<br /><span>for Every Traveler</span></h1>
            <p>Handpicked experiences, scenic destinations and memorable<br className="packages-desktop-break" /> itineraries in Mahabaleshwar.</p>
          </div>
        </section>

        <div className="packages-categories-shell">
          <div className="hp-container packages-categories" role="group" aria-label="Filter travel packages">
            {categories.map((category) => (
              <button key={category} type="button"
                className={`packages-category ${activeCategory === category ? 'is-active' : ''}`}
                onClick={() => handleCategory(category)}
                aria-pressed={category === 'Custom' ? undefined : activeCategory === category}
              >{category}</button>
            ))}
          </div>
        </div>

        <section className="packages-listing" aria-labelledby="packages-popular-heading">
          <div className="hp-container">
            <div className="packages-section-heading">
              <h2 id="packages-popular-heading">Popular Packages</h2>
              <p>Most loved packages by our travelers</p>
            </div>
            <div className="packages-grid">
              {visiblePackages.map((item) => (
                <article className="package-card" key={item.id}>
                  <div className="package-card-image">
                    <img src={item.image} alt="" loading="lazy" />
                    <span className="package-badge">{item.badge}</span>
                  </div>
                  <div className="package-card-content">
                    <h3>{item.name}</h3>
                    <p className="package-duration">{item.days}</p>
                    <div className="package-inclusions" aria-label="Package includes">
                      {item.includes.map((inclusion) => (
                        <span key={inclusion}><i className={`fa-solid ${inclusionIcons[inclusion]}`} aria-hidden="true" />{inclusion}</span>
                      ))}
                    </div>
                    <div className="package-card-bottom">
                      <p className="package-price"><strong>₹{item.price.toLocaleString('en-IN')}</strong><span> / person</span></p>
                      <button type="button" onClick={() => setSelectedPackage(item)}>View Details</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="packages-custom-section" aria-labelledby="packages-custom-heading">
          <div className="hp-container">
            <div className="packages-custom-banner">
              <img src={cliffValley} alt="" loading="lazy" />
              <div className="packages-custom-shade" />
              <div className="packages-custom-content">
                <h2 id="packages-custom-heading">Customize Your Own Package</h2>
                <p>Tell us your needs and we will create a perfect itinerary for you.</p>
                <button type="button" onClick={() => { setPlanReady(false); setCustomOpen(true); }}>Get Custom Package <span aria-hidden="true">→</span></button>
              </div>
            </div>
          </div>
        </section>

        <section className="packages-reasons" aria-labelledby="packages-reasons-heading">
          <div className="hp-container">
            <h2 id="packages-reasons-heading">Why Choose Our Packages</h2>
            <div className="packages-reasons-grid">
              {reasons.map((reason) => (
                <div className="packages-reason" key={reason.title}>
                  <span className="packages-reason-icon"><i className={`fa-solid ${reason.icon}`} aria-hidden="true" /></span>
                  <h3>{reason.title}</h3>
                  <p>{reason.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <HomeFooter />

      {selectedPackage && (
        <div className="packages-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPackage(null); }}>
          <div className="packages-dialog" role="dialog" aria-modal="true" aria-labelledby="packages-detail-title">
            <button className="packages-dialog-close" type="button" onClick={() => setSelectedPackage(null)} aria-label="Close package details">×</button>
            <img className="packages-detail-image" src={selectedPackage.image} alt="" />
            <div className="packages-dialog-body">
              <span className="packages-detail-badge">{selectedPackage.badge}</span>
              <h2 id="packages-detail-title">{selectedPackage.name}</h2>
              <p className="packages-dialog-muted">{selectedPackage.days} · Mahabaleshwar</p>
              <p>{selectedPackage.description}</p>
              <div className="packages-detail-inclusions">
                {selectedPackage.includes.map((inclusion) => <span key={inclusion}><i className={`fa-solid ${inclusionIcons[inclusion]}`} aria-hidden="true" /> {inclusion}</span>)}
              </div>
              <div className="packages-detail-actions">
                <strong>₹{selectedPackage.price.toLocaleString('en-IN')} <small>/ person</small></strong>
                <Link to={`/property/${selectedPackage.propertyId}`}>Explore Stay <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {customOpen && (
        <div className="packages-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomOpen(false); }}>
          <div className="packages-dialog packages-custom-dialog" role="dialog" aria-modal="true" aria-labelledby="packages-plan-title">
            <button className="packages-dialog-close" type="button" onClick={() => setCustomOpen(false)} aria-label="Close custom package planner">×</button>
            <div className="packages-dialog-body">
              <span className="packages-detail-badge">Made for you</span>
              <h2 id="packages-plan-title">Plan Your Perfect Getaway</h2>
              <p className="packages-dialog-muted">Choose a few details to create your trip brief.</p>
              <form className="packages-plan-form" onSubmit={(event) => { event.preventDefault(); setPlanReady(true); }}>
                <label>Travel style
                  <select value={tripStyle} onChange={(event) => { setTripStyle(event.target.value); setPlanReady(false); }}>
                    <option>Nature & relaxation</option><option>Family time</option><option>Romantic escape</option><option>Adventure</option><option>Luxury retreat</option>
                  </select>
                </label>
                <div className="packages-plan-row">
                  <label>Travelers
                    <select value={tripGuests} onChange={(event) => { setTripGuests(event.target.value); setPlanReady(false); }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                  <label>Days
                    <select value={tripDays} onChange={(event) => { setTripDays(event.target.value); setPlanReady(false); }}>
                      {[2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                </div>
                <button type="submit">Create Trip Brief <span aria-hidden="true">→</span></button>
              </form>
              {planReady && (
                <div className="packages-plan-result" role="status">
                  <strong>Your Mahabaleshwar trip brief is ready</strong>
                  <p>{tripDays} days for {tripGuests} {tripGuests === '1' ? 'traveler' : 'travelers'} · {tripStyle}. Call our travel expert with these details to plan your itinerary.</p>
                  <a href="tel:+919876543210"><i className="fa-solid fa-phone" aria-hidden="true" /> Call +91 98765 43210</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;
