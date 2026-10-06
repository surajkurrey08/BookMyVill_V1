const express = require('express');
const mongoose = require('mongoose');
const accountAuth = require('../middleware/accountAuth');
const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Housekeeping = require('../models/HousekeepingTask');
const Request = require('../models/GuestRequest');
const Staff = require('../models/StaffMember');
const Task = require('../models/OperationalTask');
const Stock = require('../models/Inventory');
const Expense = require('../models/OwnerExpense');
const { propertyScope, requirePropertyAccess } = require('../services/propertyAccess');
const { unavailableRooms, requireRoomReady, CHECKLIST } = require('../services/roomReadiness');
const inventory = require('../services/inventory');
const { HttpError, sendError, validId, validDate, indiaDate, addDays, stayNights, pagination, escapeRegex, cleanText, intInRange } = require('../utils/validate');
const router = express.Router();
router.use(accountAuth, (req, res, next) => {
  if (req.user.role !== 'villa_manager' || !['active', 'approved'].includes(req.user.status)) return res.status(403).json({ msg: 'Access denied. An active Villa Manager account is required.' });
  res.set('Cache-Control', 'no-store'); next();
});
// Managed owners and their villas (add owner + villa, state now, history, website switch).
router.use('/owner-directory', require('./villaManagerOwners'));
const route = fn => async (req, res) => { try { await fn(req, res); } catch (err) { sendError(res, err, 'Villa Manager operations'); } };
const oid = id => new mongoose.Types.ObjectId(id);
const scope = req => ({ managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: oid(req.user.id) });
const dayRange = (day = indiaDate()) => ({ $gte: new Date(`${day}T00:00:00Z`), $lt: new Date(`${addDays(day, 1)}T00:00:00Z`) });
const propertyFields = '_id name owner type location status managementMode price';
const bookingFields = '_id property room user guest.name guest.phone guest.email guestDetails.arrivalTime guestDetails.specialRequests checkIn checkOut guests status stayStatus paymentStatus securityDepositAmount operations actualCheckIn actualCheckOut actionHistory guide createdAt';
async function idsFor(req) {
  if (req.query.propertyId && req.query.propertyId !== 'all') return [(await requirePropertyAccess(req.user, req.query.propertyId))._id];
  return (await Property.find(propertyScope(req.user)).select('_id').lean()).map(p => p._id);
}
const { staffId, roomId, text, photos, findScoped } = require('../services/operationInputs');

router.get('/session', route(async (req, res) => {
  const user = await User.findById(req.user.id).select('_id name email phone role status');
  res.json({ user, checklist: CHECKLIST, permissions: { operations: true, pricing: true, expenseEntry: true, payments: false, payouts: false, stayChangeApproval: false } });
}));

// Aggregation computes operational filters before pagination; no client-side portfolio filtering.
router.get('/properties', route(async (req, res) => {
  const filter = scope(req);
  if (req.query.propertyId && req.query.propertyId !== 'all') { await requirePropertyAccess(req.user, req.query.propertyId); filter._id = oid(req.query.propertyId); }
  for (const key of ['type', 'location', 'q']) if (req.query[key]) {
    const value = text(req.query[key], 120);
    if (key === 'q') filter.name = new RegExp(escapeRegex(value), 'i');
    else filter[key] = key === 'location' ? new RegExp(escapeRegex(value), 'i') : value;
  }
  if (req.query.owner) { if (!validId(req.query.owner)) throw new HttpError(400, 'Invalid owner filter.'); filter.owner = oid(req.query.owner); }
  const today = indiaDate(); const start = dayRange(today).$gte; const end = dayRange(today).$lt;
  const pipeline = [{ $match: filter },
    { $lookup: { from: 'bookings', let: { p: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$property', '$$p'] }, status: 'confirmed', $or: [{ stayStatus: 'in_house' }, { checkIn: { $gte: start, $lt: end } }, { checkOut: { $gte: start, $lt: end } }] } }, { $project: { stayStatus: 1, checkIn: 1, checkOut: 1 } }], as: 'todayBookings' } },
    { $lookup: { from: 'guestrequests', let: { p: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$property', '$$p'] }, status: { $in: Request.OPEN_STATUSES } } }, { $count: 'n' }], as: 'issues' } },
    { $lookup: { from: 'rooms', let: { p: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$property', '$$p'] } } }, { $project: { operationalStatus: 1, active: 1 } }], as: 'units' } },
    { $lookup: { from: 'housekeepingtasks', let: { p: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$property', '$$p'] }, status: { $ne: 'done' } } }, { $count: 'n' }], as: 'cleaning' } },
    { $lookup: { from: 'operationaltasks', let: { p: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$property', '$$p'] }, kind: 'maintenance', status: { $ne: 'verified' } } }, { $count: 'n' }], as: 'maintenance' } },
    { $addFields: {
      checkIns: { $size: { $filter: { input: '$todayBookings', as: 'b', cond: { $and: [{ $gte: ['$$b.checkIn', start] }, { $lt: ['$$b.checkIn', end] }, { $eq: ['$$b.stayStatus', 'expected'] }] } } } },
      checkOuts: { $size: { $filter: { input: '$todayBookings', as: 'b', cond: { $and: [{ $gte: ['$$b.checkOut', start] }, { $lt: ['$$b.checkOut', end] }, { $eq: ['$$b.stayStatus', 'in_house'] }] } } } },
      occupied: { $size: { $filter: { input: '$todayBookings', as: 'b', cond: { $eq: ['$$b.stayStatus', 'in_house'] } } } },
      roomCount: { $size: '$units' }, openIssues: { $add: [{ $ifNull: [{ $first: '$issues.n' }, 0] }, { $ifNull: [{ $first: '$maintenance.n' }, 0] }] },
      pendingCleaning: { $ifNull: [{ $first: '$cleaning.n' }, 0] },
      unavailableCount: { $size: { $filter: { input: '$units', as: 'r', cond: { $or: [{ $eq: ['$$r.active', false] }, { $in: ['$$r.operationalStatus', ['maintenance', 'out_of_order']] }] } } } }
    } },
    { $addFields: { operationalStatus: { $cond: [{ $or: [{ $gt: ['$openIssues', 0] }, { $gt: ['$pendingCleaning', 0] }, { $gt: ['$unavailableCount', 0] }] }, 'needs_attention', 'ready'] } } }];
  const operational = {};
  if (req.query.operationalStatus) { if (!['ready', 'needs_attention'].includes(req.query.operationalStatus)) throw new HttpError(400, 'Invalid operational status.'); operational.operationalStatus = req.query.operationalStatus; }
  if (req.query.arrivals === 'true') operational.checkIns = { $gt: 0 };
  if (req.query.issues === 'true') operational.openIssues = { $gt: 0 };
  pipeline.push({ $match: operational });
  const { page, limit, skip } = pagination(req.query, 15);
  pipeline.push({ $facet: { total: [{ $count: 'n' }], items: [{ $sort: { name: 1, _id: 1 } }, { $skip: skip }, { $limit: limit }, { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', pipeline: [{ $project: { name: 1 } }], as: 'ownerInfo' } }, { $project: { name: 1, type: 1, location: 1, status: 1, managementMode: 1, owner: { $first: '$ownerInfo' }, checkIns: 1, checkOuts: 1, occupied: 1, roomCount: 1, openIssues: 1, pendingCleaning: 1, unavailableCount: 1, operationalStatus: 1 } }] } });
  const [result] = await Property.aggregate(pipeline);
  res.json({ items: result.items, total: result.total[0]?.n || 0, page, limit });
}));
router.get('/owners', route(async (req, res) => {
  const owners = await Property.distinct('owner', propertyScope(req.user));
  res.json(await User.find({ _id: { $in: owners } }).select('_id name').sort({ name: 1 }));
}));

router.get('/dashboard', route(async (req, res) => {
  const ids = await idsFor(req); const p = { $in: ids }; const today = indiaDate();
  const [owners, arrivals, departures, activeGuests, cleaning, complaints, requests, maintenance, tasks, roomCount, rooms, needsArrival, openRequests, openTasks, operationalTasks, recentBookings] = await Promise.all([
    Property.distinct('owner', { _id: p }),
    Booking.countDocuments({ property: p, status: 'confirmed', stayStatus: 'expected', checkIn: dayRange() }),
    Booking.countDocuments({ property: p, status: 'confirmed', stayStatus: 'in_house', checkOut: { $lt: dayRange().$lt } }),
    Booking.aggregate([{ $match: { property: p, status: 'confirmed', stayStatus: 'in_house' } }, { $group: { _id: null, n: { $sum: { $ifNull: ['$operations.actualGuests', '$guests'] } } } }]),
    Housekeeping.countDocuments({ property: p, status: { $ne: 'done' } }),
    Request.countDocuments({ property: p, kind: 'issue', status: { $in: Request.OPEN_STATUSES } }),
    Request.countDocuments({ property: p, kind: 'request', status: { $in: Request.OPEN_STATUSES } }),
    Task.countDocuments({ property: p, kind: 'maintenance', status: { $ne: 'verified' } }),
    Task.countDocuments({ property: p, status: { $ne: 'verified' } }),
    Room.countDocuments({ property: p }), unavailableRooms(p),
    Booking.find({ property: p, status: 'confirmed', $or: [{ stayStatus: 'expected', checkIn: { $lt: dayRange().$lt } }, { stayStatus: 'in_house', checkOut: { $lt: dayRange().$lt } }] }).select(bookingFields).populate('property', 'name').populate('room', 'number name').populate('user', 'name phone').sort({ checkIn: 1 }).limit(30).lean(),
    Request.find({ property: p, status: { $in: Request.OPEN_STATUSES } }).select('property booking code category description kind priority status createdAt').populate('property', 'name').sort({ priority: -1, createdAt: 1 }).limit(20).lean(),
    Housekeeping.find({ property: p, status: { $ne: 'done' } }).select('property room title stage dueDate assignedStaff').populate('property', 'name').populate('room', 'number name').sort({ dueDate: 1 }).limit(20).lean(),
    Task.find({ property: p, status: { $ne: 'verified' } }).select('property room kind title status priority dueDate').populate('property', 'name').populate('room', 'number name').sort({ priority: -1, dueDate: 1 }).limit(20).lean(),
    Booking.find({ property: p, status: 'confirmed', createdAt: { $gte: new Date(Date.now() - 86400000) } }).select(bookingFields).populate('property', 'name').populate('user', 'name').sort({ createdAt: -1 }).limit(20).lean()
  ]);
  const notReady = await Room.find({ property: p, _id: { $in: [...rooms.keys()] } }).select('property name number').populate('property', 'name').limit(30).lean();
  res.json({ today, summary: { managedOwners: owners.length, managedProperties: ids.length, arrivals, departures, activeGuests: activeGuests[0]?.n || 0, cleaning, complaints, requests, maintenance, tasks, roomsNotReady: rooms.size, roomCount }, attention: { notifications: await require('../services/operationQueue').operationQueue(ids), bookings: needsArrival, requests: openRequests, housekeeping: openTasks, tasks: operationalTasks, rooms: notReady.map(r => ({ ...r, readinessStatus: rooms.get(String(r._id)) })), recentBookings } });
}));

router.get('/properties/:id', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.params.id);
  const [safe, rooms, readiness, staff, tasks, arrivals] = await Promise.all([
    Property.findById(property._id).select(propertyFields).populate('owner', 'name').lean(),
    Room.find({ property: property._id }).sort({ number: 1 }).lean(), unavailableRooms(property._id),
    Staff.find({ property: property._id }).sort({ active: -1, name: 1 }).lean(),
    Housekeeping.find({ property: property._id }).select('room status stage checklist dueDate booking priority completedAt').sort({ createdAt: -1 }).limit(1000).lean(),
    Booking.find({ property: property._id, status: 'confirmed', stayStatus: 'expected', checkOut: { $gte: dayRange().$gte } }).select('room checkIn guestDetails.arrivalTime').sort({ checkIn: 1 }).limit(100).lean()
  ]);
  res.json({ property: safe, staff, rooms: rooms.map(r => {
    const roomTasks = tasks.filter(t => String(t.room) === String(r._id) && t.status !== 'done');
    const lastReady = tasks.find(t => String(t.room) === String(r._id) && t.status === 'done' && t.stage === 'ready' && t.checklist.length === CHECKLIST.length);
    const required = roomTasks.length * (CHECKLIST.length + 1);
    const completed = roomTasks.reduce((n, t) => n + (t.checklist || []).length, 0);
    return { ...r, readinessStatus: readiness.get(String(r._id)) || 'ready', readinessPercent: ['maintenance', 'out_of_order'].includes(readiness.get(String(r._id))) ? null : required ? Math.floor(completed / required * 100) : lastReady ? 100 : null, pending: roomTasks.flatMap(t => CHECKLIST.filter(c => !t.checklist.includes(c))).concat(roomTasks.length ? ['Final inspection'] : []), nextArrival: arrivals.find(b => String(b.room) === String(r._id)) || null };
  }) });
}));

const resources = {
  bookings: [Booking, 'property'], guests: [Booking, 'property'], housekeeping: [Housekeeping, 'property'], requests: [Request, 'property'], complaints: [Request, 'property'],
  maintenance: [Task, 'property'], tasks: [Task, 'property'], damage: [Task, 'property'], notifications: [Task, 'property'], inventory: [Stock, 'propertyId'], expenses: [Expense, 'property']
};
router.get('/resources/:kind', route(async (req, res) => {
  const config = resources[req.params.kind]; if (!config) throw new HttpError(404, 'Queue not found.');
  const [Model, propertyKey] = config; const filter = { [propertyKey]: { $in: await idsFor(req) } };
  const kind = req.params.kind;
  if (['requests', 'complaints'].includes(kind)) filter.kind = kind === 'requests' ? 'request' : 'issue';
  if (['maintenance', 'damage'].includes(kind)) filter.kind = kind;
  if (kind === 'guests') { filter.status = 'confirmed'; filter.stayStatus = 'in_house'; }
  if (req.query.status) filter.status = text(req.query.status, 40);
  if (req.query.stayStatus) filter.stayStatus = text(req.query.stayStatus, 40);
  if (Model === Booking && req.query.today === 'arrivals') { filter.status = 'confirmed'; filter.stayStatus = 'expected'; filter.checkIn = dayRange(); }
  if (Model === Booking && req.query.today === 'departures') { filter.status = 'confirmed'; filter.stayStatus = 'in_house'; filter.checkOut = { $lt: dayRange().$lt }; }
  if (req.query.q) { const re = new RegExp(escapeRegex(text(req.query.q, 100)), 'i');
    if (Model === Booking) { const people = await User.find({ name: re }).select('_id').limit(1000).lean(); filter.$or = [{ 'guest.name': re }, { 'guest.phone': re }, { user: { $in: people.map(u => u._id) } }, ...(validId(req.query.q) ? [{ _id: req.query.q }] : [])]; }
    else filter.$or = [{ title: re }, { description: re }, { code: re }, { itemName: re }];
  }
  if (req.query.start || req.query.end) {
    if (!validDate(req.query.start) || !validDate(req.query.end) || !stayNights(req.query.start, req.query.end)) throw new HttpError(400, 'Choose a valid date range.');
    if (Model === Booking) { filter.checkIn = { $lt: new Date(`${req.query.end}T00:00:00Z`) }; filter.checkOut = { $gt: new Date(`${req.query.start}T00:00:00Z`) }; }
    else if (Model === Housekeeping || Model === Task) filter.dueDate = { $gte: req.query.start, $lt: req.query.end };
    else if (Model === Expense) filter.incurredOn = { $gte: req.query.start, $lt: req.query.end };
  }
  const { page, limit, skip } = pagination(req.query, 20);
  let query = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit);
  if (Model === Booking) query = query.select(bookingFields).populate('user', 'name phone email').populate('room', 'name number type capacity');
  if (Model === Housekeeping || Model === Task) query = query.populate('room', 'name number').populate('assignedStaff', 'name role').populate('booking', 'checkIn checkOut actualCheckOut');
  if (Model === Request) query = query.select('-owner -customer').populate({ path: 'booking', select: 'guest.name room user checkIn checkOut', populate: [{ path: 'room', select: 'number name' }, { path: 'user', select: 'name' }] }).populate('assignedStaff', 'name role');
  if (Model === Expense) query = query.select('_id property category amount description incurredOn receipt approvalStatus createdAt');
  if (Model === Stock) query = query.select('_id propertyId itemName category quantity unit minThreshold status lastRestocked');
  query = query.populate(propertyKey, 'name');
  const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  res.json({ items, total, page, limit });
}));

router.get('/bookings/:id', route(async (req, res) => {
  await findScoped(Booking, req, req.params.id);
  const booking = await Booking.findById(req.params.id).select(bookingFields).populate('property', 'name').populate('room', 'name number capacity type').populate('user', 'name email phone').populate('guide.assigned', 'name phone').lean();
  res.json(booking);
}));
router.patch('/bookings/:id/details', route(async (req, res) => {
  const booking = await findScoped(Booking, req, req.params.id);
  if (booking.status !== 'confirmed' || booking.stayStatus === 'checked_out') throw new HttpError(409, 'Guest details are locked for this booking.');
  const changes = {};
  if (req.body.arrivalTime !== undefined) changes['guestDetails.arrivalTime'] = text(req.body.arrivalTime, 40);
  if (req.body.internalNote !== undefined) changes['operations.internalNote'] = text(req.body.internalNote, 500);
  for (const flag of ['idVerified', 'depositVerified']) if (req.body[flag] !== undefined) { if (typeof req.body[flag] !== 'boolean') throw new HttpError(400, 'Verification must be true or false.'); changes[`operations.${flag}`] = req.body[flag]; }
  if (req.body.actualGuests !== undefined) {
    const actual = intInRange(req.body.actualGuests, 1, 50); const room = booking.room && await Room.findById(booking.room);
    if (!room || !actual || actual > room.capacity) throw new HttpError(400, 'Assign a room and enter a guest count within its capacity.');
    const extra = Math.max(0, actual - booking.guests); const dates = stayNights(booking.checkIn.toISOString().slice(0, 10), booking.checkOut.toISOString().slice(0, 10));
    if (!dates) throw new HttpError(409, 'Booking dates are invalid.');
    changes['operations.actualGuests'] = actual;
    const amount = extra * (room.extraGuestRate || 0) * dates.length;
    if (booking.operations?.extraGuestPaymentStatus === 'paid' && amount !== booking.operations.extraGuestAmount) throw new HttpError(409, 'Finance must review changes to paid extra guest charges.');
    changes['operations.extraGuestAmount'] = amount;
    changes['operations.extraGuestPaymentStatus'] = extra && room.extraGuestRate === null ? 'quote_required' : amount ? 'pending' : 'not_required';
  }
  if (!Object.keys(changes).length) throw new HttpError(400, 'No guest detail changes supplied.');
  const updated = await Booking.findOneAndUpdate({ _id: booking._id, __v: booking.__v, stayStatus: booking.stayStatus }, { $set: changes, $inc: { __v: 1 }, $push: { actionHistory: { action: 'Guest Details Updated', performedBy: `Villa Manager (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: Object.keys(changes).join(', ') } } }, { new: true });
  if (!updated) throw new HttpError(409, 'Booking changed. Refresh and try again.');
  res.json({ msg: 'Guest details saved.', operations: updated.operations });
}));

router.get('/bookings/:id/alternatives', route(async (req, res) => {
  const booking = await findScoped(Booking, req, req.params.id);
  const dates = stayNights(booking.checkIn.toISOString().slice(0, 10), booking.checkOut.toISOString().slice(0, 10));
  if (!dates) throw new HttpError(409, 'Invalid booking dates.');
  const rooms = await Room.find({ property: booking.property, active: true, capacity: { $gte: booking.operations?.actualGuests || booking.guests } }).lean();
  const unavailable = await unavailableRooms(booking.property);
  const alternatives = [];
  for (const room of rooms) if (String(room._id) !== String(booking.room) && !unavailable.has(String(room._id)) && !(await inventory.conflictingNights(room._id, dates, booking._id)).length && !(await Booking.exists({ room: room._id, status: 'confirmed', stayStatus: 'in_house' }))) alternatives.push({ _id: room._id, name: room.name, number: room.number, type: room.type, capacity: room.capacity, baseRate: room.baseRate });
  res.json(alternatives);
}));
router.get('/bookings/:id/stay-change-check', route(async (req, res) => {
  const booking = await findScoped(Booking, req, req.params.id);
  if (booking.status !== 'confirmed' || booking.stayStatus === 'checked_out' || !booking.room) throw new HttpError(409, 'Select an assigned active booking.');
  const kind = req.query.kind;
  if (!['early_checkin', 'late_checkout', 'extend_stay'].includes(kind)) throw new HttpError(400, 'Choose a valid stay-change request.');
  let conflict = false;
  if (kind === 'early_checkin') { try { await requireRoomReady(booking.room); } catch { conflict = true; }
    if (await Booking.exists({ _id: { $ne: booking._id }, room: booking.room, status: 'confirmed', stayStatus: 'in_house' })) conflict = true;
  } else if (kind === 'late_checkout') {
    const out = booking.checkOut.toISOString().slice(0, 10);
    conflict = (await inventory.conflictingNights(booking.room, [out], booking._id)).length > 0 || !!(await Booking.exists({ _id: { $ne: booking._id }, room: booking.room, status: 'confirmed', checkIn: dayRange(out) }));
  } else {
    const dates = stayNights(booking.checkOut.toISOString().slice(0, 10), req.query.newCheckout);
    if (!dates) throw new HttpError(400, 'Choose a later checkout date within one year.');
    conflict = (await inventory.conflictingNights(booking.room, dates, booking._id)).length > 0;
    if (await Booking.exists({ _id: { $ne: booking._id }, room: booking.room, status: 'confirmed', checkIn: { $lt: new Date(`${req.query.newCheckout}T00:00:00Z`) }, checkOut: { $gt: booking.checkOut } })) conflict = true;
  }
  res.json({ conflict, approved: false, result: conflict ? 'unavailable' : 'policy_review_required', message: conflict ? 'Room readiness or another booking conflicts with this request. Do not approve.' : 'No inventory conflict found. Property timing, cleaning buffer and charges need approval before the stay changes.' });
}));
router.post('/bookings/:id/reassign', route(async (req, res) => {
  const booking = await findScoped(Booking, req, req.params.id); const reason = text(req.body.reason, 200, true);
  if (booking.status !== 'confirmed' || booking.stayStatus === 'checked_out' || !booking.room) throw new HttpError(409, 'Only assigned active bookings can change rooms.');
  const target = await roomId(req.body.roomId, booking.property); const room = await requireRoomReady(target);
  if (String(target) === String(booking.room) || room.capacity < (booking.operations?.actualGuests || booking.guests)) throw new HttpError(400, 'Choose a compatible different room.');
  if (await Booking.exists({ room: target, status: 'confirmed', stayStatus: 'in_house' })) throw new HttpError(409, 'The selected room is occupied.');
  const dates = stayNights(booking.checkIn.toISOString().slice(0, 10), booking.checkOut.toISOString().slice(0, 10));
  if (!dates) throw new HttpError(409, 'Invalid booking dates.');
  const op = await inventory.reserveNights(room, dates, 'booking', booking._id);
  try {
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, room: booking.room, stayStatus: booking.stayStatus, __v: booking.__v }, { $set: { room: target }, $inc: { __v: 1 }, $push: { actionHistory: { action: 'Room Reassigned', performedBy: `Villa Manager (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: `${booking.room} → ${target}: ${reason}` } } }, { new: true });
    if (!updated) throw new HttpError(409, 'Booking changed. Refresh and try again.');
    await RoomNight.deleteMany({ room: booking.room, reference: booking._id, kind: 'booking' });
    if (booking.stayStatus === 'in_house') await Housekeeping.create({ property: booking.property, room: booking.room, booking: booking._id, title: 'Clean room after guest move', category: 'turnover', dueDate: indiaDate() });
    res.json({ msg: 'Room reassigned and reason recorded.' });
  } catch (err) {
    // Compensate only if the booking did not move; never release its new inventory after a post-save task error.
    if (!(await Booking.exists({ _id: booking._id, room: target }))) await RoomNight.deleteMany({ operationId: op });
    throw err;
  }
}));

router.use(require('./sharedOperations'));

router.post('/inventory', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.body.propertyId);
  const quantity = intInRange(req.body.quantity, 0, 1000000); const min = intInRange(req.body.minThreshold, 0, 1000000);
  if (quantity === null || min === null || !Stock.schema.path('category').enumValues.includes(req.body.category)) throw new HttpError(400, 'Enter a valid stock quantity, minimum and category.');
  res.status(201).json(await Stock.create({ propertyId: property._id, ownerId: property.owner, propertyName: property.name, itemName: text(req.body.itemName, 100, true), category: req.body.category, quantity, minThreshold: min, unit: text(req.body.unit || 'Units', 40) }));
}));
router.patch('/inventory/:id', route(async (req, res) => {
  const item = await findScoped(Stock, req, req.params.id, 'propertyId');
  const qty = intInRange(req.body.quantity, 0, 1000000);
  if (qty === null) throw new HttpError(400, 'Enter a valid whole stock quantity.');
  const updated = await Stock.findOneAndUpdate({ _id: item._id, __v: item.__v }, { $set: { quantity: qty, status: qty <= 0 ? 'Out of Stock' : qty <= item.minThreshold ? 'Low Stock' : 'In Stock', lastRestocked: qty > item.quantity ? new Date() : item.lastRestocked }, $inc: { __v: 1 } }, { new: true });
  if (!updated) throw new HttpError(409, 'Stock changed. Refresh and try again.'); res.json(updated);
}));
router.post('/expenses', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.body.propertyId);
  const amount = intInRange(req.body.amount, 1, 100000000);
  if (!amount || !validDate(req.body.incurredOn) || !Expense.schema.path('category').enumValues.includes(req.body.category)) throw new HttpError(400, 'Enter valid expense amount, date and category.');
  const receipt = req.body.receipt ? photos([req.body.receipt])[0] : '';
  res.status(201).json(await Expense.create({ property: property._id, amount, incurredOn: req.body.incurredOn, category: req.body.category, description: text(req.body.description, 200, true), receipt, approvalStatus: 'pending', createdBy: req.user.id }));
}));
router.patch('/rooms/:id/pricing', route(async (req, res) => {
  const room = await findScoped(Room, req, req.params.id); const rate = intInRange(req.body.baseRate, 0, 10000000);
  if (rate === null) throw new HttpError(400, 'Enter a valid base rate.');
  room.baseRate = rate;
  if (req.body.extraGuestRate !== undefined && req.body.extraGuestRate !== '') { const extra = intInRange(req.body.extraGuestRate, 0, 10000000); if (extra === null) throw new HttpError(400, 'Enter a valid extra guest rate.'); room.extraGuestRate = extra; }
  await room.save(); res.json({ msg: 'Room pricing saved.', baseRate: room.baseRate, extraGuestRate: room.extraGuestRate });
}));

router.get('/calendar/:id', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.params.id); const dates = stayNights(req.query.start, req.query.end, 31);
  if (!dates) throw new HttpError(400, 'Choose a calendar range of 1–31 nights.');
  res.json(await require('../services/availability').calendar(property._id, dates));
}));
router.get('/reports', route(async (req, res) => {
  const ids = await idsFor(req); const start = req.query.start || addDays(indiaDate(), -30); const end = req.query.end || addDays(indiaDate(), 1);
  if (!stayNights(start, end)) throw new HttpError(400, 'Choose a report range up to 366 days.');
  const p = { $in: ids }; const [stays, cleaning, tasks, requests] = await Promise.all([
    Booking.aggregate([{ $match: { property: p, actualCheckIn: { $gte: new Date(`${start}T00:00:00Z`), $lt: new Date(`${end}T00:00:00Z`) } } }, { $group: { _id: '$stayStatus', count: { $sum: 1 }, guests: { $sum: { $ifNull: ['$operations.actualGuests', '$guests'] } } } }]),
    Housekeeping.countDocuments({ property: p, status: 'done', completedAt: { $gte: new Date(`${start}T00:00:00Z`), $lt: new Date(`${end}T00:00:00Z`) } }),
    Task.aggregate([{ $match: { property: p, createdAt: { $gte: new Date(`${start}T00:00:00Z`), $lt: new Date(`${end}T00:00:00Z`) } } }, { $group: { _id: { kind: '$kind', status: '$status' }, count: { $sum: 1 } } }]),
    Request.aggregate([{ $match: { property: p, createdAt: { $gte: new Date(`${start}T00:00:00Z`), $lt: new Date(`${end}T00:00:00Z`) } } }, { $group: { _id: { kind: '$kind', status: '$status' }, count: { $sum: 1 } } }])
  ]); res.json({ start, end, stays, cleaning, tasks, requests });
}));
module.exports = router;
