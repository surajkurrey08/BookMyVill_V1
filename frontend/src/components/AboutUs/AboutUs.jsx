import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import HomeHeader from '../Home/HomeHeader';
import HomeFooter from '../Home/HomeFooter';
import '../Home/Home.css';
import './AboutUs.css';
import heroImage from '../../assets/hero_page1.png';
import storyImage from '../../assets/home/lakeside-resort.jpg';
import journeyImage from '../../assets/Home_page3.png';
import useSiteHero from '../../hooks/useSiteHero';

const highlights = [
  { icon: 'fa-user-group', value: '500+', label: 'Happy Travelers' },
  { icon: 'fa-house', value: '120+', label: 'Premium Stays' },
  { icon: 'fa-clock', value: '5+', label: 'Years Experience' },
  { icon: 'fa-star', value: '4.8', label: 'Average Rating' },
];

const values = [
  { icon: 'fa-shield-halved', title: 'Quality', description: 'Handpicked properties for the best experience' },
  { icon: 'fa-handshake', title: 'Trust', description: 'Transparent and reliable services' },
  { icon: 'fa-heart', title: 'Customer First', description: 'Your happiness is our priority' },
  { icon: 'fa-leaf', title: 'Sustainability', description: 'Promoting responsible and eco-friendly travel' },
];

const AboutUs = () => {
  const currentHeroImage = useSiteHero('about', heroImage);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="hp-root aboutus-page">
      <HomeHeader />
      <main>
        <section className="aboutus-hero" aria-labelledby="aboutus-title">
          <img className="aboutus-hero-image" src={currentHeroImage} alt="" />
          <div className="aboutus-hero-shade" />
          <div className="hp-container aboutus-hero-content">
            <nav className="aboutus-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link><span aria-hidden="true">›</span><span>About Us</span>
            </nav>
            <h1 id="aboutus-title">About <span>BookMyVilla</span></h1>
            <p>Your trusted travel partner for unforgettable stays and experiences in Mahabaleshwar.</p>
          </div>
        </section>

        <section className="aboutus-story" aria-labelledby="aboutus-story-title">
          <div className="hp-container aboutus-story-grid">
            <div className="aboutus-story-copy">
              <p className="aboutus-overline">Our Story</p>
              <h2 id="aboutus-story-title">Creating Memorable<br />Travel Experiences</h2>
              <p>At BookMyVilla, we believe travel is more than just a journey — it's about creating memories that last a lifetime. We started with a simple vision: to make it easy for travelers to find the perfect stay in the beautiful hills of Mahabaleshwar.</p>
              <p>From luxurious villas to cozy homestays, we handpick properties that offer comfort, authentic experiences and the breathtaking beauty of nature.</p>
            </div>
            <div className="aboutus-story-visual">
              <img src={storyImage} alt="Hillside villas and an infinity pool at sunset" loading="lazy" />
            </div>
          </div>
          <div className="hp-container">
            <div className="aboutus-stats" aria-label="BookMyVilla at a glance">
              {highlights.map((item) => (
                <div className="aboutus-stat" key={item.label}>
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                  <strong>{item.value}{item.label === 'Average Rating' && <span className="aboutus-stat-star">★</span>}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="aboutus-purpose" aria-label="Our purpose">
          <div className="hp-container aboutus-purpose-grid">
            <article className="aboutus-purpose-item">
              <span className="aboutus-purpose-icon"><i className="fa-solid fa-map" aria-hidden="true" /></span>
              <div>
                <p className="aboutus-overline">Our Mission</p>
                <h2>Why We Do What We Do</h2>
                <p>To make travel simple, comfortable and memorable by providing the best stays, local experiences and personalized support for every traveler.</p>
              </div>
            </article>
            <article className="aboutus-purpose-item">
              <span className="aboutus-purpose-icon"><i className="fa-solid fa-bullseye" aria-hidden="true" /></span>
              <div>
                <p className="aboutus-overline">Our Vision</p>
                <h2>Our Vision</h2>
                <p>To be the most trusted travel platform for hill destinations, known for quality stays, authentic experiences and exceptional customer service.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="aboutus-values" aria-labelledby="aboutus-values-title">
          <div className="hp-container">
            <p className="aboutus-overline">Our Values</p>
            <h2 id="aboutus-values-title">What We Stand For</h2>
            <div className="aboutus-values-grid">
              {values.map((value) => (
                <article className="aboutus-value-card" key={value.title}>
                  <i className={`fa-solid ${value.icon}`} aria-hidden="true" />
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="aboutus-journey" aria-labelledby="aboutus-journey-title">
          <img src={journeyImage} alt="" loading="lazy" />
          <div className="aboutus-journey-shade" />
          <div className="hp-container aboutus-journey-content">
            <h2 id="aboutus-journey-title">Let’s Explore Together</h2>
            <p>Join thousands of happy travelers who have experienced the magic of Mahabaleshwar with us.</p>
            <Link to="/explore" className="aboutus-journey-cta">Explore Stays <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
};

export default AboutUs;
