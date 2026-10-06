const express = require('express');
const crypto = require('crypto');
const Property = require('../models/Property');
const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { propertyScope, requirePropertyAccess } = require('../services/propertyAccess');
const { storePropertyMedia, mediaOrigin } = require('../services/propertyMedia');
const LocalGuide = require('../models/LocalGuide');
const { bookingGuideArea, assignBookingGuide } = require('../services/guides');
const { HttpError, sendError, validId, indiaDate, addDays, escapeRegex } = require('../utils/validate');

// Villa Manager "Owners": BookMyVilla-managed owners and their villas.
// The manager adds an owner (contact only — they never sign in) together with a
// villa. The villa is booked as a whole (one "Entire villa" unit), starts
// pending Admin's first approval, and afterwards the manager can switch it on
// or off for the website. Mounted under /api/villa-manager (Villa Manager auth).
const router = express.Router();
const route = fn => async (req, res) => { try { await fn(req, res); } catch (err) { sendError(res, err, 'Villa Manager owners'); } };

const { field, photoList, ownerInput, villaInput, createVilla: createVillaRecord } = require('../services/villaOnboarding');
const VILLA_FIELDS = '_id name owner type location status websiteVisible price bookingMode mapLink photos stayInfo listingData createdAt';

// Villas a manager adds are BookMyVilla-managed and assigned to that manager.
const createVilla = (req, ownerId, villa) => createVillaRecord({ origin: mediaOrigin(req), ownerId, villa, managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: req.user.id });

const dayStart = day => new Date(`${day}T00:00:00Z`);

// Right-now state of each villa: occupied (guest in house), arriving today, or vacant.
async function stayState(ids) {
  const today = indiaDate();
  const start = dayStart(today), end = dayStart(addDays(today, 1));
  const bookings = await Booking.find({ property: { $in: ids }, status: 'confirmed', $or: [{ stayStatus: 'in_house' }, { stayStatus: 'expected', checkOut: { $gte: start } }] })
    .select('property checkIn checkOut stayStatus guests guest.name guest.phone user').populate('user', 'name phone').sort({ checkIn: 1 }).lean();
  const guestOf = b => ({ bookingId: b._id, name: b.guest?.name || b.user?.name || 'Guest', phone: b.guest?.phone || b.user?.phone || '', guests: b.guests, checkIn: b.checkIn, checkOut: b.checkOut });
  return new Map(ids.map(id => {
    const mine = bookings.filter(b => String(b.property) === String(id));
    const inHouse = mine.find(b => b.stayStatus === 'in_house');
    const arriving = mine.find(b => b.stayStatus === 'expected' && b.checkIn >= start && b.checkIn < end);
    const next = mine.find(b => b.stayStatus === 'expected' && b.checkIn >= start);
    return [String(id), {
      state: inHouse ? 'occupied' : arriving ? 'arriving' : 'vacant',
      current: inHouse ? guestOf(inHouse) : arriving ? guestOf(arriving) : null,
      nextCheckIn: next ? next.checkIn : null
    }];
  }));
}

const websiteState = v => v.status === 'approved' ? (v.websiteVisible === false ? 'hidden' : 'live') : v.status === 'pending' ? 'pending_approval' : v.status;

function ownerCard(owner) {
  return { _id: owner._id, name: owner.name, phone: owner.phone || '', email: owner.email || '', whatsapp: owner.ownerProfile?.whatsapp || '', profile: owner.ownerProfile || {}, createdAt: owner.createdAt };
}

// Owners whose villas this manager runs, with each villa's state right now.
router.get('/', route(async (req, res) => {
  const villas = await Property.find(propertyScope(req.user)).select(VILLA_FIELDS).sort({ name: 1 }).lean();
  const ownerIds = [...new Set(villas.map(v => String(v.owner)))];
  const filter = { _id: { $in: ownerIds } };
  const q = field(req.query.q, 80, 'Search');
  if (q) { const pattern = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }]; }
  const [owners, now] = await Promise.all([User.find(filter).select('_id name phone email ownerProfile createdAt').sort({ name: 1 }).lean(), stayState(villas.map(v => v._id))]);
  res.json(owners.map(owner => {
    const own = villas.filter(v => String(v.owner) === String(owner._id)).map(v => ({ _id: v._id, name: v.name, type: v.type, location: v.location, price: v.price, website: websiteState(v), now: now.get(String(v._id)) }));
    return { ...ownerCard(owner), villas: own, occupied: own.filter(v => v.now.state === 'occupied').length, vacant: own.filter(v => v.now.state === 'vacant').length };
  }));
}));

// One owner: contact, villas (info, unit, state now), upcoming bookings and history.
router.get('/:ownerId', route(async (req, res) => {
  if (!validId(req.params.ownerId)) throw new HttpError(404, 'Owner not found.');
  const villas = await Property.find({ ...propertyScope(req.user), owner: req.params.ownerId }).select(`${VILLA_FIELDS} +handover`).sort({ name: 1 }).lean();
  if (!villas.length) throw new HttpError(404, 'Owner not found among the villas you manage.');
  const ids = villas.map(v => v._id);
  const start = dayStart(indiaDate());
  const bookingFields = '_id property checkIn checkOut guests guest.name guest.phone user status stayStatus paymentStatus totalPrice paymentPlan onlineAmount balanceDue balanceCollectedAt guide createdAt';
  const [owner, now, units, upcoming, history, totals] = await Promise.all([
    User.findById(req.params.ownerId).select('_id name phone email ownerProfile createdAt').lean(),
    stayState(ids),
    Room.find({ property: { $in: ids } }).select('property name capacity baseRate extraGuestRate active operationalStatus').lean(),
    Booking.find({ property: { $in: ids }, status: 'confirmed', stayStatus: { $in: ['expected', 'in_house'] }, checkOut: { $gte: start } }).select(bookingFields).populate('user', 'name phone').populate('guide.assigned', 'name phone').sort({ checkIn: 1 }).limit(100).lean(),
    Booking.find({ property: { $in: ids }, $or: [{ stayStatus: 'checked_out' }, { status: 'cancelled' }, { checkOut: { $lt: start } }] }).select(bookingFields).populate('user', 'name phone').sort({ checkIn: -1 }).limit(100).lean(),
    Booking.aggregate([{ $match: { property: { $in: ids }, status: 'confirmed', stayStatus: 'checked_out' } },
      { $group: { _id: null, stays: { $sum: 1 }, nights: { $sum: { $dateDiff: { startDate: '$checkIn', endDate: '$checkOut', unit: 'day' } } }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalPrice', 0] } } } }])
  ]);
  const booking = b => ({ _id: b._id, property: b.property, guestName: b.guest?.name || b.user?.name || 'Guest', guestPhone: b.guest?.phone || b.user?.phone || '', guests: b.guests, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status, stayStatus: b.stayStatus, paymentStatus: b.paymentStatus, totalPrice: b.totalPrice, paymentPlan: b.paymentPlan || 'full', paidOnline: b.paymentStatus === 'paid' ? b.onlineAmount ?? b.totalPrice : 0, balanceDue: b.balanceCollectedAt ? 0 : b.balanceDue || 0,
    guide: b.guide?.requested ? { days: b.guide.days, amount: b.guide.amount, assigned: b.guide.assigned ? { _id: b.guide.assigned._id, name: b.guide.assigned.name, phone: b.guide.assigned.phone } : null } : null });
  res.json({
    owner: ownerCard(owner),
    villas: villas.map(v => ({
      _id: v._id, name: v.name, type: v.type, location: v.location, mapLink: v.mapLink, price: v.price, bookingMode: v.bookingMode,
      status: v.status, websiteVisible: v.websiteVisible !== false, website: websiteState(v), photos: v.photos || [],
      details: v.listingData?.details || {}, stayInfo: v.stayInfo || {}, handover: v.handover || {},
      unit: units.find(u => String(u.property) === String(v._id)) || null, now: now.get(String(v._id))
    })),
    upcoming: upcoming.map(booking),
    history: history.map(booking),
    totals: { stays: totals[0]?.stays || 0, nights: totals[0]?.nights || 0, revenue: totals[0]?.revenue || 0 }
  });
}));

// New owner (contact only, no sign-in) together with their first villa.
router.post('/', route(async (req, res) => {
  const o = ownerInput(req.body?.owner);
  const v = villaInput(req.body?.villa);
  if (o.email && await User.exists({ email: new RegExp(`^${escapeRegex(o.email)}$`, 'i') })) throw new HttpError(409, 'This email is already used by another account. Leave email blank or use a different one.');
  const owner = await User.create({
    ...o, email: o.email || undefined, role: 'owner', status: 'active',
    // Random password nobody knows: BookMyVilla-managed owners don't sign in.
    password: crypto.randomBytes(24).toString('hex'),
    ownerManagementMode: 'BOOKMYVILLA_MANAGED', ownerVillaManager: req.user.id
  });
  let villa;
  try { villa = await createVilla(req, owner._id, v); }
  catch (err) { await User.deleteOne({ _id: owner._id }); throw err; }
  res.status(201).json({ owner: ownerCard(owner), villa: { _id: villa._id, name: villa.name, website: websiteState(villa) } });
}));

// Another villa for an owner this manager already works with.
router.post('/:ownerId/villas', route(async (req, res) => {
  if (!validId(req.params.ownerId) || !await Property.exists({ ...propertyScope(req.user), owner: req.params.ownerId })) throw new HttpError(404, 'Owner not found among the villas you manage.');
  const villa = await createVilla(req, req.params.ownerId, villaInput(req.body));
  res.status(201).json({ _id: villa._id, name: villa.name, website: websiteState(villa) });
}));

// "Show on website" switch. Only after Admin's first approval.
router.patch('/villas/:id/website', route(async (req, res) => {
  if (typeof req.body?.visible !== 'boolean') throw new HttpError(400, 'Send visible: true or false.');
  const property = await requirePropertyAccess(req.user, req.params.id);
  if (property.status !== 'approved') throw new HttpError(409, 'Admin approval is pending. The villa can be shown on the website after Admin approves it.');
  await Property.updateOne({ _id: property._id }, { $set: { websiteVisible: req.body.visible } });
  res.json({ _id: property._id, websiteVisible: req.body.visible, website: req.body.visible ? 'live' : 'hidden' });
}));

// Replace a villa's photos (kept URLs stay; new uploads are saved). First photo is the cover.
router.put('/villas/:id/photos', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.params.id);
  const media = await storePropertyMedia(photoList(req.body?.photos), undefined, mediaOrigin(req));
  try { await Property.updateOne({ _id: property._id }, { $set: { photos: media.photos } }); }
  catch (err) { await media.cleanup(); throw err; }
  res.json({ _id: property._id, photos: media.photos });
}));

// Advance bookings: record that the balance was collected at the villa.
router.post('/bookings/:id/collect-balance', route(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(404, 'Booking not found.');
  const booking = await Booking.findById(req.params.id).select('property status paymentStatus balanceDue balanceCollectedAt');
  if (!booking) throw new HttpError(404, 'Booking not found.');
  await requirePropertyAccess(req.user, String(booking.property));
  if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid' || !(booking.balanceDue > 0) || booking.balanceCollectedAt) throw new HttpError(409, 'This booking has no balance to collect.');
  const amount = booking.balanceDue;
  await Booking.updateOne({ _id: booking._id, balanceCollectedAt: null }, { $set: { balanceCollectedAt: new Date() }, $push: { actionHistory: { action: 'Balance Collected at Villa', performedBy: `Villa Manager (${req.user.id})`, reason: `Collected ₹${amount} on arrival.` } } });
  res.json({ _id: booking._id, balanceCollected: amount });
}));

// Local guide a guest asked for: list guides for the villa's location, then assign one.
async function guideBooking(req) {
  if (!validId(req.params.id)) throw new HttpError(404, 'Booking not found.');
  const booking = await Booking.findById(req.params.id).select('property status paymentStatus stayStatus guide');
  if (!booking) throw new HttpError(404, 'Booking not found.');
  const property = await requirePropertyAccess(req.user, String(booking.property));
  const area = await bookingGuideArea(booking, property);
  return { booking, area };
}
router.get('/bookings/:id/guides', route(async (req, res) => {
  const { area } = await guideBooking(req);
  res.json({ area: area?.name || null, guides: area ? await LocalGuide.find({ area: area._id, active: true }).select('_id name phone languages').sort({ name: 1 }).lean() : [] });
}));
router.post('/bookings/:id/guide', route(async (req, res) => {
  const { booking, area } = await guideBooking(req);
  res.json(await assignBookingGuide(booking, area, req.body?.guideId, `Villa Manager (${req.user.id})`));
}));

module.exports = router;
