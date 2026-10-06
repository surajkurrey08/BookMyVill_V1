import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin/AdminLogin';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import AdminConsole from './components/Console/AdminConsole';
import { readAdminSession, clearAdminSession } from './session';
import './App.css';

// Route protection component
const ProtectedRoute = ({ children }) => {
  if (!readAdminSession()) {
    clearAdminSession();
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
          <Route 
            path="/console" 
            element={
              <ProtectedRoute>
                <AdminConsole />
              </ProtectedRoute>
            } 
          />
          {/* Catch-all redirects to dashboard */}
          <Route path="/" element={<Navigate to="/console" replace />} />
          <Route path="*" element={<Navigate to="/console" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
