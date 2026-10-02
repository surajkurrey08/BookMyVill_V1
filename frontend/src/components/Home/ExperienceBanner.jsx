import React from 'react';
import { Link } from 'react-router-dom';
import { images } from './homeData';

const ExperienceBanner = () => (
  <div className="hp-experience hp-reveal" id="hp-experience" style={{ '--d': '0.12s' }}>
    <img src={images.forestViewpoint} alt="Sunrise over a forest viewpoint near Mahabaleshwar" loading="lazy" />
    <div className="hp-experience-shade" aria-hidden="true"></div>
    <div className="hp-experience-content">
      <span className="hp-eyebrow hp-eyebrow-light">Experience Nature</span>
      <h2 className="hp-experience-title">More Than<br />Just a Stay</h2>
      <p>
        From breathtaking viewpoints to serene valleys, Mahabaleshwar offers an experience that stays with you forever.
      </p>
      <Link to="/packages" className="hp-btn-gold">Explore Experiences</Link>
    </div>
  </div>
);

export default ExperienceBanner;
