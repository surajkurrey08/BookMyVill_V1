import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginModal from './LoginModal';
import { CONSENT_EVENT, getCookie, getCookieConsent, setCookie } from '../../lib/cookies';
import { isSignedIn, saveSession } from '../../lib/session';

// Opens the login modal by itself for a visitor who isn't signed in, shortly
// after the site loads (and after they've answered the cookie banner). Once
// shown, a cookie stops it from reappearing on every page load.

const PROMPT_COOKIE = 'bmv_login_prompted';
const PROMPT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
const DELAY_MS = 2500;
const DELAY_AFTER_CONSENT_MS = 1200;

// Pages with their own sign-in flow, or that guests open from a shared link.
const SKIP_PATHS = /^\/(signin|login|register|owner-setup|owner|owner-dashboard|admin|caretaker-apply|caretaker-dashboard|quote|booking)(\/|$)/;

const WelcomeLoginPrompt = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const skip = SKIP_PATHS.test(location.pathname);

  useEffect(() => {
    if (open || skip || isSignedIn() || getCookie(PROMPT_COOKIE)) return undefined;

    let timer;
    const schedule = (delay) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isSignedIn() || getCookie(PROMPT_COOKIE)) return;
        setCookie(PROMPT_COOKIE, '1', PROMPT_COOLDOWN_SECONDS);
        setOpen(true);
      }, delay);
    };

    if (getCookieConsent()) {
      schedule(DELAY_MS);
      return () => clearTimeout(timer);
    }

    const onConsent = () => schedule(DELAY_AFTER_CONSENT_MS);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [open, skip]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleSuccess = (token, user) => {
    saveSession(token, user);
    setOpen(false);
  };

  return <LoginModal open={open && !skip} onClose={handleClose} onSuccess={handleSuccess} />;
};

export default WelcomeLoginPrompt;
