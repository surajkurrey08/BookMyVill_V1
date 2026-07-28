import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './JoinUs.css';
import bgImage from '../../assets/hillstationhome (1).jpg';
import { API_BASE_URL } from '../../config';

const JoinUs = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [livePartners, setLivePartners] = useState([]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && (u.role === 'user' || u.role === 'traveller')) {
          navigate('/dashboard');
          return;
        }
      } catch (err) {
        console.warn('User JSON parse error:', err);
      }
    }
    fetchLivePartners();
  }, [navigate]);

  const fetchLivePartners = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/partner/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLivePartners(data);
        }
      }
    } catch (err) {
      console.log('Using static verified partners list');
    }
  };

  const defaultPartners = [
    {
      id: 'owner-1',
      type: 'owner',
      name: 'Vikramaditya Patil',
      role: 'Verified Property Owner & Superhost',
      property: 'Royal Mist Luxury Villa',
      location: 'Mahabaleshwar',
      rating: '4.95 ★',
      experience: '12+ Stays Managed',
      badge: 'Gold Verified Host',
      avatarColor: '#d4af37',
      bio: 'Owner of premier hilltop villas with heated private pools, organic strawberry gardens & 24/7 butler services.'
    },
    {
      id: 'owner-2',
      type: 'owner',
      name: 'Ananya Deshmukh',
      role: 'Verified Property Owner',
      property: 'Panchgani Crest Retreat',
      location: 'Panchgani',
      rating: '4.90 ★',
      experience: '8+ Suites & Cottages',
      badge: 'Verified Partner',
      avatarColor: '#2b9348',
      bio: 'Specializing in eco-friendly heritage valley resorts and panoramic sunset view stays across Panchgani.'
    },
    {
      id: 'owner-3',
      type: 'owner',
      name: 'Rajesh Sharma',
      role: 'Verified Property Owner',
      property: 'Strawberry Hillside Estate',
      location: 'Mahabaleshwar',
      rating: '4.88 ★',
      experience: '15+ Yrs Hospitality',
      badge: 'Verified Partner',
      avatarColor: '#3a86ff',
      bio: 'Managing luxury family heritage estates with private bonfire pits, mountain trails & infinity views.'
    },
    {
      id: 'caretaker-1',
      type: 'caretaker',
      name: 'Suresh Pawar',
      role: 'Certified Chief Caretaker',
      property: 'Assigned to: Royal Mist Villa',
      location: 'Mahabaleshwar',
      rating: '5.0 ★',
      experience: '10+ Yrs Estate Management',
      badge: 'Certified Caretaker',
      avatarColor: '#52b788',
      bio: 'Expert in 24/7 guest reception, Maharashtrian authentic culinary preparation, and estate security.'
    },
    {
      id: 'caretaker-2',
      type: 'caretaker',
      name: 'Santosh Kadam',
      role: 'Certified Hospitality Specialist',
      property: 'Assigned to: Panchgani Crest',
      location: 'Panchgani',
      rating: '4.92 ★',
      experience: '7+ Yrs Hospitality',
      badge: 'Certified Caretaker',
      avatarColor: '#e0a96d',
      bio: 'Professional butler and property supervisor specializing in luxury guest experience and maintenance.'
    },
    {
      id: 'caretaker-3',
      type: 'caretaker',
      name: 'Mahesh Bhosale',
      role: 'Certified Property Caretaker',
      property: 'Assigned to: Pawna Lake Chalet',
      location: 'Lonavala / Pune',
      rating: '4.85 ★',
      experience: '6+ Yrs Experience',
      badge: 'Certified Caretaker',
      avatarColor: '#9d4edd',
      bio: 'Trained in villa security inspection, lawn care, pool sanitation, and guest housekeeping.'
    }
  ];

  // Combine live partners from DB if available (Approved by Admin only)
  const mappedLivePartners = livePartners
    .filter(lp => !lp.status || lp.status === 'approved')
    .map((lp, idx) => ({
      id: lp._id || `live-${idx}`,
      type: lp.partnerType === 'Caretaker' ? 'caretaker' : 'owner',
      name: lp.fullName,
      role: lp.partnerType === 'Caretaker' ? 'Certified Caretaker' : 'Verified Property Owner',
      property: lp.propertyName && lp.propertyName !== 'N/A' ? lp.propertyName : (lp.partnerType === 'Caretaker' ? 'Assigned Villa' : 'Mahabaleshwar Stay'),
      location: lp.city || 'Mahabaleshwar',
      rating: '5.0 ★',
      experience: lp.experience || 'Verified Partner',
      badge: 'Approved Host',
      avatarColor: lp.partnerType === 'Caretaker' ? '#52b788' : '#d4af37',
      bio: lp.message || (lp.partnerType === 'Caretaker' ? 'Certified caretaker for luxury stays in Mahabaleshwar.' : 'Verified property host in Mahabaleshwar.')
    }));

  const allPartners = [...defaultPartners, ...mappedLivePartners];

  const filteredPartners = allPartners.filter(p => {
    if (filter === 'owners') return p.type === 'owner';
    if (filter === 'caretakers') return p.type === 'caretaker';
    return true;
  });

  return (
    <div className="joinus-page">
      <Navbar />

      <div className="joinus-bg">
        <img src={bgImage} alt="Background" />
        <div className="joinus-overlay"></div>
      </div>

      <div className="joinus-container">
        {/* Header */}
        <div className="joinus-header">
          <h1>Partner With Mahabaleshwar Stays</h1>
          <p>Join Maharashtra’s premier luxury hospitality network as a Property Owner or Certified Caretaker.</p>
        </div>

        {/* Action Registration Cards */}
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
            <div className="card-btn-group">
              <Link to="/register-property" className="btn-join-action">
                Fill Property Owner Form <i className="fa-solid fa-arrow-right"></i>
              </Link>
              <a href="http://localhost:5175" className="btn-portal-action" target="_blank" rel="noreferrer">
                <i className="fa-solid fa-vihara"></i> Owner Portal Sign In ↗
              </a>
            </div>
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
            <Link to="/caretaker-apply" className="btn-join-action">
              Fill Caretaker Form <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </div>

        {/* VERIFIED PROPERTY OWNER & CARETAKER USER CARDS SECTION */}
        <section className="verified-community-section">
          <div className="community-header">
            <div className="badge-pill">
              <i className="fa-solid fa-shield-check"></i> Verified Community Network
            </div>
            <h2>Meet Our Verified Property Owners & Caretakers</h2>
            <p>Certified hosts and professional estate managers bringing luxury hospitality to Mahabaleshwar Stays.</p>
            
            {/* Filter Tabs */}
            <div className="community-tabs">
              <button 
                className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <i className="fa-solid fa-users"></i> All Verified Partners ({allPartners.length})
              </button>
              <button 
                className={`tab-btn ${filter === 'owners' ? 'active' : ''}`}
                onClick={() => setFilter('owners')}
              >
                <i className="fa-solid fa-house-chimney-user"></i> Property Owners ({allPartners.filter(p => p.type === 'owner').length})
              </button>
              <button 
                className={`tab-btn ${filter === 'caretakers' ? 'active' : ''}`}
                onClick={() => setFilter('caretakers')}
              >
                <i className="fa-solid fa-user-shield"></i> Certified Caretakers ({allPartners.filter(p => p.type === 'caretaker').length})
              </button>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="user-cards-grid">
            {filteredPartners.map(partner => (
              <div key={partner.id} className={`partner-user-card ${partner.type}`}>
                <div className="card-top-banner">
                  <span className={`partner-type-badge ${partner.type}`}>
                    <i className={`fa-solid ${partner.type === 'owner' ? 'fa-vihara' : 'fa-user-nurse'}`}></i>
                    {partner.type === 'owner' ? 'Property Owner' : 'Certified Caretaker'}
                  </span>
                  <span className="rating-tag">
                    <i className="fa-solid fa-star"></i> {partner.rating}
                  </span>
                </div>

                <div className="card-avatar-wrapper">
                  <div className="partner-avatar" style={{ backgroundColor: partner.avatarColor }}>
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="verified-check" title="Security & Background Verified">
                    <i className="fa-solid fa-check"></i>
                  </div>
                </div>

                <div className="partner-details">
                  <h3>{partner.name}</h3>
                  <span className="role-title">{partner.role}</span>
                  
                  <div className="info-item property-name">
                    <i className="fa-solid fa-hotel"></i>
                    <span>{partner.property}</span>
                  </div>

                  <div className="info-item location-name">
                    <i className="fa-solid fa-location-dot"></i>
                    <span>{partner.location}</span>
                  </div>

                  <p className="partner-bio">{partner.bio}</p>

                  <div className="card-footer-info">
                    <span className="exp-badge"><i className="fa-solid fa-award"></i> {partner.experience}</span>
                    <span className="status-verify" style={{ background: 'rgba(82, 183, 136, 0.18)', color: '#52b788', border: '1px solid #52b788', padding: '4px 10px', borderRadius: '20px', fontWeight: '700', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fa-solid fa-circle-check" style={{ color: '#d4af37' }}></i> Approved & Verified
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default JoinUs;
