import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoginModal from './LoginModal';
import BrandLogo from '../Brand/BrandLogo';
import { OWNER_PORTAL_URL, CARETAKER_PORTAL_URL } from '../../config';

const readUser = () => {
  try {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Same links as the site-wide Navbar, so both headers offer one menu.
const navItems = [
  { label: 'Home', top: true },
  { label: 'Explore Stays', to: '/explore' },
  { label: 'Packages', to: '/packages' },
  { label: 'About Us', to: '/about-us' },
  { label: 'Join Us', to: '/join-us' },
];

const HomeHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState(readUser);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [profileOpen]);

  const handleNav = (item) => {
    setMenuOpen(false);
    if (item.top) {
      if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
      else {
        navigate('/');
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      }
    }
    else if (item.to) navigate(item.to);
  };

  const handleLogout = () => {
    const isOwner = user?.role === 'owner';
    ['token', 'user'].forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
    setUser(null);
    setProfileOpen(false);
    if (isOwner) window.location.href = `${OWNER_PORTAL_URL}/login`;
  };

  const handleLoginSuccess = (token, loggedInUser) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setLoginOpen(false);
    setMenuOpen(false);
  };

  return (
    <>
    <header className={`hp-header ${scrolled ? 'is-scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="hp-header-inner">
        <Link to="/" className="hp-header-logo" aria-label="BookMyVilla home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <BrandLogo />
        </Link>

        <nav className="hp-nav" aria-label="Primary">
          {navItems.map((item) =>
            item.to ? (
              <Link key={item.label} to={item.to} className={`hp-nav-link ${location.pathname === item.to ? 'is-active' : ''}`} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ) : (
              <button key={item.label} type="button" className={`hp-nav-link ${location.pathname === '/' ? 'is-active' : ''}`} onClick={() => handleNav(item)}>
                {item.label}
              </button>
            )
          )}
        </nav>

        <div className="hp-header-actions">
          {user ? (
            <div className="hp-profile" ref={profileRef}>
              <button type="button" className="hp-profile-btn" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen}>
                <span className="hp-avatar">{(user.name || 'U').charAt(0).toUpperCase()}</span>
                <span className="hp-profile-name">{user.name ? user.name.split(' ')[0] : 'Guest'}</span>
                <i className={`fa-solid fa-chevron-${profileOpen ? 'up' : 'down'}`}></i>
              </button>
              {profileOpen && (
                <div className="hp-profile-menu">
                  <div className="hp-profile-head">
                    <strong>{user.name}</strong>
                    <span>{user.email || (user.phone ? `+91 ${user.phone}` : '')}</span>
                  </div>
                  <Link to="/dashboard"><i className="fa-solid fa-suitcase-rolling"></i> My Bookings</Link>
                  <Link to="/profile"><i className="fa-solid fa-user-pen"></i> Edit Profile</Link>
                  {user.role === 'owner' && (
                    <a href={OWNER_PORTAL_URL}><i className="fa-solid fa-building-user"></i> Host Portal</a>
                  )}
                  {user.role === 'caretaker' && (
                    <a href={CARETAKER_PORTAL_URL}><i className="fa-solid fa-user-gear"></i> Caretaker Portal</a>
                  )}
                  <button type="button" className="hp-logout" onClick={handleLogout}>
                    <i className="fa-solid fa-right-from-bracket"></i> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="hp-signin-btn" onClick={() => setLoginOpen(true)}>
              Log In
            </button>
          )}

          <button
            type="button"
            className="hp-burger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
        </div>
      </div>

      <nav className="hp-mobile-nav" aria-label="Mobile">
        {navItems.map((item) =>
          item.to ? (
            <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</Link>
          ) : (
            <button key={item.label} type="button" onClick={() => handleNav(item)}>{item.label}</button>
          )
        )}
      </nav>
    </header>

    {/* Rendered as a sibling (not inside <header>) so the fixed-position
        overlay is never trapped by the scrolled header's backdrop-filter,
        which can create a containing block for position:fixed children. */}
    <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleLoginSuccess} />
    </>
  );
};

export default HomeHeader;
