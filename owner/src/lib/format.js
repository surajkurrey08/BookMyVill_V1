export const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const pad = value => String(value).padStart(2, '0');
export const localDateIso = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDaysIso = (iso, days) => { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + days); return localDateIso(date); };
export const nightsBetween = (start, end) => (start && end ? Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) : 0);

// Value for <input type="datetime-local"> in the browser's timezone.
export const localDateTimeInput = (date = new Date()) => `${localDateIso(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function shortDate(iso) {
  if (!iso) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function longDate(iso) {
  if (!iso) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const dateTime = iso => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export function stayRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 'Dates not set';
  const nights = nightsBetween(checkIn, checkOut);
  return `${shortDate(checkIn)} → ${shortDate(checkOut)} · ${nights} night${nights === 1 ? '' : 's'}`;
}

// "in 3 h", "25 min ago", "yesterday"…
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(Math.abs(diff) / 60000);
  const label = minutes < 1 ? 'now' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} d`;
  if (label === 'now') return 'just now';
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

export function countdown(iso, now = Date.now()) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min left`;
  return `${Math.floor(hours / 24)} days left`;
}

export const guestCount = ({ adults = 0, children = 0, infants = 0, pets = 0 }) => [
  `${adults} adult${adults === 1 ? '' : 's'}`,
  children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
  infants ? `${infants} infant${infants === 1 ? '' : 's'}` : '',
  pets ? `${pets} pet${pets === 1 ? '' : 's'}` : ''
].filter(Boolean).join(', ');

export const digitsForWhatsApp = phone => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
};

export const whatsappLink = (phone, text) => `https://wa.me/${digitsForWhatsApp(phone)}?text=${encodeURIComponent(text)}`;
export const mailLink = (email, subject, body) => `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
