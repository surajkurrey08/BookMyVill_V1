import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './LoginModal.css';

const RESEND_COOLDOWN = 30; // seconds

const cleanDigits = (val) => (val || '').replace(/\D/g, '');

const validatePhone = (digits) => {
  if (!digits) return 'Mobile number is required.';
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit mobile number.';
  return '';
};

const validateName = (val) => {
  const trimmed = (val || '').trim();
  if (!trimmed) return 'Full name is required.';
  if (/\d/.test(trimmed)) return 'Name cannot contain numbers.';
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Name can only contain letters.';
  return '';
};

const validatePassword = (val) => {
  if (!val) return 'Password is required.';
  if (val.length < 6) return 'Password must be at least 6 characters.';
  return '';
};

const validateEmail = (val) => {
  if (!val) return ''; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Enter a valid email address.';
  return '';
};

const PhoneField = ({ value, onChange, disabled, autoFocus }) => (
  <label className="hp-modal-field">
    <span>Mobile Number</span>
    <div className="hp-modal-phone-row">
      <span className="hp-modal-phone-prefix">+91</span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="98765 43210"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => onChange(cleanDigits(e.target.value).slice(0, 10))}
      />
    </div>
  </label>
);

const PasswordField = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <label className="hp-modal-field">
      <span>{label}</span>
      <div className="hp-modal-password-row">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="hp-modal-eye" onClick={() => setShow((s) => !s)} tabIndex={-1}>
          <i className={`fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
      </div>
    </label>
  );
};

const LoginTab = ({ onSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneErr = validatePhone(phone);
    if (phoneErr) return setError(phoneErr);
    if (!password) return setError('Please enter your password.');

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.msg || 'Login failed. Please try again.');
        return;
      }
      onSuccess(data.token, data.user);
    } catch {
      setError('Could not reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="hp-modal-form" onSubmit={handleSubmit}>
      <PhoneField value={phone} onChange={setPhone} autoFocus />
      <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Your password" />
      {error && <p className="hp-modal-error">{error}</p>}
      <button type="submit" className="hp-modal-submit" disabled={loading}>
        {loading ? 'Logging in…' : 'Log In'}
      </button>
    </form>
  );
};

const RegisterTab = ({ onSuccess, onSwitchToLogin }) => {
  const [step, setStep] = useState('phone'); // 'phone' | 'details'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    const phoneErr = validatePhone(phone);
    if (phoneErr) return setError(phoneErr);

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError(data.msg || 'This number is already registered.');
          return;
        }
        setError(data.msg || 'Could not send OTP. Please try again.');
        return;
      }
      setDevOtp(data.otp || '');
      setStep('details');
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError('Could not reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const changeNumber = () => {
    setStep('phone');
    setOtp('');
    setDevOtp('');
    setError('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const nameErr = validateName(name);
    const passErr = validatePassword(password);
    const emailErr = validateEmail(email);
    if (!otp.trim()) return setError('Please enter the OTP sent to your mobile number.');
    if (nameErr) return setError(nameErr);
    if (passErr) return setError(passErr);
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (emailErr) return setError(emailErr);

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otp.trim(), name, password, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.msg || 'Could not create your account. Please try again.');
        return;
      }
      onSuccess(data.token, data.user);
    } catch {
      setError('Could not reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <div className="hp-modal-form">
        <PhoneField value={phone} onChange={setPhone} autoFocus />
        {error && <p className="hp-modal-error">{error}</p>}
        <button type="button" className="hp-modal-submit" onClick={sendOtp} disabled={loading}>
          {loading ? 'Sending OTP…' : 'Send OTP'}
        </button>
        <p className="hp-modal-switch">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin}>Log In</button>
        </p>
      </div>
    );
  }

  return (
    <form className="hp-modal-form" onSubmit={handleRegister}>
      <div className="hp-modal-phone-chip">
        <span><i className="fa-solid fa-mobile-screen"></i> +91 {phone}</span>
        <button type="button" onClick={changeNumber}>Change</button>
      </div>

      {devOtp && (
        <p className="hp-modal-dev-otp">
          <i className="fa-solid fa-circle-info"></i> Dev mode — no SMS set up yet. Your OTP is <strong>{devOtp}</strong>.
        </p>
      )}

      <label className="hp-modal-field">
        <span>Enter OTP</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit code"
          value={otp}
          onChange={(e) => setOtp(cleanDigits(e.target.value).slice(0, 6))}
        />
      </label>

      <button
        type="button"
        className="hp-modal-resend"
        onClick={sendOtp}
        disabled={cooldown > 0 || loading}
      >
        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
      </button>

      <label className="hp-modal-field">
        <span>Full Name</span>
        <input type="text" value={name} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
      </label>

      <PasswordField label="Create Password" value={password} onChange={setPassword} placeholder="At least 6 characters" />
      <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" />

      <label className="hp-modal-field">
        <span>Email (optional)</span>
        <input type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
      </label>

      {error && <p className="hp-modal-error">{error}</p>}
      <button type="submit" className="hp-modal-submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
};

const LoginModal = ({ open, onClose, onSuccess }) => {
  const [tab, setTab] = useState('login');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setTab('login');
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // The site uses Lenis for smooth scrolling, which drives scroll via JS
    // (wheel/touch handlers), so it keeps scrolling the page underneath
    // even with the body's native overflow hidden — stop it explicitly too.
    window.__lenis?.stop();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.__lenis?.start();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="hp-modal-overlay" onMouseDown={handleOverlayClick} role="presentation">
      <div className="hp-modal-card" role="dialog" aria-modal="true" aria-label="Log in or create an account" ref={dialogRef}>
        <button type="button" className="hp-modal-close" onClick={onClose} aria-label="Close">
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="hp-modal-head">
          <span className="hp-eyebrow">Welcome to BookMyVilla</span>
          <h3>{tab === 'login' ? 'Log In' : 'Create Your Account'}</h3>
        </div>

        <div className="hp-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'is-active' : ''}
            onClick={() => setTab('login')}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={tab === 'register' ? 'is-active' : ''}
            onClick={() => setTab('register')}
          >
            New User
          </button>
        </div>

        {tab === 'login' ? (
          <LoginTab onSuccess={onSuccess} />
        ) : (
          <RegisterTab onSuccess={onSuccess} onSwitchToLogin={() => setTab('login')} />
        )}

        <p className="hp-modal-footnote">
          Property Owner, Admin or Caretaker? <Link to="/signin" onClick={onClose}>Log in here</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
