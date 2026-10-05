import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, ADMIN_PORTAL_URL, OWNER_PORTAL_URL } from '../../config';
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

// POSTs JSON to the auth API; resolves to { ok, status, data }.
const postAuth = async (path, body) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/phone/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const NETWORK_ERROR = 'Could not reach the server. Please check your connection.';

const useCooldown = () => {
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  return [cooldown, () => setCooldown(RESEND_COOLDOWN)];
};

// No SMS gateway yet: the backend returns the code and we show it here so the
// guest can type it in.
const DemoOtpNotice = ({ otp }) => (otp ? (
  <div className="hp-modal-dev-otp" role="status">
    <span><i className="fa-solid fa-circle-info"></i> Demo OTP (SMS not set up yet)</span>
    <strong>{otp}</strong>
  </div>
) : null);

const OtpField = ({ value, onChange, autoFocus }) => (
  <label className="hp-modal-field">
    <span>Enter OTP</span>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="6-digit code"
      className="hp-modal-otp-input"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(cleanDigits(e.target.value).slice(0, 6))}
    />
  </label>
);

const PhoneChip = ({ phone, verified, onChange }) => (
  <div className="hp-modal-phone-chip">
    <span>
      <i className={`fa-solid ${verified ? 'fa-circle-check' : 'fa-mobile-screen'}`}></i> +91 {phone}
      {verified && <em> Verified</em>}
    </span>
    <button type="button" onClick={onChange}>Change</button>
  </div>
);

const ResendButton = ({ cooldown, loading, onClick }) => (
  <button type="button" className="hp-modal-resend" onClick={onClick} disabled={cooldown > 0 || loading}>
    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
  </button>
);

// Returning guest: mobile number, then either password or OTP.
const LoginTab = ({ onSuccess, onSwitchToRegister }) => {
  const [method, setMethod] = useState('password'); // 'password' | 'otp'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, startCooldown] = useCooldown();

  const resetOtp = () => {
    setOtpSent(false);
    setOtp('');
    setDevOtp('');
  };

  const switchMethod = (next) => {
    setMethod(next);
    setError('');
    resetOtp();
  };

  const changePhone = (value) => {
    setPhone(value);
    if (otpSent) resetOtp();
  };

  const sendOtp = async () => {
    const phoneErr = validatePhone(phone);
    if (phoneErr) return setError(phoneErr);
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await postAuth('send-otp', { phone, purpose: 'login' });
      if (!ok) return setError(data.msg || 'Could not send OTP. Please try again.');
      setDevOtp(data.otp || '');
      setOtp('');
      setOtpSent(true);
      startCooldown();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneErr = validatePhone(phone);
    if (phoneErr) return setError(phoneErr);
    if (method === 'password' && !password) return setError('Please enter your password.');
    if (method === 'otp' && !otpSent) return sendOtp();
    if (method === 'otp' && otp.length !== 6) return setError('Please enter the 6-digit OTP.');

    setError('');
    setLoading(true);
    try {
      const { ok, data } = method === 'password'
        ? await postAuth('login', { phone, password })
        : await postAuth('login-otp', { phone, otp });
      if (!ok) return setError(data.msg || 'Login failed. Please try again.');
      onSuccess(data.token, data.user);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = method === 'otp' && !otpSent ? 'Send OTP' : 'Log In';

  return (
    <form className="hp-modal-form" onSubmit={handleSubmit}>
      <PhoneField value={phone} onChange={changePhone} autoFocus />

      <div className="hp-modal-method" role="radiogroup" aria-label="Log in with">
        <button type="button" role="radio" aria-checked={method === 'password'} className={method === 'password' ? 'is-active' : ''} onClick={() => switchMethod('password')}>
          <i className="fa-solid fa-lock"></i> Password
        </button>
        <button type="button" role="radio" aria-checked={method === 'otp'} className={method === 'otp' ? 'is-active' : ''} onClick={() => switchMethod('otp')}>
          <i className="fa-solid fa-message"></i> OTP
        </button>
      </div>

      {method === 'password' && (
        <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Your password" />
      )}

      {method === 'otp' && otpSent && (
        <>
          <DemoOtpNotice otp={devOtp} />
          <OtpField value={otp} onChange={setOtp} autoFocus />
          <ResendButton cooldown={cooldown} loading={loading} onClick={sendOtp} />
        </>
      )}

      {error && <p className="hp-modal-error">{error}</p>}
      <button type="submit" className="hp-modal-submit" disabled={loading}>
        {loading ? 'Please wait…' : submitLabel}
      </button>
      <p className="hp-modal-switch">
        New to BookMyVilla?{' '}
        <button type="button" onClick={onSwitchToRegister}>Create an account</button>
      </p>
    </form>
  );
};

const REGISTER_STEPS = ['phone', 'otp', 'details'];

// New guest: mobile number → OTP → create password (then signed in).
const RegisterTab = ({ onSuccess, onSwitchToLogin }) => {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, startCooldown] = useCooldown();

  const sendOtp = async () => {
    const phoneErr = validatePhone(phone);
    if (phoneErr) return setError(phoneErr);
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await postAuth('send-otp', { phone, purpose: 'register' });
      if (!ok) return setError(data.msg || 'Could not send OTP. Please try again.');
      setDevOtp(data.otp || '');
      setOtp('');
      setStep('otp');
      startCooldown();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError('Please enter the 6-digit OTP.');
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await postAuth('verify-otp', { phone, otp });
      if (!ok) return setError(data.msg || 'Invalid OTP. Please try again.');
      setStep('details');
    } catch {
      setError(NETWORK_ERROR);
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
    if (nameErr) return setError(nameErr);
    if (passErr) return setError(passErr);
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (emailErr) return setError(emailErr);

    setError('');
    setLoading(true);
    try {
      const { ok, data } = await postAuth('register', { phone, otp, name, password, email: email.trim() });
      if (!ok) return setError(data.msg || 'Could not create your account. Please try again.');
      onSuccess(data.token, data.user);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = REGISTER_STEPS.indexOf(step);
  const stepper = (
    <ol className="hp-modal-steps" aria-label="Sign-up progress">
      {['Mobile', 'OTP', 'Password'].map((label, i) => (
        <li key={label} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
          <span>{i < stepIndex ? <i className="fa-solid fa-check"></i> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );

  if (step === 'phone') {
    return (
      <form className="hp-modal-form" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
        {stepper}
        <PhoneField value={phone} onChange={setPhone} autoFocus />
        {error && <p className="hp-modal-error">{error}</p>}
        <button type="submit" className="hp-modal-submit" disabled={loading}>
          {loading ? 'Sending OTP…' : 'Send OTP'}
        </button>
        <p className="hp-modal-switch">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin}>Log In</button>
        </p>
      </form>
    );
  }

  if (step === 'otp') {
    return (
      <form className="hp-modal-form" onSubmit={verifyOtp}>
        {stepper}
        <PhoneChip phone={phone} onChange={changeNumber} />
        <DemoOtpNotice otp={devOtp} />
        <OtpField value={otp} onChange={setOtp} autoFocus />
        <ResendButton cooldown={cooldown} loading={loading} onClick={sendOtp} />
        {error && <p className="hp-modal-error">{error}</p>}
        <button type="submit" className="hp-modal-submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify OTP'}
        </button>
      </form>
    );
  }

  return (
    <form className="hp-modal-form" onSubmit={handleRegister}>
      {stepper}
      <PhoneChip phone={phone} verified onChange={changeNumber} />

      <label className="hp-modal-field">
        <span>Full Name</span>
        <input type="text" value={name} placeholder="Your name" autoFocus onChange={(e) => setName(e.target.value)} />
      </label>

      <PasswordField label="Create Password" value={password} onChange={setPassword} placeholder="At least 6 characters" />
      <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" />

      <label className="hp-modal-field">
        <span>Email (optional)</span>
        <input type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
      </label>

      {error && <p className="hp-modal-error">{error}</p>}
      <button type="submit" className="hp-modal-submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account & Log In'}
      </button>
    </form>
  );
};

const LoginModal = ({ open, onClose, onSuccess, initialTab = 'login' }) => {
  const [tab, setTab] = useState(initialTab);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setTab(initialTab);
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
  }, [open, onClose, initialTab]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="hp-modal-overlay" onMouseDown={handleOverlayClick} role="presentation">
      {/* data-lenis-prevent: Lenis is stopped while the modal is open and would
          otherwise swallow wheel/touch scrolling inside the card too. */}
      <div className="hp-modal-card" role="dialog" aria-modal="true" aria-label="Log in or create an account" ref={dialogRef} data-lenis-prevent>
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
          <LoginTab onSuccess={onSuccess} onSwitchToRegister={() => setTab('register')} />
        ) : (
          <RegisterTab onSuccess={onSuccess} onSwitchToLogin={() => setTab('login')} />
        )}

        <p className="hp-modal-footnote">
          Property Owner or Admin? <a href={`${OWNER_PORTAL_URL}/login`}>Owner Portal</a> · <a href={ADMIN_PORTAL_URL}>Admin Portal</a>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
