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
      title: 'Weekend Panchgani Luxury Escape',
      badge: 'Weekend Special',
      duration: '2 Days / 1 Night',
      price: '₹14,500',
      numericPrice: 14500,
      status: 'Filling Fast',
      count: '4 Rooms Available',
      image: pkg4
    },
    {
      id: 5,
      propertyId: 13,
      hotelName: 'Bloom Hotel - Balewadi',
      title: 'Balewadi High Street Executive Getaway',
      badge: 'Corporate Special',
      duration: '2 Days / 1 Night',
      price: '₹8,999',
      numericPrice: 8999,
      status: 'Available',
      count: '6 Executive Suites Left',
      image: pkg1
    },
    {
      id: 6,
      propertyId: 11,
      hotelName: 'Sayaji Hotel Pune',
      title: 'Wakad & Baner Business Luxury Staycation',
      badge: 'Luxury Staycation',
      duration: '3 Days / 2 Nights',
      price: '₹16,800',
      numericPrice: 16800,
      status: 'Filling Fast',
      count: '3 Deluxe Rooms Left',
      image: pkg2
    },
    {
      id: 7,
      propertyId: 8,
      hotelName: 'Lonavala Valley Eco Resort',
      title: 'Lonavala Monsoon Waterfall & Cliff Retreat',
      badge: 'Adventure',
      duration: '3 Days / 2 Nights',
      price: '₹22,500',
      numericPrice: 22500,
      status: 'Available',
      count: '4 Eco Villas Available',
      image: pkg3
    },
    {
      id: 8,
      propertyId: 9,
      hotelName: 'Khandala Crest Heritage Hotel',
      title: 'Khandala Heritage Peak & Sunrise Experience',
      badge: 'Best Seller',
      duration: '3 Days / 2 Nights',
      price: '₹27,999',
      numericPrice: 27999,
      status: 'Limited Suites',
      count: '2 Heritage Suites Left',
      image: pkg4
    },
    {
      id: 9,
      propertyId: 12,
      hotelName: 'Panchgani Mist Retreat',
      title: 'Panchgani Valley Strawberry & Sunset Escape',
      badge: 'Weekend Special',
      duration: '2 Days / 1 Night',
      price: '₹12,999',
      numericPrice: 12999,
      status: 'Available',
      count: '5 Hillside Rooms Left',
      image: pkg1
    },
    {
      id: 10,
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

  // Filter & Sort Packages dynamically based on maxPrice, badge category, search query, and sort option
  const filteredPackages = useMemo(() => {
    let result = packageList.filter(pkg => {
      const matchesPrice = pkg.numericPrice <= maxPrice;
      const matchesBadge = activeBadgeFilter === 'All' || pkg.badge === activeBadgeFilter;
      const matchesSearch = !searchQuery || 
        pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.hotelName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPrice && matchesBadge && matchesSearch;
    });

    if (sortOrder === 'low-high') {
      result.sort((a, b) => a.numericPrice - b.numericPrice);
    } else if (sortOrder === 'high-low') {
      result.sort((a, b) => b.numericPrice - a.numericPrice);
    }

    return result;
  }, [packageList, maxPrice, activeBadgeFilter, searchQuery, sortOrder]);

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
        {/* Top Header Row (Matching Reference Screenshot Layout) */}
        <div className="packages-header-container">
          <div className="packages-title-box">
            <h2>
              Curated <span className="gold-text">Luxury</span> Packages
            </h2>
          </div>

          {/* Right side: Category Filters + Search Functionality */}
          <div className="packages-top-controls">
            <div className="category-pill-group">
              {['All', 'Best Seller', 'Family Special', 'Adventure', 'Weekend Special', 'Corporate Special', 'Luxury Staycation'].map(tab => (
                <button 
                  key={tab}
                  className={`category-pill-btn ${activeBadgeFilter === tab ? 'active' : ''}`}
                  onClick={() => setActiveBadgeFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="packages-search-form">
              <input 
                type="text" 
                placeholder="Search package or hotel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="packages-search-input"
              />
              <button type="submit" className="packages-search-btn" title="Search">
                <i className="fa-solid fa-magnifying-glass"></i>
              </button>
            </form>
          </div>
        </div>

        {/* Sub-Header Row: Price Sort Dropdown & Filters Button (Matching Reference Screenshot) */}
        <div className="packages-subheader-controls">
          <div className="subheader-left">
            <div className="sort-dropdown-wrapper">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="sort-dropdown-btn"
              >
                <option value="low-high">Price: Low to High ⌵</option>
                <option value="high-low">Price: High to Low 0</option>
              </select>
            </div>

            <button 
              type="button"
              className="filter-toggle-pill-btn"
              onClick={() => setShowFilterModal(true)}
            >
              <i className="fa-solid fa-sliders" style={{ marginRight: '6px' }}></i> Filters
            </button>
          </div>

          <div className="subheader-right">
            <span className="results-count-text">
              Showing <strong>{filteredPackages.length}</strong> Luxury Packages in Mahabaleshwar
            </span>
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
                        const token = localStorage.getItem('token');
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

              <div className="price-preset-box" style={{ marginTop: '20px' }}>
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
              <button onClick={() => setMaxPrice(50000)} className="btn-outline" style={{ padding: '8px 18px', borderRadius: '20px' }}>
                Reset
              </button>
              <button onClick={() => setShowFilterModal(false)} className="btn-primary" style={{ padding: '8px 24px', borderRadius: '20px' }}>
                Apply Budget Filter
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
