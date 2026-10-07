const service = require('../services/catalogService');
const { asyncHandler: handle } = require('../../../../shared/http');

const owner = handle('Owner catalog');
const internal = handle('Internal coupons');

module.exports = {
  // Owner panel: /api/owner-catalog (and /api/v1/coupons)
  listAddOns: owner(async (req, res) => res.json(await service.listAddOns(req.user, req.query, req.id))),
  createAddOn: owner(async (req, res) => res.status(201).json(await service.createAddOn(req.user, req.body || {}, req.id))),
  updateAddOn: owner(async (req, res) => res.json(await service.updateAddOn(req.user, req.params.id, req.body || {}, req.id))),
  deleteAddOn: owner(async (req, res) => { await service.deleteAddOn(req.user, req.params.id, req.id); res.json({ msg: 'Add-on deleted.' }); }),
  listPromotions: owner(async (req, res) => res.json(await service.listPromotions(req.user, req.id))),
  createPromotion: owner(async (req, res) => res.status(201).json(await service.createPromotion(req.user, req.body || {}, req.id))),
  updatePromotion: owner(async (req, res) => res.json(await service.updatePromotion(req.user, req.params.id, req.body || {}, req.id))),

  // Internal: booking-service (checkout) and pricing-service (quotations)
  offeredAddOns: internal(async (req, res) => res.json(await service.offeredAddOns(req.query))),
  addOnsByIds: internal(async (req, res) => res.json(await service.addOnsByIds(req.query))),
  evaluatePromotion: internal(async (req, res) => res.json(await service.evaluatePromotion(req.body || {}))),
  redeem: internal(async (req, res) => res.json(await service.redeem(req.params.id, req.body || {}))),
  release: internal(async (req, res) => res.json(await service.release(req.params.id, req.body || {})))
};
