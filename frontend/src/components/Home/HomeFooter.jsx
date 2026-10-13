import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import BrandLogo from '../Brand/BrandLogo';
import { SocialIcons } from '../Footer/socialPlatforms';

const defaultFooter = {
  footerDescription: 'Creating unforgettable experiences in the hills. Book your perfect stay and explore the beauty of Mahabaleshwar with us.',
  contactPhone: '+91 98765 43210',
  contactEmail: 'support@bookmyvilla.com',
  contactLocation: 'Mahabaleshwar, Maharashtra, India'
};

const HomeFooter = () => {
  const [socialLinks, setSocialLinks] = useState({});
  const [footerContent, setFooterContent] = useState(defaultFooter);

  useEffect(() => {
    const controller = new AbortController();

    const loadFooterContent = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/social-links/public`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Footer content API failed: ${response.status}`);
        }

        const result = await response.json();
        setSocialLinks(result.links || {});
        setFooterContent(current => ({ ...current, ...(result.footer || {}) }));
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Unable to load footer content:', error);
        }
      }
    };

    loadFooterContent();
    return () => controller.abort();
  }, []);

  const phoneHref = footerContent.contactPhone.replace(/[^+\d]/g, '');

  return (
    <footer className="hp-footer" id="hp-contact">
      <div className="hp-container hp-footer-grid">
        <div className="hp-footer-brand">
          <BrandLogo />
          <p>{footerContent.footerDescription}</p>
          <SocialIcons links={socialLinks} className="hp-socials" />
        </div>

        <div className="hp-footer-col">
          <h4>Quick Links</h4>
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</Link>
          <Link to="/explore">Explore</Link>
          <Link to="/explore">Stays</Link>
          <Link to="/packages">Experiences</Link>
          <Link to="/join-us">Contact</Link>
        </div>

        <div className="hp-footer-col">
          <h4>Support</h4>
          <Link to="/about-us">Help Center</Link>
          <Link to="/dashboard">Booking Guide</Link>
          <Link to="/about-us">Cancellation Policy</Link>
          <Link to="/about-us">Terms &amp; Conditions</Link>
          <Link to="/about-us">Privacy Policy</Link>
        </div>

        <div className="hp-footer-col hp-footer-contact">
          <h4>Contact Us</h4>
          <a href={`tel:${phoneHref}`}><i className="fa-solid fa-phone"></i> {footerContent.contactPhone}</a>
          <a href={`mailto:${footerContent.contactEmail}`}><i className="fa-solid fa-envelope"></i> {footerContent.contactEmail}</a>
          <span><i className="fa-solid fa-location-dot"></i> {footerContent.contactLocation}</span>
        </div>
      </div>

      <div className="hp-container hp-footer-bottom">
        <p>&copy; {new Date().getFullYear()} BookMyVilla. All rights reserved.</p>
        <div>
          <Link to="/about-us">Privacy Policy</Link>
          <Link to="/about-us">Terms &amp; Conditions</Link>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </div>
    </footer>
  );
};

export default HomeFooter;
