import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BrandLogo from '../Brand/BrandLogo';
import { OWNER_PORTAL_URL, CARETAKER_PORTAL_URL } from '../../config';
import './Navbar.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [menuMode, setMenuMode] = useState(() => localStorage.getItem('navbarMode') || 'auto-hide');
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!showProfileDropdown) return undefined;
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileDropdown(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showProfileDropdown]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowProfileDropdown(false);
  }, [location.pathname]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 30);

      if (menuMode === 'auto-hide') {
        if (currentScrollY > 100 && currentScrollY > lastScrollY) {
          setIsNavHidden(true);
        } else {
          setIsNavHidden(false);
        }
      } else {
        setIsNavHidden(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);

    // Check for user session
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser(null);
      }
    } else {
      setUser(null);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname, menuMode]);

  const toggleMenuMode = () => {
    const nextMode = menuMode === 'auto-hide' ? 'static' : 'auto-hide';
    setMenuMode(nextMode);
    localStorage.setItem('navbarMode', nextMode);
    setIsNavHidden(false);
  };

  const handleLogout = () => {
    const userStr = sessionStorage.getItem('user');
    let isOwner = false;
    if (userStr) {
      try {
        isOwner = JSON.parse(userStr).role === 'owner';
      } catch (err) {
        console.warn('User JSON parse error:', err);
      }
    }
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (isOwner) {
      window.location.href = `${OWNER_PORTAL_URL}/login`;
    } else {
      navigate('/');
      window.location.reload();
    }
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
      <header className={`navbar-header ${isScrolled ? 'scrolled' : ''} ${isNavHidden ? 'hidden-nav' : ''}`}>
        <div className="navbar-container">
          <Link to="/" className="logo-link">
            <BrandLogo />
          </Link>

          <nav className={`nav-links-center ${isMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation" id="site-navigation">
            <Link to="/" onClick={() => { scrollToSection('home'); setIsMobileMenuOpen(false); }}>
              Home
            </Link>
            <Link to="/explore" onClick={() => setIsMobileMenuOpen(false)}>
              Explore Stays
            </Link>
            <Link to="/packages" onClick={() => setIsMobileMenuOpen(false)}>
              Packages
            </Link>
            <Link to="/about-us" onClick={() => setIsMobileMenuOpen(false)}>
              About Us
            </Link>
            <Link to="/join-us" className={location.pathname === '/join-us' ? 'nav-link-active' : ''} aria-current={location.pathname === '/join-us' ? 'page' : undefined} onClick={() => setIsMobileMenuOpen(false)}>
              Join Us
            </Link>
          </nav>

          <div className="nav-right-container">
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="site-navigation"
            >
              <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
            </button>
            {user ? (
              <div className="user-profile-menu-container" style={{ position: 'relative' }} ref={profileRef}>
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
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '260px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    zIndex: 99999
                  }}>
                    <div style={{ paddingBottom: '12px', borderBottom: '1px solid #eee', marginBottom: '12px' }}>
                      <strong style={{ display: 'block', color: '#1a1a1a', fontSize: '0.95rem' }}>{user.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>{user.email}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <Link 
                        to="/profile" 
                        target="_blank"
                        rel="noopener noreferrer"
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
                        <i className="fa-solid fa-user-pen" style={{ color: '#d4af37' }}></i> User Profile Edit ↗
                      </Link>
                      <Link 
                        to="/dashboard" 
                        target="_blank"
                        rel="noopener noreferrer"
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
                        <i className="fa-solid fa-hotel" style={{ color: '#2b9348' }}></i> Stays Dashboard ↗
                      </Link>
                      {user.role === 'owner' && (
                        <a 
                          href={OWNER_PORTAL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowProfileDropdown(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            color: '#d4af37',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            background: 'rgba(212, 175, 55, 0.1)'
                          }}
                        >
                          <i className="fa-solid fa-vihara" style={{ color: '#d4af37' }}></i> Host / Owner Portal ↗
                        </a>
                      )}
                      {user.role === 'caretaker' && (
                        <a 
                          href={CARETAKER_PORTAL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowProfileDropdown(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            color: '#52b788',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            background: 'rgba(82, 183, 136, 0.1)'
                          }}
                        >
                          <i className="fa-solid fa-clock-user" style={{ color: '#52b788' }}></i> Caretaker Portal ↗
                        </a>
                      )}
                      {user.role === 'owner' && (
                        <Link 
                          to="/caretaker-apply" 
                          target="_blank"
                          rel="noopener noreferrer"
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
                          <i className="fa-solid fa-user-gear" style={{ color: '#0077b6' }}></i> Caretaker Status / Apply ↗
                        </Link>
                      )}
                      <button 
                        onClick={handleLogout}
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
                {location.pathname === '/join-us' ? 'Log In' : 'Sign In'}
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
