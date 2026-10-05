const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = async function accountAuth(req, res, next) {
  const raw = req.header('x-auth-token') || req.header('authorization') || '';
  const token = raw.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  if (!token) return res.status(401).json({ msg: 'Please sign in.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ msg: 'Database is unavailable.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026');
    const id = decoded.id || decoded._id || decoded.user?.id || decoded.user?._id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(401).json({ msg: 'Invalid session.' });
    const user = await User.findById(id).select('_id role status adminRole adminPermissions');
    if (!user || ['pending', 'rejected', 'suspended'].includes(user.status)) {
      return res.status(403).json({ msg: user?.status === 'suspended' ? 'This account has been suspended. Contact BookMyVilla support.' : 'Account access denied.' });
    }
    req.user = { id: user._id.toString(), role: user.role, status: user.status, adminRole: user.adminRole, adminPermissions: user.adminPermissions };
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Session expired or invalid. Please sign in again.' });
  }
};
