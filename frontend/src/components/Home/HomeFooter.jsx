import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../Brand/BrandLogo';
import { scrollToId } from './scroll';

const HomeFooter = () => {
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
        <div className="hp-socials">
          <a href="#facebook" aria-label="Facebook"><i className="fa-brands fa-facebook-f"></i></a>
          <a href="#instagram" aria-label="Instagram"><i className="fa-brands fa-instagram"></i></a>
          <a href="#x" aria-label="X">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="#youtube" aria-label="YouTube"><i className="fa-brands fa-youtube"></i></a>
        </div>
      </div>

      <div className="hp-footer-col">
        <h4>Quick Links</h4>
        <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</Link>
        <button type="button" onClick={() => goToHomeSection('hp-destinations')}>Explore</button>
        <Link to="/explore">Stays</Link>
        <Link to="/packages">Experiences</Link>
        <button type="button" onClick={() => goToHomeSection('hp-contact')}>Contact</button>
      </div>

      <div className="hp-footer-col">
        <h4>Support</h4>
        <Link to="/about-us">Help Center</Link>
        <Link to="/dashboard">Booking Guide</Link>
        <a href="#cancellation">Cancellation Policy</a>
        <a href="#terms">Terms &amp; Conditions</a>
        <a href="#privacy">Privacy Policy</a>
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
        <a href="#privacy">Privacy Policy</a>
        <a href="#terms">Terms &amp; Conditions</a>
        <a href="#sitemap">Sitemap</a>
      </div>
    </div>
  </footer>
  );
};

export default HomeFooter;
