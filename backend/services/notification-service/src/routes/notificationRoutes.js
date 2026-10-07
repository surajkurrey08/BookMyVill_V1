const express = require('express');
const service = require('../services/notificationService');
const { adminConsoleAuth, requirePermission } = require('../../../../shared/remoteAuth');
const { pagination, sendError } = require('../../../../utils/validate');

// Admin console: recent notifications (/api/notifications, /api/v1/notifications).
const router = express.Router();
router.use(adminConsoleAuth, requirePermission('bookings.view'));

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = pagination(req.query, 30);
    const status = ['pending_provider', 'sent', 'failed'].includes(req.query.status) ? req.query.status : undefined;
    res.json({ ...await service.list({ status, skip, limit }), page, limit });
  } catch (err) { sendError(res, err, 'Notifications'); }
});

module.exports = router;
