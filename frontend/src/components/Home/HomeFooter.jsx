import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../Brand/BrandLogo';
import { scrollToId } from './scroll';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { SocialIcons } from '../Footer/socialPlatforms';

const HomeFooter = () => {
  const [socialLinks, setSocialLinks] = useState({});

  useEffect(() => {
    const controller = new AbortController(); 

    const loadSocialLinks = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/social-links/public`, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`Social links API failed: ${response.status}`);
        } 
         
        const result = await response.json();

        setSocialLinks(result.links || {});
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Unable to load footer social links:', error);
        }
      }
    };

    loadSocialLinks();

    return () => controller.abort();
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const goToHomeSection = (id) => {
    if (location.pathname === '/') scrollToId(id);
    else navigate(`/#${id}`);
  };

  return (
  <footer className="hp-footer" id="hp-contact">
    <div className="hp-container hp-footer-grid">
      <div className="hp-footer-brand">
        <BrandLogo />
        <p>
          Creating unforgettable experiences in the hills. Book your perfect stay and explore the beauty of Mahabaleshwar with us.
        </p>
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
        <a href="tel:+919876543210"><i className="fa-solid fa-phone"></i> +91 98765 43210</a>
        <a href="mailto:support@bookmyvilla.com"><i className="fa-solid fa-envelope"></i> support@bookmyvilla.com</a>
        <span><i className="fa-solid fa-location-dot"></i> Mahabaleshwar, Maharashtra, India</span>
      </div>
    </div>

    <div className="hp-container hp-footer-bottom">
      <p>© {new Date().getFullYear()} BookMyVilla. All rights reserved.</p>
      <div>
        <Link to="/about-us">Privacy Policy</Link>
        <Link to="/about-us">Terms &amp; Conditions</Link>
        <Link to="/explore">Sitemap</Link>
      </div>
    </div>
  </footer>
  );
};

export default HomeFooter;
