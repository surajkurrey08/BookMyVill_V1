const express = require('express');
const User = require('../../models/User');
const { effectivePermissions } = require('../../services/adminRbac');
const { requireInternal } = require('../../shared/internal');
const { validId, sendError, HttpError } = require('../../utils/validate');

// user-service internal API: account identity for other services' auth.
const router = express.Router();
router.use(requireInternal);

router.get('/:id/identity', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Account not found.');
    const user = await User.findById(req.params.id).select('_id name phone email role status adminRole adminPermissions').lean();
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json({ id: String(user._id), role: user.role, status: user.status, name: user.name, phone: user.phone || '', email: user.email || '', adminRole: user.adminRole || null, permissions: user.role === 'admin' ? effectivePermissions(user) : [] });
  } catch (err) { sendError(res, err, 'Internal identity'); }
});

module.exports = router;
