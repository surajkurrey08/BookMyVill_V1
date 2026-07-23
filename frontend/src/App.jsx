import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Lenis from 'lenis';
import Navbar from './components/Navbar/Navbar';
import Hero from './components/Hero/Hero';
import Features from './components/Features/Features';
import Destinations from './components/Destinations/Destinations';
import PropertyGrid from './components/PropertyGrid/PropertyGrid';
import Footer from './components/Footer/Footer';
import SignIn from './components/SignIn/SignIn';
import Register from './components/Register/Register';
import PropertyDetails from './components/PropertyDetails/PropertyDetails';
import UserDashboard from './components/UserDashboard/UserDashboard';
import UserProfile from './components/UserProfile/UserProfile';
import CaretakerApply from './components/Caretaker/CaretakerApply';
import Packages from './components/Packages/Packages';
import JoinUs from './components/JoinUs/JoinUs';
import AboutUs from './components/AboutUs/AboutUs';
import RegistrationForm from './components/RegistrationForm/RegistrationForm';
import ExploreStaysPage from './components/ExploreStays/ExploreStaysPage';
import './App.css';
import 'lenis/dist/lenis.css';

const AdminRedirect = () => {
  useEffect(() => {
    window.location.replace('http://localhost:5174');
  }, []);
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

const Home = () => {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Destinations />
        <PropertyGrid isHomePage={true} />
      </main>
      <Footer />
    </>
  );
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

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="/property/:id" element={<PropertyDetails />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/caretaker-apply" element={<CaretakerApply />} />
          <Route path="/explore" element={<ExploreStaysPage />} />
          <Route path="/explore-stays" element={<ExploreStaysPage />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/join-us" element={<JoinUs />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
