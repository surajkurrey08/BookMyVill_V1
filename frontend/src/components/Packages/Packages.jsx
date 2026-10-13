import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import HomeHeader from '../Home/HomeHeader';
import HomeFooter from '../Home/HomeFooter';
import useSiteHero from '../../hooks/useSiteHero';
import '../Home/Home.css';
import './Packages.css';

import lakeValley from '../../assets/home/lake-valley.webp';

const highlights = [
  { icon: 'fa-house', title: 'Handpicked stays', copy: 'Villas and resorts chosen for the view and the comfort.' },
  { icon: 'fa-utensils', title: 'Meals & experiences', copy: 'Local food, sightseeing and guided plans in one price.' },
  { icon: 'fa-tags', title: 'Special offers', copy: 'Festival and weekend deals made just for our packages.' },
];

const Packages = () => {
  const heroImage = useSiteHero('packages', lakeValley);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="hp-root packages-page">
      <HomeHeader />
      <main>
        <section className="packages-hero" aria-labelledby="packages-hero-heading">
          <img className="packages-hero-image" src={heroImage} alt="" />
          <div className="packages-hero-shade" />
          <div className="hp-container packages-hero-content">
            <h1 id="packages-hero-heading">Curated Travel Packages<br /><span>Coming Soon</span></h1>
            <p>Handpicked experiences, scenic destinations and memorable<br className="packages-desktop-break" /> itineraries in Mahabaleshwar.</p>
          </div>
        </section>

        <section className="packages-soon" aria-labelledby="packages-soon-heading">
          <div className="hp-container">
            <div className="packages-soon-card">
              <span className="packages-soon-icon"><i className="fa-solid fa-suitcase-rolling" aria-hidden="true" /></span>
              <span className="packages-soon-tag">Coming soon</span>
              <h2 id="packages-soon-heading">Our travel packages are on the way</h2>
              <p>We are putting together stay, meals and sightseeing packages for families, couples and groups. They will appear here very soon.</p>
              <div className="packages-soon-actions">
                <Link className="packages-soon-primary" to="/explore">Explore Stays <span aria-hidden="true">→</span></Link>
                <Link className="packages-soon-secondary" to="/">Back to Home</Link>
              </div>
            </div>

            <div className="packages-soon-grid">
              {highlights.map((item) => (
                <div className="packages-soon-item" key={item.title}>
                  <span className="packages-soon-item-icon"><i className={`fa-solid ${item.icon}`} aria-hidden="true" /></span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
};

export default Packages;
