import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SignIn.css';
import { API_BASE_URL } from '../../config';


const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Secure 2-Step Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // Step 1: Email Request, Step 2: Verification Code & Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtpDemo, setGeneratedOtpDemo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const validateField = (fieldName, value) => {
    let err = '';
    const trimmed = (value || '').trim();
    if (fieldName === 'email') {
      if (!trimmed) {
        err = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        err = 'Please enter a valid email address (e.g. name@example.com).';
      }
    }
    if (fieldName === 'password') {
      if (!value) {
        err = 'Password is required.';
      } else if (value.length < 6) {
        err = 'Password must be at least 6 characters long.';
      }
    }
    return err;
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setErrorMsg('');
    setFieldErrors(prev => ({ ...prev, email: validateField('email', val) }));
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setErrorMsg('');
    setFieldErrors(prev => ({ ...prev, password: validateField('password', val) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      setErrorMsg('Please correct the validation errors below before submitting.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const destination = location.state?.from || '/';
        navigate(destination, { state: { property: location.state?.property } });
      } else {
        setErrorMsg(data.msg || 'Invalid email or password. Please check your credentials or create an account.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Connection to server failed. Please check network connection.');
    }
  };

  // Step 1: Request Verification Code (OTP)
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotErrorMsg('');
    setForgotSuccessMsg('');

    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotErrorMsg('Please enter your registered email address.');
      return;
    }

    setIsSendingOtp(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await response.json();

      if (response.ok) {
        setGeneratedOtpDemo(data.otp);
        setForgotSuccessMsg(`Verification code sent! Your Security OTP is [ ${data.otp} ]`);
        setOtpStep(2);
      } else {
        setForgotErrorMsg(data.msg || 'Failed to send verification code. Check your email.');
      }
    } catch (err) {
      console.error('Request OTP error:', err);
      setForgotErrorMsg('Connection to server failed.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotErrorMsg('');

    if (!otpCode || otpCode.trim().length !== 6) {
      setForgotErrorMsg('Please enter the 6-digit verification OTP code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setForgotErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotErrorMsg('New password and confirmation password do not match.');
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otpCode, newPassword, confirmPassword })
      });
      const data = await response.json();

      if (response.ok) {
        setForgotSuccessMsg('✅ Password verified & reset successfully! Redirecting to login...');
        setEmail(forgotEmail);
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotSuccessMsg('');
          setForgotErrorMsg('');
          setForgotEmail('');
          setOtpCode('');
          setNewPassword('');
          setConfirmPassword('');
          setOtpStep(1);
        }, 2000);
      } else {
        setForgotErrorMsg(data.msg || 'Failed to verify code. Please check your OTP.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setForgotErrorMsg('Network error. Unable to reach authentication server.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="signin-container">
      <div style={{
        position: 'fixed',
        top: '25px',
        left: '25px',
        zIndex: 9999
      }}>
        <button 
          onClick={() => {
            if (window.history.length > 1 && window.history.state?.idx > 0) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          title="Go to previous page"
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#1a1a1a',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            padding: '9px 20px',
            borderRadius: '30px',
            fontSize: '0.9rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.25s ease'
          }}
        >
          <i className="fa-solid fa-arrow-left" style={{ color: '#2D433D' }}></i> Back
        </button>
      </div>
      <div className="signin-overlay"></div>
      <div className="signin-card glass-morphism fade-in">
        <div className="signin-header">
          <div className="logo">
            <span className="logo-text">BookMyVilla</span>
            <span className="logo-subtext">LUXURY RETREATS</span>
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to your luxury experience</p>
        </div>

        {location.state?.from && (
          <div style={{
            background: 'rgba(212, 175, 55, 0.18)',
            border: '1px solid #d4af37',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            <i className="fa-solid fa-user-lock" style={{ color: '#d4af37', fontSize: '1.1rem' }}></i>
            Please sign in to proceed with your hotel booking
          </div>
        )}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 71, 111, 0.18)',
            border: '1px solid #ef476f',
            color: '#ff6b6b',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '20px',
            fontSize: '0.88rem',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="signin-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={(e) => setFieldErrors(prev => ({ ...prev, email: validateField('email', e.target.value) }))}
              className={fieldErrors.email ? 'field-invalid' : ''}
              placeholder="name@example.com"
              required
            />
            {fieldErrors.email && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={(e) => setFieldErrors(prev => ({ ...prev, password: validateField('password', e.target.value) }))}
                className={fieldErrors.password ? 'field-invalid' : ''}
                placeholder="••••••••"
                required
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
            {fieldErrors.password && (
              <span className="form-error-msg">
                <i className="fa-solid fa-circle-exclamation"></i> {fieldErrors.password}
              </span>
            )}
            {/* Right-aligned Forgot Password button directly below password input */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button 
                type="button" 
                className="forgot-link" 
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                  setOtpStep(1);
                  setForgotErrorMsg('');
                  setForgotSuccessMsg('');
                }}
                style={{ background: 'none', border: 'none', color: '#d4af37', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button type="submit" className="signin-btn btn-primary" style={{ marginTop: '10px' }}>
            Sign In
          </button>
        </form>

        <div className="signin-footer">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </div>

      {/* Secure 2-Step OTP Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '30px 32px',
            maxWidth: '460px',
            width: '100%',
            color: '#1a1a1a',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            position: 'relative'
          }}>
            <button 
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f4f6f4',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: '#333'
              }}
            >
              ×
            </button>

            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '56px', height: '56px', background: '#fdfbf7', border: '1px solid #d4af37', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <i className={`fa-solid ${otpStep === 1 ? 'fa-shield-halved' : 'fa-lock-open'}`} style={{ color: '#d4af37', fontSize: '1.4rem' }}></i>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#0f382c', fontWeight: '800' }}>
                {otpStep === 1 ? 'Secure Password Reset' : 'Verify Code & Set Password'}
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.86rem', color: '#666' }}>
                {otpStep === 1 ? 'Step 1: Enter your email to receive a 6-digit verification OTP' : 'Step 2: Enter your 6-digit OTP code and choose a new password'}
              </p>
            </div>

            {forgotErrorMsg && (
              <div style={{ background: '#fff0f3', border: '1px solid #ff4d6d', color: '#c9184a', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '600' }}>
                ⚠️ {forgotErrorMsg}
              </div>
            )}

            {forgotSuccessMsg && (
              <div style={{ background: '#e8f5e9', border: '1px solid #2e7d32', color: '#1b5e20', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '600' }}>
                {forgotSuccessMsg}
              </div>
            )}

            {otpStep === 1 ? (
              /* STEP 1: Request OTP */
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f382c', marginBottom: '6px' }}>
                    Registered Email Address
                  </label>
                  <input 
                    type="email"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: '30px', border: '1px solid #ccc', background: '#f4f6f4', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', color: '#555' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSendingOtp}
                    style={{ flex: 1.5, padding: '11px', borderRadius: '30px', border: 'none', background: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#0b110f', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)' }}
                  >
                    {isSendingOtp ? 'Sending...' : 'Send Verification OTP'}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: Enter OTP & Reset Password */
              <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f382c', marginBottom: '6px' }}>
                    6-Digit Verification OTP Code
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. 849201"
                    maxLength="6"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '2px solid #d4af37', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '4px', textAlign: 'center', outline: 'none' }}
                  />
                  {generatedOtpDemo && (
                    <div style={{ fontSize: '0.78rem', color: '#d4af37', fontWeight: '700', marginTop: '4px', textAlign: 'center' }}>
                      Security Verification Code: <span style={{ background: '#fdfbf7', padding: '2px 8px', borderRadius: '10px', border: '1px solid #d4af37' }}>{generatedOtpDemo}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f382c', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showNewPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                    >
                      <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f382c', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <input 
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setOtpStep(1)}
                    style={{ flex: 1, padding: '11px', borderRadius: '30px', border: '1px solid #ccc', background: '#f4f6f4', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', color: '#555' }}
                  >
                    Back
                  </button>
                  <button 
                    type="submit"
                    disabled={isResetting}
                    style={{ flex: 1.5, padding: '11px', borderRadius: '30px', border: 'none', background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', color: '#ffffff', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(27, 67, 50, 0.3)' }}
                  >
                    {isResetting ? 'Verifying...' : 'Verify & Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignIn;
