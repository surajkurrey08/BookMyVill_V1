import { useEffect, useState } from 'react';
import { ownerService } from './services/api';
import { Icon } from './ui';

// The standard amenity list (same as Data Entry), loaded once per session.
let standard = null;
const loadStandard = () => (standard ||= ownerService.amenities().catch(err => { standard = null; throw err; }));

// One-click amenities: click a chip to add it, click a selected chip to remove
// it. Anything not in the standard list can be added under "Other amenity".
export default function AmenityPicker({ value = [], onChange }) {
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const [other, setOther] = useState('');
  useEffect(() => { loadStandard().then(setOptions).catch(err => setError(err.message)); }, []);

  const selected = new Set(value);
  const chips = [...options, ...value.filter(a => !options.includes(a))];
  const toggle = name => onChange(selected.has(name) ? value.filter(a => a !== name) : [...value, name]);
  function addOther() {
    const name = other.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const existing = chips.find(a => a.toLowerCase() === name.toLowerCase());
    if (existing) { if (!selected.has(existing)) toggle(existing); }
    else if (value.length < 40) onChange([...value, name.slice(0, 60)]);
    setOther('');
  }

  return <div className="amenity-picker">
    {error && <p className="error" role="alert">Could not load the amenity list: {error}</p>}
    <div className="amenity-chips" role="group" aria-label="Amenities">
      {chips.map(name => <button key={name} type="button" className="amenity-chip" aria-pressed={selected.has(name)} onClick={() => toggle(name)}>
        {selected.has(name) && <Icon name="check"/>}{name}
      </button>)}
    </div>
    <div className="amenity-other">
      <input value={other} maxLength="60" placeholder="Other amenity, e.g. Jacuzzi" aria-label="Other amenity" onChange={e => setOther(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }}/>
      <button type="button" onClick={addOther} disabled={!other.trim()}>Add</button>
    </div>
    <span className="amenity-count">{value.length ? `${value.length} selected — click a selected amenity to remove it.` : 'Click the amenities this villa offers.'}</span>
  </div>;
}
