import React, {useEffect, useState} from 'react';
import { Link } from 'react-router-dom';
import { openCookieSettings } from '../../lib/cookies';
import './Footer.css';
import { API_BASE_URL } from '../../config';
import { SocialIcons } from './socialPlatforms';



const Footer = () => {

  const [socialLinks, setSocialLinks] = useState({});

  useEffect(()=>{
    const controller = new AbortController();

    const loadSocialLinks = async () => {
      try{
        const response= await fetch (`${API_BASE_URL}/api/admin/social-links/public`, {signal: controller.signal});

        if(!response.ok){
          throw new Error('Could not load social links');
        }

        const result = await response.json();
        setSocialLinks(result.links || {});
      
      }catch (error) {
        if (error.name !== 'AbortError'){
          console.error('Unable to load footer social links:', error);
        }
      }
    };

       loadSocialLinks();

       return () => controller.abort();
  },[]);
  
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div className="logo">
            <span className="logo-text">BookMyVilla</span>
            <span className="logo-subtext">LUXURY STAYS</span>
          </div>
          <p>Curating India's most extraordinary hill station resorts, private villas, and boutique stay experiences.</p>
          <SocialIcons links={socialLinks} className="footer-socials" />
        </div>

        <div className="footer-links">
          <div className="link-group">
            <h4>Explore & Stay</h4>
            <Link to="/explore">All Luxury Stays</Link>
            <Link to="/packages">Holiday Packages</Link>
            <Link to="/about-us">About Us</Link>
            <Link to="/join-us">Partner With Us</Link>
          </div>
          <div className="link-group">
            <h4>Account & Portals</h4>
            <Link to="/signin">Guest Sign In</Link>
            <Link to="/dashboard">User Dashboard</Link>
            <Link to="/caretaker-apply">Caretaker Jobs</Link>
            <Link to="/register-property">List Property</Link>
          </div>
          <div className="link-group">
            <h4>Contact & Support</h4>
            <p className="contact-item"><i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i> +91 98765 43210</p>
            <p className="contact-item"><i className="fa-solid fa-envelope" style={{ marginRight: '6px' }}></i> concierge@bookmyvilla.com</p>
            <p className="contact-item"><i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> Mahabaleshwar, Maharashtra 412806</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <p>&copy; 2026 BookMyVilla. All rights reserved.</p>
          <div className="footer-legal">
            <Link to="/about-us">Privacy Policy</Link>
            <Link to="/about-us">Terms of Service</Link>
            <a href="#cookies" onClick={(e) => { e.preventDefault(); openCookieSettings(); }}>Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
