const express = require('express');
const mongoose = require('mongoose');
const accountAuth = require('../middleware/accountAuth');
const Property = require('../models/Property');
const Room = require('../models/Room');
const User = require('../models/User');
const { HttpError, sendError, pagination, escapeRegex } = require('../utils/validate');
const entry = require('../services/dataEntry');
const router = express.Router();
router.use(accountAuth, (req, res, next) => {
  if (req.user.role !== 'data_entry') return res.status(403).json({ msg: 'Access denied. An active Data Entry staff account is required.' });
  if (!['active', 'approved'].includes(req.user.status)) return res.status(403).json({ msg: 'This Data Entry account is not active. Contact Admin.' });
  next();
});
const fail = (res, err) => sendError(res, err, 'Data Entry');

router.get('/session', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id name email role status');
    res.json({ user, permissions: ['listing.read', 'listing.edit', 'listing.submit'], amenities: entry.AMENITIES, propertyTypes: entry.TYPES, photoCategories: entry.CATEGORIES, dataStatuses: entry.STATES });
  } catch (err) { fail(res, err); }
});

router.get('/', async (req, res) => {
  try {
    const scope = { assignedDataEntryUser: new mongoose.Types.ObjectId(req.user.id) };
    const filter = { ...scope };
    const and = [];
    if (req.query.dataStatus) {
      if (!entry.STATES.includes(req.query.dataStatus) && req.query.dataStatus !== 'pending') throw new HttpError(400, 'Invalid data status.');
      and.push(req.query.dataStatus === 'pending' ? { $or: [{ dataEntryStatus: { $in: ['ASSIGNED', 'DRAFT', 'IN_PROGRESS'] } }, { dataEntryStatus: { $exists: false } }] } : req.query.dataStatus === 'ASSIGNED' ? { $or: [{ dataEntryStatus: 'ASSIGNED' }, { dataEntryStatus: { $exists: false } }] } : { dataEntryStatus: req.query.dataStatus });
    }
    if (req.query.queue === 'true') and.push({ dataEntryStatus: { $nin: ['READY_FOR_REVIEW', 'COMPLETED'] } });
    if (req.query.reviewStatus) {
      if (!['pending', 'under_review', 'approved', 'rejected', 'suspended'].includes(req.query.reviewStatus)) throw new HttpError(400, 'Invalid review status.');
      filter.status = req.query.reviewStatus;
    }
    if (req.query.type) {
      if (!entry.TYPES.includes(req.query.type)) throw new HttpError(400, 'Invalid property type.');
      and.push({ $or: [{ 'listingDraft.type': req.query.type }, { listingDraft: null, type: req.query.type }] });
    }
    for (const key of ['q', 'location']) if (req.query[key]) {
      if (typeof req.query[key] !== 'string' || req.query[key].length > 120) throw new HttpError(400, 'Search is too long.');
      const regex = new RegExp(escapeRegex(req.query[key].trim()), 'i');
      if (key === 'location') and.push({ $or: [{ 'listingDraft.location': regex }, { location: regex }] });
      else {
        const ownerIds = await User.find({ role: 'owner', name: regex }).select('_id').limit(500).lean();
        and.push({ $or: [{ name: regex }, { 'listingDraft.name': regex }, { owner: { $in: ownerIds.map(o => o._id) } }] });
      }
    }
    if (req.query.completion) {
      if (!['complete', 'incomplete'].includes(req.query.completion)) throw new HttpError(400, 'Invalid completion filter.');
      and.push(req.query.completion === 'complete' ? { dataEntryCompletion: 100 } : { $or: [{ dataEntryCompletion: { $lt: 100 } }, { dataEntryCompletion: null }] });
    }
    if (and.length) filter.$and = and;
    const { page, limit, skip } = pagination(req.query, 15);
    const [properties, total, rows] = await Promise.all([
      Property.aggregate([{ $match: filter }, { $sort: { dataEntryUpdatedAt: -1, createdAt: -1, _id: 1 } }, { $skip: skip }, { $limit: Math.min(limit, 30) }, { $project: {
        name: { $ifNull: ['$listingDraft.name', '$name'] }, type: { $ifNull: ['$listingDraft.type', '$type'] }, location: { $ifNull: ['$listingDraft.location', '$location'] },
        mapLink: { $ifNull: ['$listingDraft.mapLink', '$mapLink'] }, owner: 1, status: 1, createdAt: 1, price: 1, dataEntryStatus: 1, dataEntryCompletion: 1, dataEntryReviewReason: 1, dataEntryUpdatedAt: 1,
        details: { $ifNull: ['$listingDraft.details', '$listingData.details'] }, amenityCount: { $size: { $ifNull: ['$listingDraft.amenities', { $ifNull: ['$amenities', []] }] } }, photoCount: { $size: { $ifNull: ['$listingDraft.photos', { $ifNull: ['$photos', []] }] } }
      } }]),
      Property.countDocuments(filter),
      Property.aggregate([{ $match: scope }, { $group: { _id: { $ifNull: ['$dataEntryStatus', 'ASSIGNED'] }, count: { $sum: 1 } } }])
    ]);
    const owners = await User.find({ _id: { $in: properties.map(p => p.owner) } }).select('_id name').lean();
    const rooms = await Room.find({ property: { $in: properties.filter(p => p.dataEntryCompletion == null).map(p => p._id) } }).select('property name number type capacity').lean();
    const items = properties.map(p => ({ _id: p._id, name: p.name, type: p.type, location: p.location, owner: owners.find(o => String(o._id) === String(p.owner)) || null, dataStatus: entry.statusOf(p), reviewStatus: p.status,
      completion: p.dataEntryCompletion ?? entry.completion({ ...p, amenities: p.amenityCount ? ['present'] : [], photos: p.photoCount ? ['present'] : [], rooms: rooms.filter(r => String(r.property) === String(p._id)) }, p.price).percent,
      updatedAt: p.dataEntryUpdatedAt || p.createdAt, reviewReason: p.dataEntryReviewReason || '', canEdit: !['READY_FOR_REVIEW', 'COMPLETED'].includes(entry.statusOf(p)) }));
    const counts = Object.fromEntries(rows.map(r => [r._id, r.count]));
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / Math.min(limit, 30))), counts, assigned: rows.reduce((n, r) => n + r.count, 0) });
  } catch (err) { fail(res, err); }
});
router.get('/:id', async (req, res) => {
  try { res.json(await entry.view(await entry.assigned(req.user, req.params.id))); } catch (err) { fail(res, err); }
});
router.put('/:id', async (req, res) => {
  try {
    if (Object.keys(req.body).some(k => !['draft', 'revision'].includes(k)) || !Number.isInteger(req.body.revision)) throw new HttpError(400, 'Send listing content and its current revision.');
    res.json(await entry.saveDraft(req.user, req.params.id, req.body.draft, req.body.revision));
  } catch (err) { fail(res, err); }
});
router.post('/:id/submit', async (req, res) => {
  try {
    if (Object.keys(req.body).some(k => k !== 'revision')) throw new HttpError(403, 'Only listing review submission is allowed.');
    const p = await entry.assigned(req.user, req.params.id);
    if (['READY_FOR_REVIEW', 'COMPLETED'].includes(entry.statusOf(p))) throw new HttpError(409, 'This listing has already been submitted.');
    if (req.body.revision !== (p.dataEntryRevision || 0)) throw new HttpError(409, 'Save the latest draft before submitting.');
    const rooms = await Room.find({ property: p._id }).lean();
    const draft = entry.currentDraft(p, rooms);
    const checks = entry.completion(draft, p.price);
    if (!checks.complete) return res.status(422).json({ msg: 'Complete the required sections before submitting.', checks: checks.checks, percent: checks.percent });
    // Hide the listing before content is promoted. Staff can never publish it.
    // A revision/assignment guard prevents stale sessions submitting someone
    // else's reassigned property. Existing Admin approval remains authoritative.
    const set = { status: 'pending', dataEntryStatus: 'IN_PROGRESS', dataEntryCompletion: 100, dataEntryUpdatedAt: new Date(), listingData: { details: draft.details, photoCategories: draft.photoCategories || [] } };
    for (const key of ['name', 'type', 'location', 'mapLink', 'amenities', 'facilities', 'photos', 'videos']) set[key] = draft[key];
    set['stayInfo.checkInTime'] = draft.details.checkInTime;
    set['stayInfo.checkOutTime'] = draft.details.checkOutTime;
    set['stayInfo.arrivalNotes'] = draft.details.arrivalInstructions || '';
    const saved = await Property.findOneAndUpdate({ _id: p._id, assignedDataEntryUser: req.user.id, ...entry.revisionFilter(p) }, { $set: set, $inc: { dataEntryRevision: 1 } }, { new: true, runValidators: true }).select(entry.SELECT).populate('owner', 'name');
    if (!saved) throw new HttpError(409, 'Assignment or draft changed. Reload before submitting.');
    try {
      for (const r of draft.rooms) {
        const content = { ...r }; delete content._id;
        if (r._id) await Room.updateOne({ _id: r._id, property: p._id }, { $set: content }, { runValidators: true });
        else await Room.findOneAndUpdate({ property: p._id, number: r.number }, { $set: content, $setOnInsert: { property: p._id, baseRate: p.price, active: true } }, { upsert: true, runValidators: true });
      }
      const persisted = await Room.find({ property: p._id }).lean();
      saved.listingDraft = { ...draft, rooms: persisted.map(entry.roomContent) };
      const ready = await Property.updateOne({ _id: p._id, assignedDataEntryUser: req.user.id, status: 'pending', dataEntryStatus: 'IN_PROGRESS', dataEntryRevision: saved.dataEntryRevision }, { $set: { listingDraft: saved.listingDraft, dataEntryStatus: 'READY_FOR_REVIEW' } });
      if (!ready.modifiedCount) throw new Error('Assignment or review changed during submission.');
      saved.dataEntryStatus = 'READY_FOR_REVIEW';
    } catch (err) {
      const persisted = await Room.find({ property: p._id }).select('_id number').lean();
      const retryDraft = { ...draft, rooms: draft.rooms.map(r => ({ ...r, ...(persisted.find(row => row.number === r.number) && { _id: String(persisted.find(row => row.number === r.number)._id) }) })) };
      await Property.updateOne({ _id: p._id, dataEntryRevision: saved.dataEntryRevision, dataEntryStatus: 'IN_PROGRESS' }, { $set: { listingDraft: retryDraft } });
      throw new HttpError(409, 'Room information could not be submitted. The listing remains unpublished. Reload and check unique room numbers before retrying.');
    }
    res.json(await entry.view(saved));
  } catch (err) { fail(res, err); }
});
module.exports = router;
