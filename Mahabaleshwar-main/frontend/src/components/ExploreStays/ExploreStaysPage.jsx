import React, { useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import PropertyGrid from '../PropertyGrid/PropertyGrid';
import Footer from '../Footer/Footer';

const ExploreStaysPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: '80px', minHeight: '80vh', backgroundColor: '#faf8f5' }}>
        <PropertyGrid isHomePage={false} />
      </div>
      <Footer />
    </>
  );
};

export default ExploreStaysPage;
