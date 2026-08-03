import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import './Packages.css';
import bgImage from '../../assets/hillstationhome (1).jpg';
import pkg1 from '../../assets/hillstationhome (2).jpg';
import pkg2 from '../../assets/hillstationhome (3).jpg';
import pkg3 from '../../assets/hillstationhome (4).jpg';
import pkg4 from '../../assets/panchgani.jpg';

const Packages = () => {
  const navigate = useNavigate();
  const [maxPrice, setMaxPrice] = useState(50000);
  const [activeBadgeFilter, setActiveBadgeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('low-high');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedView, setSelectedView] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const packageList = [
    {
      id: 1,
      propertyId: 1,
      hotelName: 'Mistwood Manor Villa',
      title: 'Strawberry Valley Honeymoon Escape',
      badge: 'Best Seller',
      duration: '3 Days / 2 Nights',
      price: '₹24,999',
      numericPrice: 24999,
      status: 'Available',
      count: '3 Villas Available Today',
      image: pkg1
    },
    {
      id: 2,
      propertyId: 4,
      hotelName: 'Wilson Point Peak Resort',
      title: 'Royal Heritage Family Retreat',
      badge: 'Family Special',
      duration: '4 Days / 3 Nights',
      price: '₹38,500',
      numericPrice: 38500,
      status: 'Limited Suites',
      count: '2 Estates Left',
      image: pkg2
    },
    {
      id: 3,
      propertyId: 3,
      hotelName: "Kate's Point Chalet",
      title: 'Monsoon Mist & Mountain Trek',
      badge: 'Adventure',
      duration: '3 Days / 2 Nights',
      price: '₹19,999',
      numericPrice: 19999,
      status: 'Available',
      count: '5 Chalets Available',
      image: pkg3
    },
    {
      id: 4,
      propertyId: 2,
      hotelName: 'Venna Lake Resort',
      title: 'Lakeside Serenity & Boating Package',
      badge: 'Weekend Special',
      duration: '2 Days / 1 Night',
      price: '₹14,500',
      numericPrice: 14500,
      status: 'Available',
      count: '4 Rooms Available',
      image: pkg4
    },
    {
      id: 5,
      propertyId: 5,
      hotelName: 'Kshitij An Apartment Hotel',
      title: 'Business & Highway Executive Package',
      badge: 'Corporate Special',
      duration: '3 Days / 2 Nights',
      price: '₹12,999',
      numericPrice: 12999,
      status: 'Available',
      count: '6 Rooms Available',
      image: pkg1
    },
    {
      id: 6,
      propertyId: 6,
      hotelName: 'The Orchid Balewadi',
      title: 'Luxury Spa & Gourmet Weekend Staycation',
      badge: 'Luxury Staycation',
      duration: '2 Days / 1 Night',
      price: '₹16,500',
      numericPrice: 16500,
      status: 'Limited Suites',
      count: '2 Suites Left',
      image: pkg3
    },
    {
      id: 7,
      propertyId: 7,
      hotelName: 'Shivajinagar Executive Heritage Hotel',
      title: 'Central Pune Heritage & City Experience',
      badge: 'Family Special',
      duration: '2 Days / 1 Night',
      price: '₹11,800',
      numericPrice: 11800,
      status: 'Available',
      count: '4 Suites Available',
      image: pkg2
    }
  ];

  // Filter & Sort Packages dynamically based on maxPrice, selectedView, badge category, search query, and sort option
  const filteredPackages = useMemo(() => {
    let result = packageList.filter(pkg => {
      const matchesPrice = pkg.numericPrice <= maxPrice;
      const matchesBadge = activeBadgeFilter === 'All' || pkg.badge === activeBadgeFilter;
      const matchesSearch = !searchQuery || 
        pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.hotelName.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesView = true;
      if (selectedView !== 'All') {
        const text = (pkg.title + ' ' + pkg.hotelName).toLowerCase();
        const key = selectedView.toLowerCase().replace(' view', '');
        if (key === 'lake') matchesView = text.includes('lake') || text.includes('venna') || text.includes('boating');
        else if (key === 'mountain') matchesView = text.includes('mountain') || text.includes('peak') || text.includes('trek') || text.includes('point');
        else if (key === 'valley') matchesView = text.includes('valley') || text.includes('mistwood');
        else if (key === 'forest') matchesView = text.includes('heritage') || text.includes('manor');
        else matchesView = text.includes(key);
      }

      return matchesPrice && matchesBadge && matchesSearch && matchesView;
    });

    if (sortOrder === 'low-high') {
      result.sort((a, b) => a.numericPrice - b.numericPrice);
    } else if (sortOrder === 'high-low') {
      result.sort((a, b) => b.numericPrice - a.numericPrice);
    }

    return result;
  }, [packageList, maxPrice, activeBadgeFilter, searchQuery, sortOrder, selectedView]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
  };

  return (
    <div className="packages-page">
      <Navbar />

      <div className="packages-bg">
        <img src={bgImage} alt="Background" />
        <div className="packages-overlay"></div>
      </div>

      <div className="packages-container">
        {/* Unified Luxury Control Card for Packages Page */}
        <div className="packages-unified-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '28px',
          padding: '20px 30px',
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          margin: '0 auto 35px auto',
          width: 'fit-content',
          maxWidth: '95%'
        }}>
          {/* Title Header Centered */}
          <h2 style={{ fontSize: '1.95rem', margin: 0, fontFamily: 'var(--font-heading, serif)', color: '#0f382c', fontWeight: '800', textAlign: 'center', letterSpacing: '0.5px' }}>
            Curated <span style={{ color: '#d4af37' }}>Luxury</span> Packages
          </h2>

          {/* Row 1: Category Pills Options */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['All', 'Best Seller', 'Family Special', 'Adventure', 'Weekend Special', 'Corporate Special', 'Luxury Staycation'].map(tab => (
              <button 
                key={tab}
                className={`filter-btn ${activeBadgeFilter === tab ? 'active' : ''}`}
                onClick={() => setActiveBadgeFilter(tab)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '25px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  border: activeBadgeFilter === tab ? 'none' : '1px solid #c8d3cc',
                  background: activeBadgeFilter === tab ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : '#f4f6f4',
                  color: activeBadgeFilter === tab ? '#ffffff' : '#1b4332',
                  boxShadow: activeBadgeFilter === tab ? '0 4px 14px rgba(27, 67, 50, 0.3)' : '0 2px 5px rgba(0,0,0,0.02)'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Row 2: Search Bar, Sort Dropdown & Filters Button (Placed Below Options) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            width: '100%'
          }}>
            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} style={{ margin: 0, width: '260px', position: 'relative', border: '1px solid #d4af37', borderRadius: '30px', background: '#fdfbf7', padding: '0' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: '#d4af37', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem' }}></i>
              <input 
                type="text" 
                placeholder="Search package or hotel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', padding: '7px 14px 7px 36px', fontSize: '0.85rem', fontWeight: '600', color: '#1b4332', width: '100%', boxShadow: 'none' }}
              />
            </form>

            {/* Filters Button */}
            <button 
              type="button"
              className="filter-toggle-pill-btn"
              onClick={() => setShowFilterModal(true)}
              style={{
                background: '#ffffff',
                border: '1px solid #c8d3cc',
                color: '#1b4332',
                fontWeight: '700',
                padding: '7px 18px',
                borderRadius: '30px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-sliders" style={{ color: '#d4af37' }}></i> Filters
            </button>
          </div>
        </div>

        {/* Packages Cards Grid */}
        {filteredPackages.length > 0 ? (
          <div className="packages-grid">
            {filteredPackages.map((pkg) => (
              <div key={pkg.id} className="package-card">
                <div className="package-image-container">
                  <img src={pkg.image} alt={pkg.title} />
                  <span className="package-badge">{pkg.badge}</span>
                  <span className="package-duration-badge">
                    <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>
                    {pkg.duration}
                  </span>
                </div>
                
                <div className="package-body">
                  <span className="package-hotel-name">
                    <i className="fa-solid fa-hotel"></i> {pkg.hotelName}
                  </span>

                  <h3 className="package-title">{pkg.title}</h3>

                  {/* Real-time Availability Pill */}
                  <div className="package-availability-box">
                    <span>
                      <i className="fa-solid fa-calendar-check" style={{ marginRight: '6px' }}></i>
                      {pkg.status}
                    </span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{pkg.count}</span>
                  </div>

                  <div className="package-footer">
                    <div className="package-price-row">
                      <span className="price-label">Package Price</span>
                      <span className="price-amount">{pkg.price}</span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                        if (!token) {
                          navigate('/signin', { state: { from: `/property/${pkg.propertyId}` } });
                        } else {
                          navigate(`/property/${pkg.propertyId}`);
                        }
                      }}
                      className="btn-view-details"
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      View Details & Availability <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-packages-found">
            <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: '2.5rem', color: '#d4af37', marginBottom: '14px' }}></i>
            <h3>No packages matching your criteria</h3>
            <p>Try increasing your budget filter or resetting search terms above.</p>
            <button 
              type="button" 
              onClick={() => { setMaxPrice(50000); setActiveBadgeFilter('All'); setSearchQuery(''); }}
              className="btn-reset-filters"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Budget Filter Modal Popup */}
      {showFilterModal && (
        <div className="pkg-modal-overlay">
          <div className="pkg-modal-content">
            <div className="pkg-modal-header">
              <h3>
                <i className="fa-solid fa-sliders" style={{ color: '#d4af37', marginRight: '10px' }}></i>
                Set Package Budget Limit
              </h3>
              <button onClick={() => setShowFilterModal(false)} className="pkg-modal-close-btn">×</button>
            </div>

            <div className="pkg-modal-body">
              {/* Section 1: View Functionality */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>
                  🏞️ Scenic View / Location Type:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['All', 'Lake View', 'Mountain View', 'Valley View'].map(v => (
                    <button 
                      key={v}
                      type="button"
                      onClick={() => setSelectedView(v)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: selectedView === v ? 'none' : '1px solid #c8d3cc',
                        background: selectedView === v ? '#1b4332' : '#f4f6f4',
                        color: selectedView === v ? '#ffffff' : '#1b4332'
                      }}
                    >
                      {v === 'All' ? '✨ Any View' : (v === 'Lake View' ? '🌊 Lake View' : v === 'Mountain View' ? '⛰️ Mountain View' : '🏞️ Valley View')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Pricing Slider */}
              <div className="price-slider-box" style={{ background: '#f9f9f9', color: '#1a1a1a', border: '1px solid #eee' }}>
                <div className="slider-label-row" style={{ color: '#1a1a1a' }}>
                  <span>Filter by Max Budget:</span>
                  <span className="price-display-pill">
                    Up to ₹{maxPrice.toLocaleString('en-IN')}
                  </span>
                </div>

                <input 
                  type="range" 
                  min="10000" 
                  max="50000" 
                  step="1000" 
                  value={maxPrice} 
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="custom-price-slider"
                />

                <div className="slider-range-labels" style={{ color: '#888' }}>
                  <span>₹10,000</span>
                  <span>₹30,000</span>
                  <span>₹50,000</span>
                </div>
              </div>

              <div className="price-preset-box" style={{ marginTop: '18px' }}>
                <span className="preset-label" style={{ color: '#444' }}>Quick Budget Presets:</span>
                <div className="preset-buttons-group">
                  <button 
                    type="button"
                    className={`preset-pill ${maxPrice === 20000 ? 'active' : ''}`}
                    onClick={() => setMaxPrice(20000)}
                    style={{ color: '#1a1a1a' }}
                  >
                    Under ₹20k
                  </button>
                  <button 
                    type="button"
                    className={`preset-pill ${maxPrice === 30000 ? 'active' : ''}`}
                    onClick={() => setMaxPrice(30000)}
                    style={{ color: '#1a1a1a' }}
                  >
                    Under ₹30k
                  </button>
                  <button 
                    type="button"
                    className={`preset-pill ${maxPrice === 40000 ? 'active' : ''}`}
                    onClick={() => setMaxPrice(40000)}
                    style={{ color: '#1a1a1a' }}
                  >
                    Under ₹40k
                  </button>
                  <button 
                    type="button"
                    className={`preset-pill ${maxPrice === 50000 ? 'active' : ''}`}
                    onClick={() => setMaxPrice(50000)}
                    style={{ color: '#1a1a1a' }}
                  >
                    All Budgets
                  </button>
                </div>
              </div>
            </div>

            <div className="pkg-modal-footer">
              <button onClick={() => { setMaxPrice(50000); setSelectedView('All'); }} className="btn-outline" style={{ padding: '8px 18px', borderRadius: '20px' }}>
                Reset
              </button>
              <button onClick={() => setShowFilterModal(false)} className="btn-primary" style={{ padding: '8px 24px', borderRadius: '20px' }}>
                Apply Filters ({filteredPackages.length} Packages)
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Packages;
