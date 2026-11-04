const express = require('express');
const SitePlugin = require('../models/SitePlugin');
const { requirePermission } = require('../middleware/adminConsoleAuth');
const { pluginSettings, validatePlugin, auditSettings } = require('../services/sitePlugins');
const { recordAudit } = require('../services/adminActions');
const { HttpError, sendError } = require('../utils/validate');
const router = express.Router();

// Parent adminConsole router verifies the real admin identity first.
router.use(requirePermission('plugins.manage'));
router.get('/omniflow', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json({ settings: pluginSettings(await SitePlugin.findOne({ key: 'omniflow' }).lean()), allowLocalUrls: process.env.NODE_ENV !== 'production' });
  } catch (error) { sendError(res, error, 'Plugin settings'); }
});

router.put('/omniflow', async (req, res) => {
  try {
    const body = req.body || {};
    const config = validatePlugin(body);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new HttpError(400, 'Reload plugin settings before saving.');
    const before = await SitePlugin.findOne({ key: 'omniflow' }).lean();
    if ((before?.revision || 0) !== body.revision) throw new HttpError(409, 'Plugin settings changed in another session. Reload before saving.');
    let saved;
    if (!before) {
      saved = await SitePlugin.create({ key: 'omniflow', ...config, revision: 1, updatedBy: req.admin._id });
    } else {
      saved = await SitePlugin.findOneAndUpdate({ key: 'omniflow', revision: body.revision },
        { $set: { ...config, updatedBy: req.admin._id }, $inc: { revision: 1 } }, { new: true, runValidators: true });
      if (!saved) throw new HttpError(409, 'Plugin settings changed in another session. Reload before saving.');
    }
    await recordAudit(req.admin, {
      action: 'plugins.omniflow_updated', entityType: 'plugin', entityId: saved._id,
      entityLabel: 'Omniflow Web Chat', before: auditSettings(before), after: auditSettings(saved),
      meta: { widgetKeyChanged: (before?.widgetKey || '') !== saved.widgetKey }, ip: req.ip,
    });
    res.set('Cache-Control', 'no-store').json({ settings: pluginSettings(saved), msg: 'Saved. New and refreshed website pages will use these settings.' });
  } catch (error) {
    if (error.errors && error.status === 400) return res.status(400).json({ msg: error.message, errors: error.errors });
    if (error.code === 11000) return res.status(409).json({ msg: 'Plugin settings changed in another session. Reload before saving.' });
    sendError(res, error, 'Plugin settings');
  }
});

module.exports = router;
