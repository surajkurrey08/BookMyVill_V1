import { useEffect, useState } from 'react';
import { COOKIE_SETTINGS_EVENT, getCookieConsent, setCookieConsent } from '../../lib/cookies';
import './CookieConsent.css';

const CookieConsent = () => {
  const [open, setOpen] = useState(() => getCookieConsent() === null);

  // Footer "Cookie Settings" reopens the banner so the choice can be changed.
  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    setCookieConsent(value);
    setOpen(false);
  };

  return (
    <section className="bmv-cookie" role="dialog" aria-live="polite" aria-label="Cookie preferences">
      <div className="bmv-cookie-icon" aria-hidden="true">
        <i className="fa-solid fa-cookie-bite"></i>
      </div>
      <div className="bmv-cookie-body">
        <strong>We use cookies</strong>
        <p>
          Essential cookies keep you signed in and remember your choices. With your permission we
          also use optional cookies to understand how the site is used and improve your stay search.
        </p>
      </div>
      <div className="bmv-cookie-actions">
        <button type="button" className="bmv-cookie-btn is-primary" onClick={() => choose('all')}>
          Accept all
        </button>
        <button type="button" className="bmv-cookie-btn" onClick={() => choose('necessary')}>
          Only necessary
        </button>
      </div>
    </section>
  );
};

export default CookieConsent;
