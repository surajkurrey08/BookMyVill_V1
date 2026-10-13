import { useEffect, useRef, useState } from 'react';
import { findPlaceByText, loadGoogleMaps } from '../../services/googleMaps';
import { isValidCoordinate } from '../StaySearch/searchUtils';
import { icon } from './shared';

// Keyless Google Maps embed, used when the Maps JavaScript API can't be used.
const embedUrl = query => `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;

// Google map of the property: the pin the Villa Manager confirmed, or else the
// property found by name + location via Places text search.
export default function PropertyMap({ name, location, mapLink, coordinates }) {
  const mapRef = useRef(null);
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false); // load the map only once it is near the screen
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | fallback
  const query = [name, location].filter(Boolean).join(', ');
  const pinned = isValidCoordinate(coordinates?.lat, coordinates?.lng) ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) } : null;
  const hasLocationData = Boolean(pinned || mapLink);
  const pinKey = pinned ? `${pinned.lat},${pinned.lng}` : '';

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !hasLocationData) return undefined;
    let cancelled = false;
    let watchdog;
    setStatus('loading');
    (async () => {
      try {
        const found = pinned || (await findPlaceByText(query)) || (location ? await findPlaceByText(location) : null);
        if (cancelled) return;
        if (!found) { setStatus('fallback'); return; }
        const maps = await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
        if (cancelled || !mapRef.current) return;
        const position = { lat: found.lat, lng: found.lng };
        const map = new Map(mapRef.current, {
          center: position,
          zoom: pinned ? 15 : 14,
          mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
          mapTypeControl: false,
          streetViewControl: false,
        });
        new AdvancedMarkerElement({ map, position, title: name });
        setPlace(found);
        setStatus('ready');
        // If Google never draws the map (blocked key, offline tiles), show the simple embedded map instead.
        watchdog = setTimeout(() => { if (!cancelled) setStatus('fallback'); }, 9000);
        maps.event.addListenerOnce(map, 'tilesloaded', () => clearTimeout(watchdog));
        // Never leave the map zoomed out to the whole world.
        maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() || 0) < 5) { map.setCenter(position); map.setZoom(pinned ? 15 : 14); } });
      } catch {
        if (!cancelled) setStatus('fallback');
      }
    })();
    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [visible, query, location, name, pinKey]); // eslint-disable-line react-hooks/exhaustive-deps -- pinKey stands in for pinned

  const spot = place || pinned;
  const directions = spot
    ? `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`
    : mapLink || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  const openInMaps = spot
    ? `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  if (!hasLocationData) {
    return <section ref={sectionRef} className="bf-panel bf-location-panel" id="bf-location" aria-label={`${name} location`}>
      <div className="bf-location-head"><div><h2>Location</h2><p>{icon('location-dot')} {location || name}</p></div></div>
      <div className="bf-location-empty">{icon('map-location-dot')}<strong>Exact map location not added yet</strong><span>The host has not pinned this stay on the map yet. Only the area ({location || 'area not listed'}) is known for now.</span>{location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer">View {location} area on Google Maps</a>}</div>
    </section>;
  }

  return <section ref={sectionRef} className="bf-panel bf-location-panel" id="bf-location" aria-label={`${name} location`}>
    <div className="bf-location-head">
      <div>
        <h2>Location</h2>
        <p>{icon('location-dot')} {place?.formattedAddress || location || name}</p>
      </div>
      <div className="bf-location-actions">
        <a href={directions} target="_blank" rel="noreferrer">{icon('diamond-turn-right')} Get Directions</a>
        <a href={openInMaps} target="_blank" rel="noreferrer" className="is-secondary">{icon('up-right-from-square')} Open in Google Maps</a>
      </div>
    </div>
    <div className="bf-location-map">
      {status === 'fallback'
        ? <iframe title={`${name} on Google Maps`} src={embedUrl(pinKey || query)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        : <div ref={mapRef} />}
      {visible && status === 'loading' && <div className="bf-location-loading"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading map…</div>}
    </div>
  </section>;
}
