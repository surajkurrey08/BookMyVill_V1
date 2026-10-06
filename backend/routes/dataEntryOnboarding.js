const express = require('express');
const crypto = require('crypto');
const Property = require('../models/Property');
const User = require('../models/User');
const GuideArea = require('../models/GuideArea');
const LocalGuide = require('../models/LocalGuide');
const { mediaOrigin } = require('../services/propertyMedia');
const { field, phone, number, ownerInput, villaInput, createVilla } = require('../services/villaOnboarding');
const { areaKey } = require('../services/guides');
const { HttpError, sendError, validId, cleanText, escapeRegex } = require('../utils/validate');

// Data Entry onboarding: add owners (self-managed or BookMyVilla-managed) with
// their villas and photos, and keep the local-guide directory per location.
// Mounted under /api/properties/data-entry/onboarding (Data Entry auth).
// Data Entry only adds data: villas go to Admin for approval; managed villas
// appear in the chosen Villa Manager's panel; self-managed owners get an
// Owner panel setup link from Admin.
const router = express.Router();
const route = fn => async (req, res) => { try { await fn(req, res); } catch (err) { sendError(res, err, 'Data Entry onboarding'); } };
const MODES = ['SELF_MANAGED', 'BOOKMYVILLA_MANAGED'];

async function activeVillaManager(id) {
  if (!id) throw new HttpError(400, 'Choose the Villa Manager who will run this villa.');
  if (!validId(id) || !await User.exists({ _id: id, role: 'villa_manager', status: { $in: ['active', 'approved'] } })) throw new HttpError(400, 'Choose an active Villa Manager.');
  return id;
}

const websiteState = v => v.status === 'approved' ? (v.websiteVisible === false ? 'hidden' : 'live') : v.status === 'pending' ? 'pending_approval' : v.status;

router.get('/villa-managers', route(async (req, res) => {
  res.json(await User.find({ role: 'villa_manager', status: { $in: ['active', 'approved'] } }).select('_id name email phone').sort({ name: 1 }).lean());
}));

// Owners whose villas this Data Entry user added.
router.get('/owners', route(async (req, res) => {
  const villas = await Property.find({ assignedDataEntryUser: req.user.id }).select('_id name owner location status websiteVisible managementMode photos createdAt +assignedVillaManager').populate('assignedVillaManager', 'name').sort({ createdAt: -1 }).lean();
  const filter = { _id: { $in: [...new Set(villas.map(v => String(v.owner)))] }, role: 'owner' };
  const q = field(req.query.q, 80, 'Search');
  if (q) { const pattern = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }]; }
  const owners = await User.find(filter).select('_id name phone email ownerManagementMode ownerProfile ownerPasswordSetAt createdAt').sort({ name: 1 }).lean();
  res.json(owners.map(o => ({
    _id: o._id, name: o.name, phone: o.phone, email: o.email || '', whatsapp: o.ownerProfile?.whatsapp || '',
    managementMode: o.ownerManagementMode || 'SELF_MANAGED', ownerLoginReady: Boolean(o.ownerPasswordSetAt),
    villas: villas.filter(v => String(v.owner) === String(o._id)).map(v => ({ _id: v._id, name: v.name, location: v.location, website: websiteState(v), managementMode: v.managementMode, villaManager: v.assignedVillaManager?.name || null, cover: v.photos?.find(src => /^https?:/.test(src)) || null }))
  })));
}));

// New owner + first villa.
router.post('/owners', route(async (req, res) => {
  const managementMode = req.body?.managementMode;
  if (!MODES.includes(managementMode)) throw new HttpError(400, 'Choose: self-managed owner or managed by BookMyVilla.');
  const self = managementMode === 'SELF_MANAGED';
  const o = ownerInput(req.body?.owner, { emailRequired: self });
  const villa = villaInput(req.body?.villa);
  const villaManager = self ? null : await activeVillaManager(req.body?.villaManager);
  if (o.email && await User.exists({ email: new RegExp(`^${escapeRegex(o.email)}$`, 'i') })) throw new HttpError(409, 'This email is already used by another account.');
  const owner = await User.create({
    ...o, email: o.email || undefined, role: 'owner', status: 'active',
    // Unknown random password: self-managed owners set theirs from Admin's setup link;
    // BookMyVilla-managed owners never sign in.
    password: crypto.randomBytes(24).toString('hex'),
    ownerManagementMode: managementMode, ...(villaManager && { ownerVillaManager: villaManager })
  });
  let property;
  try { property = await createVilla({ origin: mediaOrigin(req), ownerId: owner._id, villa, managementMode, assignedVillaManager: villaManager, assignedDataEntryUser: req.user.id }); }
  catch (err) { await User.deleteOne({ _id: owner._id }); throw err; }
  res.status(201).json({ owner: { _id: owner._id, name: owner.name, managementMode }, villa: { _id: property._id, name: property.name, website: websiteState(property) } });
}));

// Another villa for an owner this Data Entry user already added.
router.post('/owners/:ownerId/villas', route(async (req, res) => {
  if (!validId(req.params.ownerId) || !await Property.exists({ owner: req.params.ownerId, assignedDataEntryUser: req.user.id })) throw new HttpError(404, 'Owner not found among the owners you added.');
  const owner = await User.findById(req.params.ownerId).select('ownerManagementMode ownerVillaManager');
  const managementMode = owner?.ownerManagementMode || 'SELF_MANAGED';
  const villaManager = managementMode === 'BOOKMYVILLA_MANAGED' ? await activeVillaManager(req.body?.villaManager || owner.ownerVillaManager) : null;
  const property = await createVilla({ origin: mediaOrigin(req), ownerId: owner._id, villa: villaInput(req.body?.villa), managementMode, assignedVillaManager: villaManager, assignedDataEntryUser: req.user.id });
  res.status(201).json({ _id: property._id, name: property.name, website: websiteState(property) });
}));

// ---- Local guides --------------------------------------------------------

function languages(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  const clean = items.map(item => cleanText(item, 30)).filter(item => item !== '');
  if (clean.some(item => item === null) || clean.length > 10) throw new HttpError(400, 'Add up to 10 languages.');
  return [...new Set(clean)];
}

router.get('/guide-areas', route(async (req, res) => {
  const [areas, counts] = await Promise.all([
    GuideArea.find().sort({ name: 1 }).lean(),
    LocalGuide.aggregate([{ $group: { _id: '$area', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }])
  ]);
  const byArea = new Map(counts.map(c => [String(c._id), c]));
  res.json(areas.map(a => ({ ...a, guides: byArea.get(String(a._id))?.total || 0, activeGuides: byArea.get(String(a._id))?.active || 0 })));
}));

router.post('/guide-areas', route(async (req, res) => {
  const name = field(req.body?.name, 80, 'Location name', true);
  const dailyRate = number(req.body?.dailyRate, 1, 1000000, 'Guide rate per day', true);
  if (await GuideArea.exists({ key: areaKey(name) })) throw new HttpError(409, `${name} already exists. Edit its rate instead.`);
  res.status(201).json(await GuideArea.create({ name, key: areaKey(name), dailyRate, createdBy: req.user.id }));
}));

router.patch('/guide-areas/:id', route(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(404, 'Location not found.');
  const set = {};
  if (req.body?.dailyRate !== undefined) set.dailyRate = number(req.body.dailyRate, 1, 1000000, 'Guide rate per day', true);
  if (req.body?.active !== undefined) { if (typeof req.body.active !== 'boolean') throw new HttpError(400, 'Send active: true or false.'); set.active = req.body.active; }
  const area = await GuideArea.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
  if (!area) throw new HttpError(404, 'Location not found.');
  res.json(area);
}));

router.get('/guides', route(async (req, res) => {
  const filter = {};
  if (req.query.area) { if (!validId(req.query.area)) throw new HttpError(400, 'Invalid location.'); filter.area = req.query.area; }
  res.json(await LocalGuide.find(filter).populate('area', 'name').sort({ active: -1, name: 1 }).lean());
}));

router.post('/guides', route(async (req, res) => {
  if (!validId(req.body?.area) || !await GuideArea.exists({ _id: req.body.area })) throw new HttpError(400, 'Choose the guide\'s location.');
  const guide = await LocalGuide.create({
    area: req.body.area, name: field(req.body.name, 100, 'Guide name', true), phone: phone(req.body.phone, 'Guide phone', true),
    languages: languages(req.body.languages), notes: field(req.body.notes, 500, 'Notes'), createdBy: req.user.id
  });
  res.status(201).json(guide);
}));

router.patch('/guides/:id', route(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(404, 'Guide not found.');
  const set = {};
  if (req.body?.name !== undefined) set.name = field(req.body.name, 100, 'Guide name', true);
  if (req.body?.phone !== undefined) set.phone = phone(req.body.phone, 'Guide phone', true);
  if (req.body?.languages !== undefined) set.languages = languages(req.body.languages);
  if (req.body?.notes !== undefined) set.notes = field(req.body.notes, 500, 'Notes');
  if (req.body?.active !== undefined) { if (typeof req.body.active !== 'boolean') throw new HttpError(400, 'Send active: true or false.'); set.active = req.body.active; }
  const guide = await LocalGuide.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true });
  if (!guide) throw new HttpError(404, 'Guide not found.');
  res.json(guide);
}));

module.exports = router;
