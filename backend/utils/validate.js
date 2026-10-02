const mongoose = require('mongoose');

// Shared input helpers for the owner sales modules. Every value that reaches
// a query or a document passes through one of these, so request bodies are
// never spread into models.

const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) && mongoose.Types.ObjectId.isValid(value);

const validDate = value => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
};

const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00.000Z`) + count * DAY_MS).toISOString().slice(0, 10);

const daysBetween = (start, end) => Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS);

// Nights of a stay as YYYY-MM-DD strings (checkout date excluded).
function stayNights(start, end, maxNights = 366) {
  if (!validDate(start) || !validDate(end)) return null;
  const count = daysBetween(start, end);
  if (count < 1 || count > maxNights) return null;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

// Calendar date in India, where every property on the platform operates.
function indiaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Start of an India calendar day as a UTC instant (IST = UTC+05:30, no DST).
const indiaDayStart = date => new Date(Date.parse(`${date}T00:00:00.000Z`) - 330 * 60000);

// Returns the trimmed string, '' for empty input, or null when it is too long
// or not a string-like value.
function cleanText(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? null : text;
}

// Multi-line text keeps its line breaks but is still length-capped.
function cleanMultiline(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const text = value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text.length > max ? null : text;
}

const PHONE_RE = /^[+\d\s()-]{7,20}$/;
const validPhone = value => typeof value === 'string' && PHONE_RE.test(value.trim()) && value.replace(/\D/g, '').length >= 7;

// Canonical key used to recognise the same guest across inquiries, quotes
// and bookings. Indian numbers collapse to their 10 significant digits.
function phoneKey(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 7 ? digits : '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const validEmail = value => typeof value === 'string' && value.length <= 120 && EMAIL_RE.test(value.trim());

function intInRange(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pagination(query, defaultLimit = 25) {
  const page = Math.max(1, intInRange(query.page, 1, 100000) || 1);
  const limit = intInRange(query.limit, 1, 100) || defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, err, label) {
  if (err instanceof HttpError || (err && Number.isInteger(err.status) && err.status < 500)) {
    return res.status(err.status).json({ msg: err.message });
  }
  console.error(`${label} error:`, err);
  if (!res.headersSent) res.status(500).json({ msg: 'Could not complete this action. Please try again.' });
}

module.exports = {
  DAY_MS, validId, validDate, addDays, daysBetween, stayNights, indiaDate, indiaDayStart,
  cleanText, cleanMultiline, validPhone, phoneKey, validEmail, intInRange, escapeRegex,
  pagination, HttpError, sendError
};
