import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { readAdminSession } from '../../session';
import './SocialMediaLinksManager.css';

const platforms = [
  { key: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook-f', hosts: ['facebook.com', 'fb.com', 'fb.me'], example: 'https://facebook.com/your-page' },
  { key: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', hosts: ['instagram.com', 'instagr.am'], example: 'https://instagram.com/your-profile' },
  { key: 'x', label: 'X / Twitter', icon: 'fa-brands fa-twitter', hosts: ['x.com', 'twitter.com'], example: 'https://x.com/your-profile' },
  { key: 'youtube', label: 'YouTube', icon: 'fa-brands fa-youtube', hosts: ['youtube.com', 'youtu.be'], example: 'https://youtube.com/@your-channel' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', hosts: ['wa.me', 'whatsapp.com'], example: 'https://wa.me/919876543210' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', hosts: ['linkedin.com'], example: 'https://linkedin.com/company/your-page' }
];

const footerFields = [
  { key: 'footerDescription', label: 'Short description', type: 'textarea', limit: 240, hint: 'A short message shown below the BookMyVilla logo.' },
  { key: 'contactPhone', label: 'Phone number', type: 'tel', limit: 30, icon: 'fa-solid fa-phone', placeholder: '+91 98765 43210' },
  { key: 'contactEmail', label: 'Email address', type: 'email', limit: 120, icon: 'fa-solid fa-envelope', placeholder: 'support@bookmyvilla.com' },
  { key: 'contactLocation', label: 'Location', type: 'text', limit: 160, icon: 'fa-solid fa-location-dot', placeholder: 'Mahabaleshwar, Maharashtra, India' }
];

const defaultContent = {
  facebook: '', instagram: '', x: '', youtube: '', whatsapp: '', linkedin: '',
  footerDescription: 'Creating unforgettable experiences in the hills. Book your perfect stay and explore the beauty of Mahabaleshwar with us.',
  contactPhone: '+91 98765 43210',
  contactEmail: 'support@bookmyvilla.com',
  contactLocation: 'Mahabaleshwar, Maharashtra, India'
};

const checkLink = (platform, rawValue) => {
  let value = rawValue.trim();
  if (!value) return '';
  if (/\s/.test(value)) return 'Remove the spaces from this link.';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return `This doesn't look like a web link. Paste the full ${platform.label} page address.`;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'The link must start with https://';
  if (!platform.hosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {
    return `This link is not from ${platform.label}. It should start with https://${platform.hosts[0]}/`;
  }
  if (parsed.pathname.replace(/\//g, '') === '' && !parsed.search) {
    return `Add your page name after ${platform.hosts[0]}/ so visitors land on your ${platform.label} page.`;
  }
  return '';
};

const checkFooterField = (field, rawValue) => {
  const value = rawValue.trim();
  if (!value) return 'This field is required.';
  if (value.length > field.limit) return `Use ${field.limit} characters or fewer.`;
  if (field.key === 'contactEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  if (field.key === 'contactPhone' && !/^[+()\d\s-]{7,30}$/.test(value)) return 'Use a valid phone number with digits, spaces, +, - or brackets.';
  return '';
};

const readError = async (response, fallback) => {
  if (response.status === 401 || response.status === 403) {
    return { msg: 'Your login has expired. Please log out and log in again.' };
  }
  const result = await response.json().catch(() => ({}));
  return { msg: result.msg || fallback, errors: result.errors || {} };
};

export default function SocialLinksManager() {
  const [content, setContent] = useState(defaultContent);
  const [savedContent, setSavedContent] = useState(defaultContent);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });

  const loadContent = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-links`, {
        headers: { 'x-auth-token': readAdminSession()?.token }
      });
      if (!response.ok) {
        const { msg } = await readError(response, 'Could not load the footer content. Please refresh the page.');
        throw new Error(msg);
      }
      const result = await response.json();
      const loaded = { ...defaultContent, ...(result.footer || {}), ...(result.links || {}) };
      setContent(loaded);
      setSavedContent(loaded);
    } catch (error) {
      setLoadError(error.name === 'TypeError'
        ? 'Cannot reach the server. Check your internet connection and try again.'
        : error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const hasChanges = Object.keys(defaultContent).some(key => content[key].trim() !== savedContent[key].trim());

  const updateField = (key, value) => {
    setContent(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
    setNotice({ type: '', message: '' });
  };

  const saveContent = async event => {
    event.preventDefault();
    setNotice({ type: '', message: '' });

    const nextErrors = {};
    platforms.forEach(platform => { nextErrors[platform.key] = checkLink(platform, content[platform.key]); });
    footerFields.forEach(field => { nextErrors[field.key] = checkFooterField(field, content[field.key]); });
    const badFields = Object.keys(nextErrors).filter(key => nextErrors[key]);
    setErrors(nextErrors);
    if (badFields.length) {
      setNotice({
        type: 'error',
        message: badFields.length === 1 ? 'Please fix the field marked in red before saving.' : `Please fix the ${badFields.length} fields marked in red before saving.`
      });
      document.getElementById(`footer-${badFields[0]}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-links`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': readAdminSession()?.token
        },
        body: JSON.stringify(content)
      });

      if (!response.ok) {
        const { msg, errors: fieldErrors } = await readError(response, 'Could not save right now. Please try again in a moment.');
        setErrors(fieldErrors || {});
        setNotice({ type: 'error', message: msg });
        return;
      }

      const result = await response.json();
      const saved = { ...defaultContent, ...(result.footer || {}), ...(result.links || {}) };
      setContent(saved);
      setSavedContent(saved);
      setNotice({ type: 'success', message: result.msg || 'Saved. The website footer now shows the updated content.' });
    } catch {
      setNotice({ type: 'error', message: 'Cannot reach the server. Check your internet connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="social-manager-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading footer content...</p>;
  }

  if (loadError) {
    return (
      <div className="social-manager-notice error" role="alert">
        <span><i className="fa-solid fa-circle-exclamation"></i> {loadError}</span>
        <button type="button" className="social-manager-retry" onClick={loadContent}>Try again</button>
      </div>
    );
  }

  const activeCount = platforms.filter(platform => savedContent[platform.key]).length;

  return (
    <div className="social-manager">
      <div className="social-manager-intro">
        <div>
          <h2>Footer &amp; Social Links</h2>
          <p>Edit the contact details and links shown in the public website footer.</p>
        </div>
      </div>

      <form className="social-manager-card" onSubmit={saveContent} noValidate>
        <section className="social-manager-section" aria-labelledby="footer-contact-title">
          <div className="social-manager-section-heading">
            <div>
              <h3 id="footer-contact-title">Footer contact details</h3>
              <p>Visitors use these details to contact BookMyVilla.</p>
            </div>
          </div>

          <div className="social-manager-fields">
            {footerFields.map(field => {
              const error = errors[field.key];
              const inputId = `footer-${field.key}`;
              return (
                <div key={field.key} className={`social-manager-field ${field.type === 'textarea' || field.key === 'contactLocation' ? 'wide' : ''} ${error ? 'has-error' : ''}`}>
                  <label htmlFor={inputId}>
                    {field.icon && <i className={field.icon}></i>}
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={inputId}
                      rows="3"
                      maxLength={field.limit}
                      value={content[field.key]}
                      onChange={event => updateField(field.key, event.target.value)}
                      onBlur={() => setErrors(current => ({ ...current, [field.key]: checkFooterField(field, content[field.key]) }))}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
                    />
                  ) : (
                    <input
                      id={inputId}
                      type={field.type}
                      maxLength={field.limit}
                      value={content[field.key]}
                      placeholder={field.placeholder}
                      onChange={event => updateField(field.key, event.target.value)}
                      onBlur={() => setErrors(current => ({ ...current, [field.key]: checkFooterField(field, content[field.key]) }))}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                    />
                  )}
                  {field.hint && !error && <p id={`${inputId}-hint`} className="social-manager-help">{field.hint} <span>{content[field.key].length}/{field.limit}</span></p>}
                  {error && <p id={`${inputId}-error`} className="social-manager-error"><i className="fa-solid fa-circle-exclamation"></i> {error}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="social-manager-section" aria-labelledby="footer-social-title">
          <div className="social-manager-section-heading">
            <div>
              <h3 id="footer-social-title">Social media links</h3>
              <p>Leave a field empty to hide its icon from the website.</p>
            </div>
            <span className="social-manager-count">{activeCount} of {platforms.length} shown</span>
          </div>

          {platforms.map(platform => {
            const value = content[platform.key];
            const error = errors[platform.key];
            const isLive = Boolean(savedContent[platform.key]);
            const inputId = `footer-${platform.key}`;

            return (
              <div key={platform.key} className={`social-manager-row ${error ? 'has-error' : ''}`}>
                <label htmlFor={inputId} className="social-manager-label">
                  <span className="social-manager-icon"><i className={platform.icon}></i></span>
                  {platform.label}
                  <span className={`social-manager-status ${isLive ? 'live' : ''}`}>{isLive ? 'Shown on website' : 'Hidden'}</span>
                </label>
                <div className="social-manager-input-wrap">
                  <input
                    id={inputId}
                    type="url"
                    inputMode="url"
                    value={value}
                    onChange={event => updateField(platform.key, event.target.value)}
                    onBlur={() => setErrors(current => ({ ...current, [platform.key]: checkLink(platform, content[platform.key]) }))}
                    placeholder={platform.example}
                    autoComplete="off"
                    spellCheck="false"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                  />
                  {value && (
                    <button type="button" className="social-manager-clear" onClick={() => updateField(platform.key, '')} aria-label={`Clear ${platform.label} link`} title="Clear">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
                {error && <p id={`${inputId}-error`} className="social-manager-error"><i className="fa-solid fa-circle-exclamation"></i> {error}</p>}
              </div>
            );
          })}
        </section>

        {notice.message && (
          <div className={`social-manager-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
            <span><i className={`fa-solid ${notice.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i> {notice.message}</span>
          </div>
        )}

        <div className="social-manager-actions">
          <button className="social-manager-save" type="submit" disabled={saving || !hasChanges}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : 'Save Footer Content'}
          </button>
          {hasChanges && !saving && (
            <button type="button" className="social-manager-undo" onClick={() => { setContent(savedContent); setErrors({}); setNotice({ type: '', message: '' }); }}>
              Undo changes
            </button>
          )}
          {!hasChanges && <span className="social-manager-hint">No unsaved changes</span>}
        </div>
      </form>
    </div>
  );
}
