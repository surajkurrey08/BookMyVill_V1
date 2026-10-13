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

const emptyLinks = Object.fromEntries(platforms.map(platform => [platform.key, '']));

// Same checks as the server, so the admin sees problems before pressing Save.
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

const readError = async (response, fallback) => {
  if (response.status === 401 || response.status === 403) {
    return { msg: 'Your login has expired. Please log out and log in again.' };
  }
  const result = await response.json().catch(() => ({}));
  return { msg: result.msg || fallback, errors: result.errors || {} };
};

export default function SocialLinksManager() {
  const [links, setLinks] = useState(emptyLinks);
  const [savedLinks, setSavedLinks] = useState(emptyLinks);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });

  const loadLinks = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-links`, {
        headers: { 'x-auth-token': readAdminSession()?.token }
      });
      if (!response.ok) {
        const { msg } = await readError(response, 'Could not load the saved links. Please refresh the page.');
        throw new Error(msg);
      }
      const result = await response.json();
      const loaded = { ...emptyLinks, ...(result.links || {}) };
      setLinks(loaded);
      setSavedLinks(loaded);
    } catch (error) {
      setLoadError(error.name === 'TypeError'
        ? 'Cannot reach the server. Check your internet connection and try again.'
        : error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const hasChanges = platforms.some(platform => links[platform.key].trim() !== savedLinks[platform.key]);

  const updateLink = (key, value) => {
    setLinks(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
    setNotice({ type: '', message: '' });
  };

  const validateField = platform => {
    setErrors(current => ({ ...current, [platform.key]: checkLink(platform, links[platform.key]) }));
  };

  const saveLinks = async event => {
    event.preventDefault();
    setNotice({ type: '', message: '' });

    const nextErrors = Object.fromEntries(platforms.map(platform => [platform.key, checkLink(platform, links[platform.key])]));
    const badFields = platforms.filter(platform => nextErrors[platform.key]);
    setErrors(nextErrors);
    if (badFields.length) {
      setNotice({
        type: 'error',
        message: badFields.length === 1
          ? `Please fix the ${badFields[0].label} link before saving.`
          : `Please fix the ${badFields.length} links marked in red before saving.`
      });
      document.getElementById(`social-${badFields[0].key}`)?.focus();
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
        body: JSON.stringify(links)
      });

      if (!response.ok) {
        const { msg, errors: fieldErrors } = await readError(response, 'Could not save right now. Please try again in a moment.');
        setErrors(fieldErrors || {});
        setNotice({ type: 'error', message: msg });
        return;
      }

      const result = await response.json();
      const saved = { ...emptyLinks, ...(result.links || {}) };
      setLinks(saved);
      setSavedLinks(saved);
      setNotice({ type: 'success', message: result.msg || 'Saved. The website footer now shows these links.' });
    } catch {
      setNotice({ type: 'error', message: 'Cannot reach the server. Check your internet connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="social-manager-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading saved links...</p>;
  }

  if (loadError) {
    return (
      <div className="social-manager-notice error" role="alert">
        <span><i className="fa-solid fa-circle-exclamation"></i> {loadError}</span>
        <button type="button" className="social-manager-retry" onClick={loadLinks}>Try again</button>
      </div>
    );
  }

  const activeCount = platforms.filter(platform => savedLinks[platform.key]).length;

  return (
    <div className="social-manager">
      <div className="social-manager-intro">
        <div>
          <h2>Footer Social Links</h2>
          <p>Paste the link to each page. Leave a box empty to hide that icon from the website.</p>
        </div>
        <span className="social-manager-count">{activeCount} of {platforms.length} shown</span>
      </div>

      <form className="social-manager-card" onSubmit={saveLinks} noValidate>
        {platforms.map(platform => {
          const value = links[platform.key];
          const error = errors[platform.key];
          const isLive = Boolean(savedLinks[platform.key]);

          return (
            <div key={platform.key} className={`social-manager-row ${error ? 'has-error' : ''}`}>
              <label htmlFor={`social-${platform.key}`} className="social-manager-label">
                <span className="social-manager-icon"><i className={platform.icon}></i></span>
                {platform.label}
                <span className={`social-manager-status ${isLive ? 'live' : ''}`}>
                  {isLive ? 'Shown on website' : 'Hidden'}
                </span>
              </label>

              <div className="social-manager-input-wrap">
                <input
                  id={`social-${platform.key}`}
                  type="url"
                  inputMode="url"
                  value={value}
                  onChange={event => updateLink(platform.key, event.target.value)}
                  onBlur={() => validateField(platform)}
                  placeholder={platform.example}
                  autoComplete="off"
                  spellCheck="false"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `social-${platform.key}-error` : undefined}
                />
                {value && (
                  <button
                    type="button"
                    className="social-manager-clear"
                    onClick={() => updateLink(platform.key, '')}
                    aria-label={`Clear ${platform.label} link`}
                    title="Clear"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {error && (
                <p id={`social-${platform.key}-error`} className="social-manager-error">
                  <i className="fa-solid fa-circle-exclamation"></i> {error}
                </p>
              )}
            </div>
          );
        })}

        {notice.message && (
          <div className={`social-manager-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
            <span>
              <i className={`fa-solid ${notice.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i> {notice.message}
            </span>
          </div>
        )}

        <div className="social-manager-actions">
          <button className="social-manager-save" type="submit" disabled={saving || !hasChanges}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : 'Save Changes'}
          </button>
          {hasChanges && !saving && (
            <button
              type="button"
              className="social-manager-undo"
              onClick={() => { setLinks(savedLinks); setErrors({}); setNotice({ type: '', message: '' }); }}
            >
              Undo changes
            </button>
          )}
          {!hasChanges && <span className="social-manager-hint">No unsaved changes</span>}
        </div>
      </form>
    </div>
  );
}
