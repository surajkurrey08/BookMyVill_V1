import { useState } from 'react';
import { Field } from './ui';

async function compressImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10000000) throw new Error('Choose a JPEG, PNG or WebP image under 10 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const image = canvas.toDataURL('image/webp', 0.78);
  if (image.length > 600000) throw new Error('This photo is still too large. Choose a smaller image.');
  return image;
}
export default function Media({ photos = [], categories = [], onChange, onUpload, readOnly, busy, categoryOptions, setError, onProcessing = () => {}, showCategories = true }) {
  const [url, setUrl] = useState(''); const [processing, setProcessing] = useState('');
  async function upload(e) {
    const files = Array.from(e.target.files); e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > 24) { setError('A listing supports up to 24 photos. Remove a photo before adding more.'); return; }
    try {
      onProcessing(true);
      const added = [];
      for (let i = 0; i < files.length; i++) { setProcessing(`Preparing photo ${i + 1} of ${files.length}…`); added.push(await compressImage(files[i])); }
      await onUpload([...photos, ...added], [...photos.map((_, i) => categories[i] || 'Other'), ...added.map(() => 'Other')]);
    } catch (err) { setError(err.message || 'Photo upload failed. Retry with a smaller image.'); }
    finally { setProcessing(''); onProcessing(false); }
  }
  function reorder(from, to) {
    const p = [...photos], c = photos.map((_, i) => categories[i] || 'Other');
    p.splice(to, 0, p.splice(from, 1)[0]); c.splice(to, 0, c.splice(from, 1)[0]); onChange(p, c);
  }
  return <div className="media-section">{!readOnly && <div className="upload-controls"><Field label="Upload photos" hint="JPEG, PNG or WebP · up to 10 MB each. Photos are optimized before saving."><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} disabled={busy || Boolean(processing)} /></Field><p className="muted" role="status">{processing || 'Uploaded photos are saved with your listing draft.'}</p><div className="url-entry"><Field label="Or add an image URL"><input type="url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></Field><button className="button ghost" type="button" disabled={busy || !url || photos.length >= 24} onClick={() => { if (!/^https?:\/\//i.test(url)) { setError('Image URLs must start with https:// or http://.'); return; } onChange([...photos, url.trim()], [...photos.map((_, i) => categories[i] || 'Other'), 'Other']); setUrl(''); }}>Add photo</button></div></div>}
    {!photos.length && <p className="empty-inline">No photos yet. Add at least one property photo before submitting.</p>}
    <div className="photo-grid">{photos.map((src, i) => <figure key={`${i}-${src.slice(-30)}`}><div className="photo-preview"><img src={src} alt={`Listing photo ${i + 1}`} loading="lazy" onError={e => { e.currentTarget.hidden = true; e.currentTarget.nextElementSibling.hidden = false; }} /><span className="photo-failed" hidden>Image unavailable. Check the URL.</span>{i === 0 && <span className="cover-tag">Cover photo</span>}</div><figcaption>{showCategories && <label><span>Category</span><select value={categories[i] || 'Other'} disabled={readOnly || busy} onChange={e => { const c = photos.map((_, n) => categories[n] || 'Other'); c[i] = e.target.value; onChange(photos, c); }}>{categoryOptions.map(c => <option key={c}>{c}</option>)}</select></label>}{!readOnly && <div className="photo-actions"><button className="text-button" type="button" disabled={busy || i === 0} onClick={() => reorder(i, 0)}>Set cover</button><button className="text-button" type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => reorder(i, i - 1)}>Move earlier</button><button className="text-button danger" type="button" disabled={busy} onClick={() => onChange(photos.filter((_, n) => i !== n), categories.filter((_, n) => i !== n))}>Remove</button></div>}</figcaption></figure>)}</div>
  </div>;
}
