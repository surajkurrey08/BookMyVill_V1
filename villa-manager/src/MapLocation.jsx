import { useEffect, useRef, useState } from 'react';
import { ownerService } from './services/api';
import { Field } from './ui';

const embed = ({ lat, lng }) => `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
const coords = ({ lat, lng }) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

// Paste anything copied from Google Maps — a share link, the pin's coordinates
// or an address — see the pin on a map, then confirm it. The parent gets
// { coordinates, mapLink, address, pending }: coordinates only once confirmed,
// pending while something is pasted but not yet confirmed.
export default function MapLocationField({ value, onChange, autoFind = false }) {
  const [input, setInput] = useState(value?.mapLink || '');
  const [preview, setPreview] = useState(value?.coordinates ? { coordinates: value.coordinates, mapLink: value.mapLink } : null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const confirmed = Boolean(value?.coordinates);

  async function find(text) {
    const query = text.trim();
    if (!query) return;
    const request = ++latest.current;
    setBusy(true); setError(''); setPreview(null);
    onChange({ coordinates: null, mapLink: '', pending: true });
    try {
      const result = await ownerService.mapLocation(query);
      if (request === latest.current) setPreview(result);
    } catch (err) {
      if (request === latest.current) setError(err.message);
    } finally {
      if (request === latest.current) setBusy(false);
    }
  }
  function edit(text) {
    latest.current++; setBusy(false);
    setInput(text); setPreview(null); setError('');
    onChange({ coordinates: null, mapLink: '', pending: Boolean(text.trim()) });
  }
  // A villa saved with only a Maps link gets its pin looked up straight away.
  useEffect(() => {
    if (autoFind && !value?.coordinates && value?.mapLink) find(value.mapLink);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const confirm = () => onChange({ coordinates: preview.coordinates, mapLink: preview.mapLink, address: preview.address || '', pending: false });
  const clear = () => edit('');

  return <div className="map-location">
    <Field label="Villa location on Google Maps">
      <div className="photo-link-row">
        <input value={input} maxLength="2048" placeholder="Paste a Google Maps link, coordinates or address"
          onChange={e => edit(e.target.value)}
          onPaste={e => { const text = e.clipboardData.getData('text').trim(); if (text) { e.preventDefault(); edit(text); find(text); } }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(input); } }}/>
        <button type="button" onClick={() => find(input)} disabled={busy || !input.trim()}>{busy ? 'Finding…' : 'Find'}</button>
      </div>
    </Field>
    {!preview && !error && <small className="hint">In Google Maps, open the villa and tap <b>Share → Copy link</b>, or right-click the pin and click the coordinates to copy them. Then paste here.</small>}
    {error && <p className="error" role="alert">{error}</p>}
    {preview && <div className={'map-preview' + (confirmed ? ' is-confirmed' : '')}>
      <iframe title="Villa location preview" src={embed(preview.coordinates)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
      <div className="map-preview-bar">
        <div><strong>{preview.name || preview.address || 'Pinned location'}</strong><small>{preview.name && preview.address ? `${preview.address} · ` : ''}{coords(preview.coordinates)}</small></div>
        <div className="map-preview-actions">
          {confirmed ? <span className="badge tone-web-live">✓ Location confirmed</span> : <button type="button" className="primary" onClick={confirm}>Confirm location</button>}
          <button type="button" onClick={clear}>{confirmed ? 'Change' : 'Clear'}</button>
        </div>
      </div>
      {!confirmed && <small className="hint">Check that the pin is on the villa, then confirm. Guests will see this pin and get directions to it.</small>}
    </div>}
  </div>;
}
