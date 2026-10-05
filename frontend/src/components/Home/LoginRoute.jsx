import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HomePage from './HomePage';
import LoginModal from './LoginModal';
import { saveSession } from '../../lib/session';

// /signin, /login and /register all open the mobile-number login modal over the
// home page. Pages that need a signed-in guest redirect here with `state.from`,
// and the guest is sent back there once logged in.
const LoginRoute = ({ initialTab = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClose = useCallback(() => navigate('/', { replace: true }), [navigate]);

  const handleSuccess = (token, user) => {
    saveSession(token, user);
    navigate(location.state?.from || '/', { replace: true, state: { property: location.state?.property } });
  };

  return (
    <>
      <HomePage />
      <LoginModal open initialTab={initialTab} onClose={handleClose} onSuccess={handleSuccess} />
    </>
  );
};

export default LoginRoute;
