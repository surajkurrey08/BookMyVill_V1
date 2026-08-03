import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin/AdminLogin';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import './App.css';

// Route protection component
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
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
      <div className="admin-app">
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          {/* Catch-all redirects to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
