const express = require('express');
const { mediaDirectory } = require('../services/propertyMedia');

// Serves uploaded property photos/videos (/api/properties/media/<uuid>.<ext>).
// Owned by the media-service; the legacy all-in-one server mounts it too.
const router = express.Router();
router.use((req, res, next) => {
  if (!/^\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm|mov)$/.test(req.path)) return res.sendStatus(404);
  res.set('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(mediaDirectory, { index: false, dotfiles: 'deny', maxAge: '1y', immutable: true, fallthrough: false }));

module.exports = router;
