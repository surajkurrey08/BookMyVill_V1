const jwt = require('jsonwebtoken');
const { internalRequest } = require('./internal');
const { getJson, setJson } = require('./cache');

// Authentication for services that do not own user data. The JWT is verified
// locally; the account's current role/status/admin permissions come from the
// user-service (cached for IDENTITY_CACHE_SECONDS) so a suspended account is
// locked out everywhere. Response messages match the original middlewares.

const cacheSeconds = () => (process.env.IDENTITY_CACHE_SECONDS === undefined || process.env.IDENTITY_CACHE_SECONDS === '' ? 30 : Number(process.env.IDENTITY_CACHE_SECONDS));
const BLOCKED = ['pending', 'rejected', 'suspended'];

function tokenFrom(req) {
  const raw = req.header('x-auth-token') || req.header('authorization') || '';
  return raw.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
}

async function identity(id) {
  const key = `identity:${id}`;
  const ttl = cacheSeconds();
  const cached = ttl > 0 ? await getJson(key) : null;
  if (cached) return cached;
  const found = await internalRequest('user-service', `/internal/users/${id}/identity`);
  if (ttl > 0) await setJson(key, found, ttl);
  return found;
}

async function verify(req) {
  const token = tokenFrom(req);
  if (!token) return { status: 401 };
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026'); } catch { return { status: 401, expired: true }; }
  const id = claims.id || claims._id || claims.user?.id || claims.user?._id;
  if (!/^[a-f\d]{24}$/i.test(String(id || ''))) return { status: 401, expired: true };
  try { return { user: await identity(String(id)) }; }
  catch (error) { return error.status === 404 ? { status: 403 } : { status: 503 }; }
}

// Any signed-in, non-blocked account. Sets req.user = { id, role, status, ... }.
async function accountAuth(req, res, next) {
  const result = await verify(req);
  if (result.status === 401) return res.status(401).json({ msg: result.expired ? 'Session expired or invalid. Please sign in again.' : 'Please sign in.' });
  if (result.status === 503) return res.status(503).json({ msg: 'Account service is unavailable.' });
  if (result.status === 403 || BLOCKED.includes(result.user.status)) return res.status(403).json({ msg: result.user?.status === 'suspended' ? 'This account has been suspended. Contact BookMyVilla support.' : 'Account access denied.' });
  req.user = result.user;
  next();
}

const requireRole = (role, message) => (req, res, next) => accountAuth(req, res, () => (req.user.role === role ? next() : res.status(403).json({ msg: message })));
const ownerAuth = requireRole('owner', 'Property owner access required.');
const customerAuth = requireRole('user', 'Customer account required.');

// Admin console: verified admin JWT + effective permissions from user-service.
async function adminConsoleAuth(req, res, next) {
  const result = await verify(req);
  if (result.status === 401) return res.status(401).json({ msg: result.expired ? 'Admin session expired. Please sign in again.' : 'Admin sign-in required.' });
  if (result.status === 503) return res.status(503).json({ msg: 'Admin console is temporarily unavailable.' });
  if (result.status === 403 || result.user.role !== 'admin') return res.status(403).json({ msg: 'Admin access only.' });
  if (BLOCKED.includes(result.user.status)) return res.status(403).json({ msg: 'This admin account is suspended.' });
  req.user = result.user;
  req.adminPermissions = result.user.permissions || [];
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.adminPermissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();
    res.status(403).json({ msg: `Your admin role does not have the "${permission}" permission.` });
  };
}

module.exports = { accountAuth, ownerAuth, customerAuth, adminConsoleAuth, requirePermission };
