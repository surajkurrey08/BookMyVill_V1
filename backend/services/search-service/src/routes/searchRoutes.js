const express = require('express');
const { search } = require('../services/searchService');
const { sendError } = require('../../../../utils/validate');

// /api/search/villas and /api/v1/search/villas (public).
const router = express.Router();
router.get('/villas', async (req, res) => {
  try { res.json(await search(req.query)); } catch (err) { sendError(res, err, 'Search'); }
});

module.exports = router;
