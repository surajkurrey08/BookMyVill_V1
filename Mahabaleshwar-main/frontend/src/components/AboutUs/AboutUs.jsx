import React from 'react';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './AboutUs.css';
import bgImage from '../../assets/hillstationhome (1).jpg';

const AboutUs = () => {
  return (
    <div className="aboutus-page">
      <Navbar />

      <div className="aboutus-bg">
        <img src={bgImage} alt="Background" />
        <div className="aboutus-overlay"></div>
      </div>

      <div className="aboutus-container">
        <div className="aboutus-header">
          <h1>About Mahabaleshwar Luxury Stays</h1>
          <p>Redefining hill station hospitality with handpicked private villas, boutique heritage estates, and bespoke local experiences.</p>
        </div>

        <div className="aboutus-main-card">
          <div className="aboutus-story-section">
            <h2><i className="fa-solid fa-gem" style={{ color: '#d4af37', marginRight: '10px' }}></i> Our Story</h2>
            <p>
              Founded in the serene Western Ghats, <strong>Mahabaleshwar Luxury Stays</strong> was born from a passion for preserving colonial charm while delivering modern 5-star comfort. We connect discerning travelers with private luxury villas, heritage bungalows, and hillside retreats nestled among strawberry fields and misty mountain peaks.
            </p>
            <p>
              Every property listed on our platform is personally verified for architectural excellence, private pool standards, hygiene, and authentic Mahabaleshwar hospitality.
            </p>
          </div>

          <div className="aboutus-stats-grid">
            <div className="stat-item">
              <span className="stat-number">50+</span>
              <span className="stat-label">Luxury Stays Listed</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">12,500+</span>
              <span className="stat-label">Happy Guests</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">4.9 ★</span>
              <span className="stat-label">Average Guest Rating</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">Verified Caretakers</span>
            </div>
          </div>

          <div style={{ marginTop: '40px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: '#ffffff', marginBottom: '20px' }}>
              Why Choose Mahabaleshwar Luxury Stays
            </h3>
            <div className="aboutus-values-grid">
              <div className="value-card">
                <i className="fa-solid fa-house-circle-check"></i>
                <h4>Handpicked Estates</h4>
                <p>Only top-tier villas with private infinity pools, valley views, and manicured lawns make it to our catalog.</p>
              </div>

              <div className="value-card">
                <i className="fa-solid fa-user-shield"></i>
                <h4>Dedicated Caretakers</h4>
                <p>24/7 on-site certified caretakers ensure seamless check-ins, home-cooked Maharashtrian meals, and property care.</p>
              </div>

              <div className="value-card">
                <i className="fa-solid fa-utensils"></i>
                <h4>Local Culinary Delights</h4>
                <p>Enjoy fresh farm-to-table strawberry desserts, wood-fired barbecues, and traditional local cuisine prepared by expert chefs.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AboutUs;
