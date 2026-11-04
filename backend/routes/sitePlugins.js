const express = require('express');
const SitePlugin = require('../models/SitePlugin');
const { pluginSettings } = require('../services/sitePlugins');
const router = express.Router();

router.get('/omniflow', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const settings = pluginSettings(await SitePlugin.findOne({ key: 'omniflow' }).lean());
    // Public projection only. Never expose document IDs, admin identities or tokens.
    res.json(settings.enabled ? settings : { enabled: false, revision: settings.revision });
  } catch {
    res.status(503).json({ enabled: false, msg: 'Website chat settings are temporarily unavailable.' });
  }
});

module.exports = router;
