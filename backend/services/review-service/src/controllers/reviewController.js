const service = require('../services/reviewService');
const validate = require('../validators/reviewValidators');
const handle = require('../../../../shared/http').asyncHandler('Guest feedback');

module.exports = {
  forOwner: handle(async (req, res) => res.json(await service.forOwner(req.user, req.id))),
  forAdmin: handle(async (req, res) => res.json(await service.all())),
  forProperty: handle(async (req, res) => res.json(await service.publishedForProperty(req.params.propertyId, req.id))),
  create: handle(async (req, res) => res.status(201).json(await service.create(req.user, validate.newReview(req.body), req.id))),
  toggleSelected: handle(async (req, res) => res.json(await service.toggleSelected(req.user, validate.feedbackId(req.params.id), req.id))),
  remove: handle(async (req, res) => { await service.remove(req.user, validate.feedbackId(req.params.id), req.id); res.json({ msg: 'Feedback removed.' }); })
};
