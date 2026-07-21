import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);

    // Check for user session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser(null);
      }
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    window.location.reload();
  };

  const scrollToSection = (id) => {
    if (location.pathname !== '/') {
      navigate(`/#${id}`);
      return;
    }
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <header className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to="/" className="logo-link">
            <div className="logo">
              <span className="logo-text">Mahabaleshwar</span>
              <span className="logo-subtext">LUXURY STAYS</span>
            </div>
          </Link>

          <div className="header-page-title" style={{
            fontSize: '0.9rem',
            fontWeight: '700',
            letterSpacing: '1.2px',
            color: '#2D433D',
            fontFamily: 'var(--font-heading)',
            textTransform: 'uppercase',
            background: 'rgba(212, 175, 55, 0.12)',
            padding: '6px 18px',
            borderRadius: '20px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}>
            <span style={{ color: '#D4AF37', fontSize: '0.8rem' }}>✦</span>
            MAHABLESHWAR LUXURY STAYS
            <span style={{ color: '#D4AF37', fontSize: '0.8rem' }}>✦</span>
          </div>

          <nav className="nav-links">
            <Link to="/" onClick={() => scrollToSection('home')}>Home</Link>
            <a href="#explore" onClick={(e) => { e.preventDefault(); scrollToSection('explore'); }}>Explore Stays</a>
            
            {user ? (
              <div className="user-profile-menu-container" style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="profile-pill-btn"
                  style={{
                    background: 'rgba(45, 67, 61, 0.08)',
                    border: '1px solid rgba(45, 67, 61, 0.2)',
                    padding: '5px 14px',
                    borderRadius: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="avatar-circle" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #d4af37 0%, #1b4332 100%)',
                    color: '#ffffff',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem'
                  }}>
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.1' }}>
                      {user.name ? user.name.split(' ')[0] : 'Provider'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: '700', textTransform: 'uppercase' }}>
                      {user.role === 'owner' ? 'Verified Host' : 'Guest'}
                    </span>
                  </div>
                  <i className={`fa-solid fa-chevron-${showProfileDropdown ? 'up' : 'down'}`} style={{ fontSize: '0.7rem', color: '#666', marginLeft: '2px' }}></i>
                </button>

                {showProfileDropdown && (
                  <div className="profile-dropdown-card" style={{
                    position: 'absolute',
                    top: '45px',
                    right: '0',
                    width: '270px',
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '18px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    zIndex: 10000
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #d4af37 0%, #1b4332 100%)',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1a1a1a' }}>{user.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: '#666', display: 'block' }}>{user.email}</span>
                        <span style={{ background: '#d4af37', color: '#1a1a1a', padding: '2px 8px', borderRadius: '10px', fontSize: '0.62rem', fontWeight: '700', marginTop: '4px', display: 'inline-block' }}>
                          {user.role === 'owner' ? 'Luxury Property Provider' : 'Guest Traveler'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                      <Link 
                        to="/dashboard" 
                        onClick={() => setShowProfileDropdown(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          color: '#1a1a1a',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          background: 'rgba(0, 0, 0, 0.03)'
                        }}
                      >
                        <i className="fa-solid fa-hotel" style={{ color: '#d4af37' }}></i> Host Dashboard
                      </Link>
                      <Link 
                        to="/dashboard" 
                        onClick={() => setShowProfileDropdown(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          color: '#1a1a1a',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          background: 'rgba(0, 0, 0, 0.03)'
                        }}
                      >
                        <i className="fa-solid fa-user-pen" style={{ color: '#2b9348' }}></i> Edit Provider Profile
                      </Link>
                      {user.role === 'owner' && (
                        <Link 
                          to="/dashboard" 
                          onClick={() => setShowProfileDropdown(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            color: '#1a1a1a',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            background: 'rgba(0, 0, 0, 0.03)'
                          }}
                        >
                          <i className="fa-solid fa-user-gear" style={{ color: '#0077b6' }}></i> Caretaker Status / Apply
                        </Link>
                      )}
                      <button 
                        onDoubleClick={handleLogout}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          color: '#d62828',
                          background: 'rgba(214, 40, 40, 0.08)',
                          border: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginTop: '4px'
                        }}
                      >
                        <i className="fa-solid fa-right-from-bracket"></i> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/signin" className="btn-primary signin-btn">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {location.pathname !== '/' && (
        <div style={{
          position: 'fixed',
          top: '90px',
          left: '25px',
          zIndex: 9999
        }}>
          <button 
            onClick={() => navigate(-1)}
            title="Go to previous page"
            style={{
              background: '#ffffff',
              color: '#1a1a1a',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              padding: '9px 20px',
              borderRadius: '30px',
              fontSize: '0.9rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-arrow-left" style={{ color: '#2D433D' }}></i> Back
          </button>
        </div>
      )}
    </>
  );
};

export default Navbar;
