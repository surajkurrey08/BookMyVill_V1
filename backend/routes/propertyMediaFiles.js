const express = require('express');
const { mediaDirectory } = require('../services/propertyMedia');

// Serves uploaded property photos/videos (/api/properties/media/<uuid>.<ext>).
// Owned by the media-service; the legacy all-in-one server mounts it too.
const router = express.Router();
router.use((req, res, next) => {
  if (!/^\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm|mov)$/.test(req.path)) return res.sendStatus(404);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(mediaDirectory, { index: false, dotfiles: 'deny', maxAge: '1y', immutable: true }));
// A file that is no longer on disk is a plain 404, not a server error.
router.use((req, res) => res.sendStatus(404));


module.exports = router;
