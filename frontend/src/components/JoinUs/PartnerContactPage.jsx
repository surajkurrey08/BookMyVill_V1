import { useState } from 'react';
import { Link } from 'react-router-dom';
import HomeFooter from '../Home/HomeFooter';
import RegistrationForm from '../RegistrationForm/RegistrationForm';
import { API_BASE_URL } from '../../config';
import '../Home/Home.css';
import './PartnerContactPage.css';

function PartnerContactForm({ inquiry }) {
  const [values, setValues] = useState({ fullName: '', email: '', phone: '', propertyName: '', city: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    const phone = values.phone.replace(/[\s()+.-]/g, '');
    if (!/^\d{10,15}$/.test(phone)) { setError('Enter a valid phone number with 10–15 digits.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/partner/${inquiry ? 'inquiry' : 'apply'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, phone, ...(!inquiry && { partnerType: 'Property Owner', applicationType: 'owner-registration' }) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.msg || 'Your request could not be saved. Please try again.');
      const saved = inquiry ? data.inquiry : data.application;
      if (!saved?._id) throw new Error('We could not confirm your request. Please contact the team before trying again.');
      setReceipt({ id: saved._id, message: data.msg });
    } catch (err) {
      setError(err instanceof TypeError ? 'Cannot reach our team right now. Please try again shortly.' : err.message);
    } finally { setBusy(false); }
  };

  if (receipt) return <div className="partner-contact-panel partner-contact-success" role="status">
    <i className="fa-solid fa-circle-check" aria-hidden="true" />
    <h2>{inquiry ? 'Inquiry sent' : 'Owner application sent'}</h2>
    <p>{receipt.message}</p>
    {!inquiry && <p>Our team will review your application. After approval, the admin will provide a link to set up your owner account.</p>}
    <p className="partner-receipt">Reference: {receipt.id}</p>
    <Link className="partner-submit" to="/join-us">Back to Join Us</Link>
  </div>;

  return <form className="partner-contact-panel" onSubmit={submit}>
    <h2>{inquiry ? 'How can we help?' : 'Apply for an owner account'}</h2>
    <p>{inquiry ? 'Send your partnership questions to our admin team.' : 'Apply without uploading property photos. Your account is created after admin approval.'}</p>
    <div className="partner-contact-fields">
      {[
        ['fullName', 'Full Name', 'text', true, 'Your full name', 100],
        ['email', 'Email Address', 'email', true, 'owner@example.com', 254],
        ['phone', 'Phone Number', 'tel', true, '+91 9876543210', 22],
        ['city', 'Property City', 'text', false, 'Mahabaleshwar / Panchgani', 100],
        ['propertyName', 'Property Name', 'text', false, 'Your villa, resort or boutique stay', 150],
      ].map(([name, label, type, required, placeholder, maxLength]) => <label key={name} className={name === 'propertyName' ? 'partner-wide-field' : ''}>
        <span>{label}{required ? ' *' : ' (optional)'}</span>
        <input name={name} type={type} required={required} minLength={name === 'fullName' ? 3 : undefined} maxLength={maxLength} autoComplete={name === 'fullName' ? 'name' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'off'} placeholder={placeholder} value={values[name]} onChange={e => setValues(previous => ({ ...previous, [name]: e.target.value }))} />
      </label>)}
      <label className="partner-wide-field"><span>{inquiry ? 'Your Inquiry *' : 'Message (optional)'}</span>
        <textarea name="message" required={inquiry} minLength={inquiry ? 10 : undefined} maxLength={2000} rows={5} placeholder={inquiry ? 'Tell us what you would like to know about partnering with BookMyVilla.' : 'Tell us about your property or anything our team should know.'} value={values.message} onChange={e => setValues(previous => ({ ...previous, message: e.target.value }))} />
      </label>
    </div>
    {error && <p className="partner-contact-error" role="alert">{error}</p>}
    <button className="partner-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : inquiry ? 'Send Inquiry to Admin' : 'Submit Owner Application'}<i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
    <p className="partner-form-note">We will contact you using the email or phone number provided.</p>
  </form>;
}

export default function PartnerContactPage({ inquiry = false }) {
  const [applicationMode, setApplicationMode] = useState('owner');
  return <div className="hp-root partner-contact-page">
    <main>
      <section className="partner-contact-intro">
        <Link to="/join-us">← Back to Join Us</Link>
        <h1>{inquiry ? 'Send a Partnership Inquiry' : 'List Your Property & Join Us'}</h1>
        <p>{inquiry ? 'Speak with our team about listing your stay or becoming a BookMyVilla partner.' : 'Apply for an owner account, or submit a complete property listing for review.'}</p>
        {!inquiry && <div className="partner-mode-switch" aria-label="Application type">
          <button type="button" aria-pressed={applicationMode === 'owner'} onClick={() => setApplicationMode('owner')}>Owner Registration</button>
          <button type="button" aria-pressed={applicationMode === 'property'} onClick={() => setApplicationMode('property')}>Property Listing</button>
        </div>}
      </section>
      {!inquiry && applicationMode === 'property' ? <RegistrationForm /> : <section className="partner-contact-body"><PartnerContactForm key={inquiry ? 'inquiry' : 'owner'} inquiry={inquiry} /></section>}
    </main>
    <HomeFooter />
  </div>;
}
