const express = require('express');
const mongoose = require('mongoose');
const Quotation = require('../../models/Quotation');
const { requireInternal } = require('../../shared/internal');
const { validId, sendError, HttpError } = require('../../utils/validate');

// pricing-service internal API: quotation facts other services need
// (coupon-service asks before deleting an add-on and for open promo quotes).
const router = express.Router();
router.use(requireInternal);
const fail = (res, err) => sendError(res, err, 'Internal pricing');

router.get('/addons/:id/in-use', async (req, res) => {
  try {
    if (!validId(req.params.id) || !validId(req.query.owner)) throw new HttpError(400, 'Invalid request.');
    res.json({ inUse: Boolean(await Quotation.exists({ owner: req.query.owner, 'addOns.addOn': req.params.id })) });
  } catch (err) { fail(res, err); }
});

// Open (sent/viewed/accepted) quotations per promotion for an owner.
router.get('/promotions/open-quotes', async (req, res) => {
  try {
    if (!validId(req.query.owner)) throw new HttpError(400, 'Invalid owner.');
    const rows = await Quotation.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(String(req.query.owner)), status: { $in: ['sent', 'viewed', 'accepted'] }, 'promotion.promotion': { $ne: null } } },
      { $group: { _id: '$promotion.promotion', count: { $sum: 1 } } }
    ]);
    res.json(rows.map(row => ({ promotion: String(row._id), count: row.count })));
  } catch (err) { fail(res, err); }
});

module.exports = router;
