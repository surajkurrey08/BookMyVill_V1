import React from 'react';
import './BrandLogo.css';

// Shared wordmark used by both the redesigned Home page header/footer and
// the site-wide Navbar/Footer, so the brand looks identical everywhere.
const BrandLogo = () => (
  <span className="bmv-logo">
    <span className="bmv-logo-row">
      <span className="bmv-logo-name">BookMyVilla</span>
      <svg className="bmv-logo-peaks" viewBox="0 0 48 22" aria-hidden="true">
        <path d="M1 21 L15 5 L22 13 L30 3 L47 21" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M26 8 L30 3 L34 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
    <span className="bmv-logo-line" aria-hidden="true"></span>
  </span>
);

export default BrandLogo;
