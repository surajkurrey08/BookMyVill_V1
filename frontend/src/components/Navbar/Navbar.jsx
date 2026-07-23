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


          <nav className="nav-links-center">
            <Link to="/" onClick={() => scrollToSection('home')}>Home</Link>
            <Link to="/explore">Explore Stays</Link>
            <Link to="/packages">Packages</Link>
            <Link to="/join-us">Join Us</Link>
            <Link to="/about-us">About Us</Link>
          </nav>

          <div className="nav-right-container">
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
                      <a 
                        href="http://localhost:5175" 
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
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
