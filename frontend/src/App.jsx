import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import SignIn from './components/SignIn/SignIn';
import Register from './components/Register/Register';
import OwnerSetup from './components/OwnerSetup/OwnerSetup';
import UserDashboard from './components/UserDashboard/UserDashboard';
import UserProfile from './components/UserProfile/UserProfile';
import CaretakerApply from './components/Caretaker/CaretakerApply';
import Packages from './components/Packages/Packages';
import JoinUs from './components/JoinUs/JoinUs';
import AboutUs from './components/AboutUs/AboutUs';
import CaretakerDashboard from './components/Caretaker/CaretakerDashboard';
import RegistrationForm from './components/RegistrationForm/RegistrationForm';
import ExploreStaysPage from './components/ExploreStays/ExploreStaysPage';
import AiAssistant from './components/AiAssistant/AiAssistant';
import HomePage from './components/Home/HomePage';
import { ADMIN_PORTAL_URL, OWNER_PORTAL_URL } from './config';
import './App.css';
import 'lenis/dist/lenis.css';

// Guest quotation links are opened directly from WhatsApp/email; load the page on demand.
const QuoteView = lazy(() => import('./components/QuoteView/QuoteView'));
const TripPage = lazy(() => import('./components/Trip/TripPage'));
const PropertyPage = lazy(() => import('./components/BookingFlow/PropertyPage'));
const RoomsPage = lazy(() => import('./components/BookingFlow/RoomsPage'));
const CheckoutPage = lazy(() => import('./components/BookingFlow/CheckoutPage'));
const ConfirmedPage = lazy(() => import('./components/BookingFlow/ConfirmedPage'));

const AccessRestrictedModal = ({ title, message }) => {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      backgroundColor: '#0b110f',
      color: '#f2ece4',
      textAlign: 'center',
      padding: '40px 20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '24px',
        padding: '40px 30px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 20px auto'
        }}>
          <i className="fa-solid fa-user-lock"></i>
        </div>

        <span style={{
          display: 'inline-block',
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#d4af37',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '8px'
        }}>
          Traveler Account Access Limit
        </span>

        <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#ffffff', marginBottom: '12px', fontSize: '1.6rem' }}>
          {title || 'Restricted Portal Access'}
        </h2>

        <p style={{ color: '#a3b18a', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '28px' }}>
          {message || 'Your account is registered as a Traveler / Guest User with limited access. Admin, Owner Host, and Caretaker Command Centers require partner credentials.'}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-suitcase"></i> Go to Guest Dashboard
          </button>
          <button 
            onClick={() => navigate('/explore')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Explore Stays
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminRedirect = () => {
  const userStr = sessionStorage.getItem('user');
  let isTraveler = false;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.role === 'user' || u.role === 'traveller') isTraveler = true;
    } catch (e) {}
  }

  useEffect(() => {
    if (!isTraveler) {
      window.location.replace(ADMIN_PORTAL_URL);
    }
  }, [isTraveler]);

  if (isTraveler) {
    return <AccessRestrictedModal title="Admin Command Center Restricted" message="Your account is registered as a Traveler / Guest user with limited access. Admin command access requires administrator credentials." />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0b110f',
      color: '#f2ece4',
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#d4af37', marginBottom: '10px' }}>
        Redirecting to Secure Admin Portal
      </h2>
      <p style={{ color: '#859690', fontSize: '0.9rem' }}>
        Please wait while we establish a secure link...
      </p>
    </div>
  );
};

const OwnerRedirect = () => {
  const userStr = sessionStorage.getItem('user');
  let isTraveler = false;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.role === 'user' || u.role === 'traveller') isTraveler = true;
    } catch (e) {}
  }

  useEffect(() => {
    if (!isTraveler) {
      window.location.replace(OWNER_PORTAL_URL);
    }
  }, [isTraveler]);

  if (isTraveler) {
    return <AccessRestrictedModal title="Property Owner Portal Restricted" message="Your account is registered as a Traveler / Guest user with limited access. Host dashboard access requires approved property owner credentials." />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0b110f',
      color: '#f2ece4',
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#d4af37', marginBottom: '10px' }}>
        Redirecting to Property Owner Portal
      </h2>
      <p style={{ color: '#859690', fontSize: '0.9rem' }}>
        Opening your host command center...
      </p>
    </div>
  );
};

const ProtectedCaretakerDashboard = () => {
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u.role === 'user' || u.role === 'traveller') {
        return <AccessRestrictedModal title="Caretaker Command Center Restricted" message="Your account is registered as a Traveler / Guest user with limited access. Caretaker dashboard access requires caretaker host credentials." />;
      }
    } catch (e) {}
  }
  return <CaretakerDashboard />;
};

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.05,
      wheelMultiplier: 0.8,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Exposed so overlays (e.g. the login modal) can pause/resume Lenis —
    // Lenis drives scroll via JS, so `overflow: hidden` on the body alone
    // doesn't stop it.
    window.__lenis = lenis;

    return () => {
      lenis.destroy();
      if (window.__lenis === lenis) window.__lenis = null;
    };
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route path="/owner-setup" element={<OwnerSetup />} />
          <Route path="/register-property" element={
            <>
              <Navbar />
              <div style={{ paddingTop: '80px' }}>
                <RegistrationForm />
              </div>
              <Footer />
            </>
          } />
          <Route path="/admin" element={<AdminRedirect />} />
          <Route path="/owner" element={<OwnerRedirect />} />
          <Route path="/owner-dashboard" element={<OwnerRedirect />} />
          <Route path="/property/:id" element={<Suspense fallback={null}><PropertyPage /></Suspense>} />
          <Route path="/property/:id/rooms" element={<Suspense fallback={null}><RoomsPage /></Suspense>} />
          <Route path="/booking/checkout/:holdId" element={<Suspense fallback={null}><CheckoutPage /></Suspense>} />
          <Route path="/booking/:bookingId/confirmed" element={<Suspense fallback={null}><ConfirmedPage /></Suspense>} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/caretaker-apply" element={<CaretakerApply />} />
          <Route path="/caretaker-dashboard" element={<ProtectedCaretakerDashboard />} />
          <Route path="/explore" element={<ExploreStaysPage />} />
          <Route path="/explore-stays" element={<ExploreStaysPage />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/join-us" element={<JoinUs />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/quote/:token" element={<Suspense fallback={null}><QuoteView /></Suspense>} />
          <Route path="/trips/:id" element={<Suspense fallback={null}><TripPage /></Suspense>} />
        </Routes>
        <AiAssistant />
      </div>
    </Router>
  );
}

export default App;
