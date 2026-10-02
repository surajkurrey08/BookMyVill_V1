const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { effectivePermissions } = require('../services/adminRbac');

// Strict authentication for the Super Admin console. Unlike the legacy `auth`
// middleware there is no development fallback: a real, verified admin JWT is
// required, and the account's admin role/permissions are loaded for guarding.
async function adminConsoleAuth(req, res, next) {
  const raw = req.header('x-auth-token') || req.header('authorization') || '';
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ msg: 'Admin sign-in required.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ msg: 'Admin console is temporarily unavailable.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026');
    const id = decoded.id || decoded.user?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(401).json({ msg: 'Invalid admin session.' });
    const admin = await User.findById(id).select('_id name email role adminRole adminPermissions status');
    if (!admin || admin.role !== 'admin') return res.status(403).json({ msg: 'Admin access only.' });
    if (admin.status === 'suspended') return res.status(403).json({ msg: 'This admin account is suspended.' });
    req.admin = admin;
    req.adminPermissions = effectivePermissions(admin);
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Admin session expired. Please sign in again.' });
  }
}

// Route guard factory. Backend is the source of truth for authorization.
function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.adminPermissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();
    res.status(403).json({ msg: `Your admin role does not have the "${permission}" permission.` });
  };
}

module.exports = { adminConsoleAuth, requirePermission };
