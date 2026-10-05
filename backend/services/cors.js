const cors = require('cors');
const productionOrigins = ['https://bookmyvilla.online', 'https://www.bookmyvilla.online', ...['admin', 'owner', 'dataentry', 'villamanage', 'data-entry', 'villa-manager', 'caretaker'].map(host => `https://${host}.bookmyvilla.online`)];
function allowedOrigin(origin) {
  if (!origin) return true;
  const configured = [...(process.env.CORS_ORIGINS || '').split(','), ...['FRONTEND_URL','ADMIN_FRONTEND_URL','OWNER_FRONTEND_URL','DATA_ENTRY_FRONTEND_URL','VILLA_MANAGER_FRONTEND_URL'].map(key => process.env[key] || '')].map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  if ([...productionOrigins, ...configured].includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.protocol !== 'http:' || !/^517[3-7]$/.test(url.port)) return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return process.env.NODE_ENV !== 'production';
    return process.env.NODE_ENV !== 'production' && /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  } catch { return false; }
}
module.exports = cors({ origin(origin, done) {
  if (allowedOrigin(origin)) return done(null, true);
  done(Object.assign(new Error('Origin is not permitted.'), { status: 403 }));
} });
module.exports.allowedOrigin = allowedOrigin;
