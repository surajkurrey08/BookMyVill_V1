import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div className="logo">
            <span className="logo-text">Mahabaleshwar</span>
            <span className="logo-subtext">LUXURY STAYS</span>
          </div>
          <p>Curating India's most extraordinary hill station resorts, private villas, and boutique stay experiences.</p>
          <div className="footer-socials">
            <a href="#instagram" aria-label="Instagram"><i className="fa-brands fa-instagram"></i></a>
            <a href="#facebook" aria-label="Facebook"><i className="fa-brands fa-facebook-f"></i></a>
            <a href="#twitter" aria-label="Twitter">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#youtube" aria-label="YouTube"><i className="fa-brands fa-youtube"></i></a>
          </div>
        </div>

        <div className="footer-links">
          <div className="link-group">
            <h4>Explore & Stay</h4>
            <Link to="/explore"><i className="fa-solid fa-hotel" style={{ marginRight: '6px' }}></i>All Luxury Stays</Link>
            <Link to="/packages"><i className="fa-solid fa-gift" style={{ marginRight: '6px' }}></i>Holiday Packages</Link>
            <Link to="/about-us"><i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>About Us</Link>
            <Link to="/join-us"><i className="fa-solid fa-handshake" style={{ marginRight: '6px' }}></i>Partner With Us</Link>
          </div>
          <div className="link-group">
            <h4>Account & Portals</h4>
            <Link to="/signin"><i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: '6px' }}></i>Guest Sign In</Link>
            <Link to="/dashboard"><i className="fa-solid fa-gauge-high" style={{ marginRight: '6px' }}></i>User Dashboard</Link>
            <Link to="/caretaker-apply"><i className="fa-solid fa-user-gear" style={{ marginRight: '6px' }}></i>Caretaker Jobs</Link>
            <Link to="/register-property"><i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>List Property</Link>
          </div>
          <div className="link-group">
            <h4>Contact & Support</h4>
            <p className="contact-item"><i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i> +91 98765 43210</p>
            <p className="contact-item"><i className="fa-solid fa-envelope" style={{ marginRight: '6px' }}></i> concierge@mahabaleshwarstays.com</p>
            <p className="contact-item"><i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> Mahabaleshwar, Maharashtra 412806</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <p>&copy; 2026 Mahabaleshwar Luxury Stays. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#cookies">Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
