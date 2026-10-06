import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { readAdminSession } from '../../session';
import './HeroImageManager.css';

const pages = [
  { key: 'home', name: 'Home', detail: 'Main landing page' },
  { key: 'explore', name: 'Explore Stays', detail: 'Stay search and listings' },
  { key: 'packages', name: 'Packages', detail: 'Travel package collection' },
  { key: 'about', name: 'About Us', detail: 'Our story page' },
  { key: 'join', name: 'Join Us', detail: 'Partner registration page' },
];

const maxImageBytes = 8 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export default function HeroImageManager() {
  const [images, setImages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/site-heroes`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the current images.');
        return response.json();
      })
      .then((data) => setImages(data.images || {}))
      .catch((error) => { if (error.name !== 'AbortError') setNotice({ type: 'error', text: error.message }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const chooseImage = (key, file) => {
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setNotice({ type: 'error', text: 'Please choose a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > maxImageBytes) {
      setNotice({ type: 'error', text: 'Image must be 8 MB or smaller.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDrafts((current) => ({ ...current, [key]: { name: file.name, dataUrl: reader.result } }));
      setNotice(null);
    };
    reader.onerror = () => setNotice({ type: 'error', text: 'Could not read the selected file.' });
    reader.readAsDataURL(file);
  };

  const saveImage = async (key) => {
    const draft = drafts[key];
    if (!draft) return;
    setBusyKey(key);
    setNotice(null);
    try {
      const token = readAdminSession()?.token;
      const response = await fetch(`${API_BASE_URL}/api/site-heroes/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({ image: draft.dataUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'Could not save the image.');
      setImages((current) => ({ ...current, [key]: result.image }));
      setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      setNotice({ type: 'success', text: `${pages.find((page) => page.key === key).name} hero image updated. Refresh that page to see it.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusyKey('');
    }
  };

  const resetImage = async (key) => {
    setBusyKey(key);
    setNotice(null);
    try {
      const token = readAdminSession()?.token;
      const response = await fetch(`${API_BASE_URL}/api/site-heroes/${key}`, {
        method: 'DELETE', headers: { 'x-auth-token': token || '' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || 'Could not reset the image.');
      setImages((current) => ({ ...current, [key]: null }));
      setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      setNotice({ type: 'success', text: `${pages.find((page) => page.key === key).name} is using its original image again.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="hero-manager">
      <div className="hero-manager-intro">
        <div>
          <h2>Website Hero Images</h2>
          <p>Choose a separate cover image for each page. JPG, PNG and WebP files up to 8 MB are supported. Wide images work best.</p>
        </div>
        <span className="hero-manager-count">{pages.length} pages</span>
      </div>

      {notice && <div className={`hero-manager-notice ${notice.type}`} role="status">{notice.text}</div>}
      {loading && <p className="hero-manager-loading">Loading current images…</p>}

      <div className="hero-manager-grid">
        {pages.map((page) => {
          const draft = drafts[page.key];
          const saved = images[page.key];
          const previewUrl = draft?.dataUrl || (saved?.url ? `${API_BASE_URL}${saved.url}` : null);
          const busy = busyKey === page.key;
          return (
            <article className="hero-manager-card" key={page.key}>
              <div className="hero-manager-preview">
                {previewUrl ? <img src={previewUrl} alt={`${page.name} hero preview`} /> : <div className="hero-manager-default"><i className="fa-regular fa-image" aria-hidden="true" /><span>Original site image</span></div>}
                <span className="hero-manager-badge">{draft ? 'New preview' : saved ? 'Custom image' : 'Default image'}</span>
              </div>
              <div className="hero-manager-card-body">
                <div className="hero-manager-card-heading"><div><h3>{page.name}</h3><p>{page.detail}</p></div><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></div>
                {saved?.updatedAt && !draft && <p className="hero-manager-updated">Updated {new Date(saved.updatedAt).toLocaleString()}</p>}
                {draft && <p className="hero-manager-filename" title={draft.name}>{draft.name}</p>}
                <div className="hero-manager-actions">
                  <label className="hero-manager-choose">
                    <i className="fa-solid fa-upload" aria-hidden="true" /> Choose image
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { chooseImage(page.key, event.target.files?.[0]); event.target.value = ''; }} aria-label={`Choose ${page.name} hero image`} />
                  </label>
                  <button className="hero-manager-save" type="button" disabled={!draft || busy} onClick={() => saveImage(page.key)}>{busy && draft ? 'Saving…' : 'Save image'}</button>
                </div>
                {saved && <button className="hero-manager-reset" type="button" disabled={busy} onClick={() => resetImage(page.key)}>Reset to original image</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
