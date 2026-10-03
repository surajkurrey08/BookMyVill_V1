/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeFooter from '../Home/HomeFooter';
import { stays } from '../Home/homeData';
import { properties as mockProperties } from '../../data/mockData';
import heroVilla from '../../assets/home/hero-villa.jpg';
import suitePanorama from '../../assets/home/suite-panorama.jpg';
import suiteBalcony from '../../assets/home/suite-balcony.jpg';
import lakesideResort from '../../assets/home/lakeside-resort.jpg';
import { API_BASE_URL } from '../../config';
import '../Home/Home.css';
import './BookingFlow.css';

export const fallbackPhotos = [heroVilla, suitePanorama, suiteBalcony, lakesideResort];
export const icon = name => <i className={`fa-solid fa-${name}`} aria-hidden="true" />;
export const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (iso, count) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + count); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const longDate = iso => iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose date';
export const photoUrl = value => {
  if (!value) return fallbackPhotos[0];
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return /^\/(?:uploads|api)\//i.test(value) ? `${API_BASE_URL}${value}` : value;
};
export const queryFor = ({ checkIn, checkOut, guests }) => new URLSearchParams({ checkIn, checkOut, guests: String(guests) }).toString();
export const token = () => sessionStorage.getItem('token') || localStorage.getItem('token');

export async function bookingApi(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const session = token();
    if (!session) throw Object.assign(new Error('Sign in to continue your booking.'), { status: 401 });
    headers['x-auth-token'] = session;
  }
  const response = await fetch(`${API_BASE_URL}/api/customer-booking${path}`, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.msg || 'Unable to load booking details. Please try again.'), { status: response.status });
  return data;
}

const localStay = id => [...stays, ...mockProperties].find(item => String(item.id) === String(id));
export function useProperty(id) {
  const location = useLocation();
  const [property, setProperty] = useState(() => location.state?.property || localStay(id) || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      setProperty(location.state?.property || localStay(id) || null);
      setLoading(false);
      return undefined;
    }
    fetch(`${API_BASE_URL}/api/properties/${id}`)
      .then(async response => { if (!response.ok) throw new Error('This property could not be loaded.'); return response.json(); })
      .then(async data => {
        const response = await fetch(`${API_BASE_URL}/api/feedback/property/${id}`).catch(() => null);
        const feedback = response?.ok ? await response.json().catch(() => []) : [];
        const reviews = Array.isArray(feedback) ? feedback.filter(item => String(item.propertyId || '') === String(id) && Number(item.rating) > 0) : [];
        return { ...data, rating: reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating), 0) / reviews.length : null, reviewsCount: reviews.length, reviews };
      })
      .then(data => { if (!cancelled) setProperty(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, location.state]);
  return { property, loading, error, bookable: /^[a-f0-9]{24}$/i.test(id) && property?.status === 'approved' };
}

export const propertyPhotos = property => {
  const values = (property?.photos || []).filter(Boolean).map(photoUrl);
  if (property?.image && !values.includes(photoUrl(property.image))) values.unshift(photoUrl(property.image));
  return values.length ? values : fallbackPhotos;
};

export function FlowShell({ children }) {
  return <div className="hp-root bf-root"><main className="bf-page"><div className="bf-container">{children}</div></main><HomeFooter /></div>;
}

export function Breadcrumb({ items }) {
  return <nav className="bf-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link>{items.map((item, index) => <span key={`${item.label}-${index}`} className="bf-crumb">{icon('chevron-right')}{item.to ? <Link to={item.to}>{item.label}</Link> : <strong>{item.label}</strong>}</span>)}</nav>;
}

export function DateGuestFields({ checkIn, checkOut, guests, onChange, compact = false }) {
  return <div className={`bf-date-fields ${compact ? 'is-compact' : ''}`}>
    <label>{icon('calendar-days')}<span>Check-in<input type="date" aria-label="Check-in" min={today()} value={checkIn} onChange={e => onChange({ checkIn: e.target.value, checkOut: checkOut <= e.target.value ? addDays(e.target.value, 1) : checkOut, guests })} /></span></label>
    <label>{icon('calendar-days')}<span>Check-out<input type="date" aria-label="Check-out" min={addDays(checkIn || today(), 1)} value={checkOut} onChange={e => onChange({ checkIn, checkOut: e.target.value, guests })} /></span></label>
    <label>{icon('user')}<span>Guests<select aria-label="Guests" value={guests} onChange={e => onChange({ checkIn, checkOut, guests: Number(e.target.value) })}>{Array.from({ length: 16 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} Guest{index ? 's' : ''}</option>)}</select></span></label>
  </div>;
}

export function Notice({ children, tone = 'info' }) { return children ? <div className={`bf-notice bf-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{icon(tone === 'error' ? 'circle-exclamation' : 'circle-info')}{children}</div> : null; }
export function Amenity({ label }) {
  const name = /pool/i.test(label) ? 'water-ladder' : /wi-?fi/i.test(label) ? 'wifi' : /breakfast|food|meal/i.test(label) ? 'mug-hot' : /park/i.test(label) ? 'car' : /view|mountain|valley/i.test(label) ? 'mountain' : /spa/i.test(label) ? 'spa' : 'circle-check';
  return <span className="bf-amenity">{icon(name)}{label}</span>;
}
