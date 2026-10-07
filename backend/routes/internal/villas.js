const express = require('express');
const Property = require('../../models/Property');
const { publicProperty, isPublicListing, PUBLIC_LISTING } = require('../../services/publicViews');
const { canAccessProperty, requireOwnerPropertySelection, MANAGEMENT_SELECT } = require('../../services/propertyAccess');
const { requireInternal } = require('../../shared/internal');
const { validId, sendError, HttpError } = require('../../utils/validate');

// villa-service internal API: the source of truth other services ask instead
// of reading the properties collection.
const router = express.Router();
router.use(requireInternal);
const fail = (res, err) => sendError(res, err, 'Internal villas');

// Public listings (search index source). ?ids=a,b limits the set.
router.get('/public', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(validId);
    const filter = { ...PUBLIC_LISTING, ...(ids.length && { _id: { $in: ids } }) };
    const rows = await Property.find(filter).lean();
    res.json(rows.map(p => ({ ...publicProperty(p), createdAt: p.createdAt })));
  } catch (err) { fail(res, err); }
});

// IDs of an owner's properties (?access=operate limits to ones the owner runs).
router.get('/owned', async (req, res) => {
  try {
    if (!validId(req.query.owner)) throw new HttpError(400, 'Invalid owner.');
    const rows = await Property.find({ owner: req.query.owner }).select(`_id name managementMode owner ${MANAGEMENT_SELECT}`).lean();
    const user = { id: String(req.query.owner), role: 'owner' };
    res.json(rows.filter(p => req.query.access !== 'operate' || canAccessProperty(user, p, 'operate')).map(p => ({ _id: String(p._id), name: p.name })));
  } catch (err) { fail(res, err); }
});

// Names for display (?ids=a,b), any status.
router.get('/names', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(validId).slice(0, 500);
    const rows = ids.length ? await Property.find({ _id: { $in: ids } }).select('_id name').lean() : [];
    res.json(rows.map(p => ({ _id: String(p._id), name: p.name })));
  } catch (err) { fail(res, err); }
});

// Validates an owner's property selection (400/404/403 like the owner panel); returns the ids.
router.post('/owner-selection', async (req, res) => {
  try {
    if (!validId(req.body?.owner)) throw new HttpError(400, 'Invalid owner.');
    res.json({ ids: (await requireOwnerPropertySelection(req.body.owner, Array.isArray(req.body.ids) ? req.body.ids : [])).map(String) });
  } catch (err) { fail(res, err); }
});

router.get('/:id/summary', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Property not found.');
    const p = await Property.findById(req.params.id).select('_id name owner location status websiteVisible managementMode bookingMode').lean();
    if (!p) throw new HttpError(404, 'Property not found.');
    res.json({ _id: String(p._id), name: p.name, owner: p.owner ? String(p.owner) : null, location: p.location, status: p.status, managementMode: p.managementMode || 'SELF_MANAGED', bookingMode: p.bookingMode || 'ROOMS', public: isPublicListing(p) });
  } catch (err) { fail(res, err); }
});

// Can this account act on the property? ?userId=&role=&access=operate|report|listing
router.get('/:id/access', async (req, res) => {
  try {
    if (!validId(req.params.id) || !validId(req.query.userId)) throw new HttpError(400, 'Invalid request.');
    const p = await Property.findById(req.params.id).select(`_id name owner managementMode ${MANAGEMENT_SELECT}`).lean();
    if (!p) return res.json({ allowed: false, exists: false });
    const user = { id: String(req.query.userId), role: String(req.query.role || '') };
    res.json({ allowed: canAccessProperty(user, p, req.query.access || 'operate'), exists: true, owned: user.role === 'owner' && String(p.owner) === user.id, name: p.name });
  } catch (err) { fail(res, err); }
});

module.exports = router;
