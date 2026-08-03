import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CaretakerApply from './components/CaretakerApply/CaretakerApply';
import CaretakerDashboard from './components/CaretakerDashboard/CaretakerDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CaretakerDashboard />} />
        <Route path="/dashboard" element={<CaretakerDashboard />} />
        <Route path="/apply" element={<CaretakerApply />} />
      </Routes>
    </Router>
  );
}

export default App;
