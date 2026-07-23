import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './JoinUs.css';
import bgImage from '../../assets/hillstationhome (1).jpg';

const JoinUs = () => {
  return (
    <div className="joinus-page">
      <Navbar />

      <div className="joinus-bg">
        <img src={bgImage} alt="Background" />
        <div className="joinus-overlay"></div>
      </div>

      <div className="joinus-container">
        <div className="joinus-header">
          <h1>Partner With Mahabaleshwar Stays</h1>
          <p>Join Maharashtra’s premier luxury hospitality network as a Property Owner or Certified Caretaker.</p>
        </div>

        <div className="joinus-cards-grid">
          {/* Card 1: Property Owners */}
          <div className="joinus-card">
            <div className="joinus-card-icon">
              <i className="fa-solid fa-hotel"></i>
            </div>
            <h3>For Property Owners</h3>
            <p>Monetize your luxury villa, resort, or hotel in Mahabaleshwar, Pune & Lonavala with guaranteed high occupancy.</p>
            <ul className="joinus-benefits">
              <li><i className="fa-solid fa-check"></i> High Return on Investment (ROI)</li>
              <li><i className="fa-solid fa-check"></i> 24/7 Dedicated Caretaker Staff Support</li>
              <li><i className="fa-solid fa-check"></i> Admin Security Verification & Approval</li>
              <li><i className="fa-solid fa-check"></i> Verified Luxury Travelers Only</li>
            </ul>
            <Link 
              to="/register-property" 
              className="btn-join-action"
            >
              Fill Property Owner Form <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>

          {/* Card 2: Caretakers & Hospitality Staff */}
          <div className="joinus-card">
            <div className="joinus-card-icon">
              <i className="fa-solid fa-user-gear"></i>
            </div>
            <h3>For Caretakers</h3>
            <p>Become a certified villa caretaker or estate manager for top-rated luxury properties in Mahabaleshwar & Pune.</p>
            <ul className="joinus-benefits">
              <li><i className="fa-solid fa-check"></i> Competitive Salary & Bonus Allowances</li>
              <li><i className="fa-solid fa-check"></i> Admin Security & Background Verification</li>
              <li><i className="fa-solid fa-check"></i> Guaranteed Verified Property Placements</li>
              <li><i className="fa-solid fa-check"></i> Medical & Health Insurance Options</li>
            </ul>
            <Link 
              to="/caretaker-apply" 
              className="btn-join-action"
            >
              Fill Caretaker Form <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default JoinUs;
