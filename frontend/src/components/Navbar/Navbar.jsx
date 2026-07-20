import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
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
    <header className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="logo-link">
          <div className="logo">
            <span className="logo-text">Mahabaleshwar</span>
            <span className="logo-subtext">LUXURY STAYS</span>
          </div>
        </Link>

        <nav className="nav-links">
          <Link to="/" onClick={() => scrollToSection('home')}>Home</Link>
          <a href="#explore" onClick={(e) => { e.preventDefault(); scrollToSection('explore'); }}>Explore Stays</a>
          
          {user ? (
            <div className="user-profile">
              <Link to="/dashboard" className="dashboard-link">
                <i className="fa-solid fa-user-circle"></i> Dashboard
              </Link>
              <span className="user-name">Hi, {user.name ? user.name.split(' ')[0] : 'User'}</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/signin" className="btn-primary signin-btn">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
