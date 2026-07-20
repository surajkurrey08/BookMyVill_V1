import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../SignIn/SignIn.css';
import { API_BASE_URL } from '../../config';


const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      console.log('Registration Response Status:', response.status);
      console.log('Registration Response Data:', data);

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/');
      } else {
        alert(`${data.msg}: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('Connection to server failed');
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-overlay"></div>
      <div className="signin-card glass-morphism fade-in">
        <div className="signin-header">
          <div className="logo">
            <span className="logo-text">MAHABLESHWAR</span>
            <span className="logo-subtext">LUXURY RETREATS</span>
          </div>
          <h2>Join the Bliss</h2>
          <p>Create your luxury member account</p>
        </div>

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>I am a</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="role-select"
            >
              <option value="user">Traveler</option>
              <option value="owner">Property Owner</option>

            </select>
          </div>

          <button type="submit" className="signin-btn btn-primary">
            Create Account
          </button>
        </form>

        <div className="signin-footer">
          <p>Already have an account? <Link to="/signin">Sign In</Link></p>
        </div>

        <div className="back-to-home">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
