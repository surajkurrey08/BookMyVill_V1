import { useState } from 'react';
import HeroImageManager from '../HeroImageManager/HeroImageManager';
import OffersManager from '../OffersManager/OffersManager';
import SocialMediaLinksManager from '../SocialMediaLinksManager/SocialMediaLinksManager';
import './ContentControl.css';

const sections = [
  { id: 'hero-media', label: 'Hero Images', detail: 'Page cover images', icon: 'fa-regular fa-image' },
  { id: 'offers', label: 'Offers', detail: 'Promotions and villas', icon: 'fa-solid fa-tags' },
  { id: 'footer', label: 'Footer & Social', detail: 'Contact and social links', icon: 'fa-solid fa-address-card' }
];

export default function ContentControl() {
  const [activeSection, setActiveSection] = useState('hero-media');

  return (
    <div className="content-control">
      <header className="content-control-header">
        <div className="content-control-nav-heading">
          <span>Website content</span>
          <small>Choose an area to edit</small>
        </div>
        <nav className="content-control-tabs" aria-label="Content sections">
          {sections.map(section => (
            <button
              key={section.id}
              type="button"
              aria-current={activeSection === section.id ? 'page' : undefined}
              className={`content-control-tab ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <i className={section.icon} aria-hidden="true"></i>
              <span>
                <strong>{section.label}</strong>
                <small>{section.detail}</small>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <div
        className="content-control-panel"
        role="region"
        aria-label={sections.find(section => section.id === activeSection)?.label}
      >
        {activeSection === 'hero-media' && <HeroImageManager />}
        {activeSection === 'offers' && <OffersManager />}
        {activeSection === 'footer' && <SocialMediaLinksManager />}
      </div>
    </div>
  );
}
