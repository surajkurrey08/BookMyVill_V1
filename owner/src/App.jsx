import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import OwnerLogin from './components/OwnerLogin/OwnerLogin';
import OwnerDashboard from './components/OwnerDashboard/OwnerDashboard';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'owner' && user.role !== 'admin') {
      localStorage.clear();
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
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
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <OwnerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
