// Shared by the stay search bar and the pages that host it. Dates are local
// calendar days as YYYY-MM-DD strings.
export const DEFAULT_LOCATION = 'Lonavala';

const pad = (value) => String(value).padStart(2, '0');
export const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const fromISO = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const isoDay = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
export const todayISO = () => toISO(new Date());
export const addDays = (iso, count) => {
  const date = fromISO(iso);
  date.setDate(date.getDate() + count);
  return toISO(date);
};
export const formatDate = (iso) => iso ? fromISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Add date';
// Rounded, so a daylight-saving day of 23 or 25 hours still counts as one night.
export const nightsBetween = (from, to) => from && to ? Math.max(0, Math.round((fromISO(to) - fromISO(from)) / 86400000)) : 0;
