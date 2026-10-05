const Property = require('../models/Property');
const { requirePropertyAccess, assertPropertyAccess } = require('../services/propertyAccess');
const { validId, HttpError, sendError } = require('../utils/validate');

// Legacy owner-wide records have no reliable property ID. Never let a selected
// self-managed property authorize an unrelated, potentially managed record.
module.exports = function legacyOwnerOperation(recordModel) {
  return async (req, res, next) => {
    if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Property owner access required.' });
    try {
      let name;
      if (recordModel && req.params.id) {
        if (!validId(req.params.id)) throw new HttpError(400, 'Invalid record ID.');
        const record = await recordModel.findById(req.params.id);
        if (!record) throw new HttpError(404, 'Record not found in your account.');
        if (record.propertyId) { await requirePropertyAccess(req.user, record.propertyId); return next(); }
        if (String(record.ownerId) !== String(req.user.id)) throw new HttpError(404, 'Record not found in your account.');
        name = record.propertyName;
      } else if (recordModel) {
        if (req.body.propertyId) {
          const property = await requirePropertyAccess(req.user, req.body.propertyId);
          req.body.propertyName = property.name;
          return next();
        }
        name = req.body.propertyName;
      }
      if (name) {
        const matches = await Property.find({ owner: req.user.id, name });
        if (matches.length === 1) { assertPropertyAccess(req.user, matches[0]); return next(); }
      }
      if (await Property.exists({ owner: req.user.id, managementMode: 'BOOKMYVILLA_MANAGED' })) {
        throw new HttpError(403, 'This owner-wide record is read-only because it is not linked to a self-managed property. Use property-specific Guest Operations for daily tasks.');
      }
      next();
    } catch (err) { sendError(res, err, 'Owner operational access'); }
  };
};
