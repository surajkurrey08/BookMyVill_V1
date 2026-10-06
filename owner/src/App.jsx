import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import OwnerLogin from './components/OwnerLogin/OwnerLogin';
import OwnerSetup from './components/OwnerLogin/OwnerSetup';
import OwnerDashboard from './components/OwnerDashboard/OwnerDashboard';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'owner' && user.role !== 'admin') {
      sessionStorage.clear();
      localStorage.clear();
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    sessionStorage.clear();
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <div className="owner-app">
        <Routes>
          <Route path="/login" element={<OwnerLogin />} />
          <Route path="/owner-setup" element={<OwnerSetup />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <OwnerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/property/:propertyId/:section" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
          <Route path="/owner/property/:propertyId/:section" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
