const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/propertyOperatorAuth');
const { requirePropertyAccess, ownerPropertyView } = require('../services/propertyAccess');
const { sendError } = require('../utils/validate');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const StaffMember = require('../models/StaffMember');
const HousekeepingTask = require('../models/HousekeepingTask');
const GuestRequest = require('../models/GuestRequest');
const { ensureModelIndexes } = require('../utils/modelIndexes');

const router = express.Router();
router.use(ownerAuth);
router.get('/notifications', async (req,res) => { try {
 const { propertyScope } = require('../services/propertyAccess');
 const ids = req.query.propertyId ? [(await requirePropertyAccess(req.user, req.query.propertyId))._id] : await require('../models/Property').find(propertyScope(req.user)).distinct('_id');
 res.json(await require('../services/operationQueue').operationQueue(ids));
} catch(err) { failure(res,err); } });
router.use(require('./sharedOperations'));

const validId = value => mongoose.Types.ObjectId.isValid(value);
const STAFF_ROLES = StaffMember.schema.path('role').enumValues;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const indiaDate = date => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

async function propertyForOwner(req, res, id) {
  if (!validId(id)) { res.status(400).json({ msg: 'Invalid property ID.' }); return null; }
  return requirePropertyAccess(req.user, id, req.method === 'GET' ? 'report' : 'operate');
}

async function bookingForOwner(req, res, id) {
  if (!validId(id)) { res.status(400).json({ msg: 'Invalid booking ID.' }); return null; }
  const booking = await Booking.findById(id);
  if (!booking) {
    res.status(404).json({ msg: 'Booking not found in your account.' });
    return null;
  }
  await requirePropertyAccess(req.user, booking.property);
  return booking;
}

function failure(res, err) {
  if (err.code === 11000) return res.status(409).json({ msg:'The room already has an in-house stay. Refresh before retrying.' });
  sendError(res, err, 'Property operations');
}
function bookingView(req, booking) {
  if (req.user.role !== 'villa_manager') return booking;
  const result = booking.toObject ? booking.toObject() : { ...booking };
  if (result.guestDetails) { delete result.guestDetails.idProof; delete result.guestDetails.idLastFour; }
  for (const key of ['razorpayOrderId', 'razorpayPaymentId', 'manualPaymentReference']) delete result[key];
  return result;
}

router.get('/board/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    const start = req.query.start || indiaDate(new Date());
    if (!validDate(start)) return res.status(400).json({ msg: 'Select a valid start date.' });
    const end = req.query.end || new Date(Date.parse(`${start}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
    if (!validDate(start) || !validDate(end) || span < 1 || span > 31) return res.status(400).json({ msg: 'Select a date range of 1–31 days.' });
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const bookings = await Booking.find({
      property: property._id,
      status: 'confirmed',
      $or: [
        { checkIn: { $gte: startDate, $lt: endDate } },
        { checkOut: { $gte: startDate, $lt: endDate } },
        { actualCheckIn: { $gte: startDate, $lt: endDate } },
        { actualCheckOut: { $gte: startDate, $lt: endDate } },
        { stayStatus: 'in_house' }
      ]
    }).populate('user', 'name email phone').populate('room', 'name number type').sort({ checkIn: 1 });
    const today = indiaDate(new Date());
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000);
    const todayStart = new Date(`${today}T00:00:00Z`);
    const [arrivalsToday, departuresToday, inHouse, openTasks, openRequests] = await Promise.all([
      Booking.countDocuments({ property: property._id, status: 'confirmed', checkIn: { $gte: todayStart, $lt: tomorrow }, stayStatus: { $in: ['expected', null] } }),
      Booking.countDocuments({ property: property._id, status: 'confirmed', checkOut: { $gte: todayStart, $lt: tomorrow }, stayStatus: 'in_house' }),
      Booking.countDocuments({ property: property._id, status: 'confirmed', stayStatus: 'in_house' }),
      HousekeepingTask.countDocuments({ property: property._id, status: { $ne: 'done' } }),
      GuestRequest.countDocuments({ property: property._id, status: { $in: GuestRequest.OPEN_STATUSES } })
    ]);
    const visibleProperty = ownerPropertyView(req.user, property);
    res.json({ property: { _id: property._id, name: property.name, managementMode: visibleProperty.managementMode, canOperate: visibleProperty.canOperate }, start, end, today, bookings: bookings.map(b => bookingView(req, b)), summary: {
      arrivalsToday, departuresToday, inHouse, openTasks, openRequests
    } });
  } catch (err) { failure(res, err); }
});

router.get('/rooms/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    res.json(await Room.find({ property: property._id }).select('_id name number active').sort({ number: 1 }));
  } catch (err) { failure(res, err); }
});

router.post('/bookings/:bookingId/check-in', async (req, res) => {
  try {
    const booking = await bookingForOwner(req, res, req.params.bookingId);
    if (!booking) return;
    if (booking.status !== 'confirmed' || !booking.room) return res.status(409).json({ msg: 'Confirm the booking and assign a room before check-in.' });
    const selectedRoom = await require('../services/roomReadiness').requireRoomReady(booking.room);
    if ((booking.operations?.actualGuests || booking.guests) > selectedRoom.capacity) return res.status(409).json({ msg: 'Guest count exceeds the room capacity.' });
    if (await Booking.exists({ _id:{ $ne:booking._id }, room:booking.room, stayStatus:'in_house' })) return res.status(409).json({ msg:'This room still has an in-house guest.' });
    await ensureModelIndexes(Booking);
    if (req.user.role === 'villa_manager') {
      const today = indiaDate(new Date());
      if (booking.checkIn.toISOString().slice(0, 10) > today || booking.checkOut.toISOString().slice(0, 10) <= today) return res.status(409).json({ msg: 'Check-in is available only during the booked stay dates.' });
      if (!booking.operations?.idVerified || booking.paymentStatus !== 'paid' || (booking.securityDepositAmount > 0 && !booking.operations?.depositVerified)) return res.status(409).json({ msg: 'Verify guest ID, booking payment and applicable deposit before check-in.' });
      if (['pending', 'quote_required'].includes(booking.operations?.extraGuestPaymentStatus)) return res.status(409).json({ msg: 'Extra guest payment requires finance confirmation before check-in.' });
      const room = await Room.findById(booking.room);
      if ((booking.operations?.actualGuests || booking.guests) > room.capacity) return res.status(409).json({ msg: 'Guest count exceeds the room capacity.' });
      if ((await require('../services/inventory').conflictingNights(booking.room, [today], booking._id)).length) return res.status(409).json({ msg: 'This room is blocked or reserved for another stay today.' });
      if (await Booking.exists({ _id: { $ne: booking._id }, room: booking.room, status: 'confirmed', stayStatus: 'in_house' })) return res.status(409).json({ msg: 'This room still has an in-house guest.' });
    }
    const roomNeedsCleaning = await HousekeepingTask.exists({ property: booking.property, room: booking.room, category: { $in: ['turnover', 'cleaning'] }, status: { $ne: 'done' }, dueDate: { $lte: indiaDate(new Date()) } });
    if (roomNeedsCleaning) return res.status(409).json({ msg: 'Complete the room cleaning task before check-in.' });
    const now = new Date();
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: 'confirmed', room: { $ne: null }, stayStatus: { $in: ['expected', null] } }, {
      $set: { stayStatus: 'in_house', actualCheckIn: now },
      $push: { actionHistory: { action: 'Guest Checked In', performedBy: `${req.user.role === 'villa_manager' ? 'Villa Manager' : 'Property Owner'} (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: 'Guest arrival recorded in property operations.', timestamp: now } }
    }, { new: true }).populate('user', 'name email phone').populate('room', 'name number');
    if (!updated) return res.status(409).json({ msg: 'Booking state changed. Refresh the board.' });
    res.json(bookingView(req, updated));
  } catch (err) { failure(res, err); }
});

router.post('/bookings/:bookingId/check-out', async (req, res) => {
  try {
    const booking = await bookingForOwner(req, res, req.params.bookingId);
    if (!booking) return;
    if (booking.stayStatus !== 'in_house') return res.status(409).json({ msg: 'Only an in-house guest can be checked out.' });
    const now = new Date();
    await ensureModelIndexes(HousekeepingTask);
    const task = await HousekeepingTask.findOneAndUpdate({ dedupeKey: `checkout:${booking._id}` }, { $setOnInsert: { property: booking.property, room: booking.room, booking: booking._id, title: 'Clean room after checkout', category: 'turnover', dueDate: indiaDate(now), status: 'open', stage: 'dirty' } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: 'confirmed', stayStatus: 'in_house' }, {
      $set: { stayStatus: 'checked_out', actualCheckOut: now },
      $push: { actionHistory: { action: 'Guest Checked Out', performedBy: `${req.user.role === 'villa_manager' ? 'Villa Manager' : 'Property Owner'} (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: 'Guest departure recorded in property operations.', timestamp: now } }
    }, { new: true }).populate('user', 'name email phone').populate('room', 'name number');
    if (!updated) return res.status(409).json({ msg: 'Booking state changed. Refresh the board.' });
    res.json({ booking: bookingView(req, updated), task, warning: null });
  } catch (err) { failure(res, err); }
});

router.get('/staff/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    res.json(await StaffMember.find({ property: property._id }).sort({ active: -1, name: 1 }));
  } catch (err) { failure(res, err); }
});

router.post('/staff/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    const name = String(req.body.name || '').trim();
    const role = req.body.role;
    const phone = String(req.body.phone || '').trim();
    if (!name || name.length > 100 || !STAFF_ROLES.includes(role) || phone.length > 20 || (phone && !/^[+\d\s()-]+$/.test(phone))) {
      return res.status(400).json({ msg: 'Enter a valid staff name, role, and optional phone.' });
    }
    res.status(201).json(await StaffMember.create({ property: property._id, name, role, phone }));
  } catch (err) { failure(res, err); }
});

router.patch('/staff-member/:staffId', async (req, res) => {
  try {
    if (!validId(req.params.staffId)) return res.status(400).json({ msg: 'Invalid staff ID.' });
    const staff = await StaffMember.findById(req.params.staffId);
    if (!staff) return res.status(404).json({ msg: 'Staff member not found in your account.' });
    await requirePropertyAccess(req.user, staff.property);
    if (req.body.name !== undefined) staff.name = String(req.body.name).trim();
    if (req.body.role !== undefined) staff.role = req.body.role;
    if (req.body.phone !== undefined) staff.phone = String(req.body.phone).trim();
    if (req.body.active !== undefined) staff.active = req.body.active === true;
    if (!staff.name || staff.name.length > 100 || !STAFF_ROLES.includes(staff.role) || staff.phone.length > 20 || (staff.phone && !/^[+\d\s()-]+$/.test(staff.phone))) {
      return res.status(400).json({ msg: 'Invalid staff details.' });
    }
    await staff.save();
    res.json(staff);
  } catch (err) { failure(res, err); }
});

router.get('/housekeeping/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    const tasks = await HousekeepingTask.find({ property: property._id }).populate('room', 'name number').populate('assignedStaff', 'name role active').sort({ status: 1, dueDate: 1, createdAt: -1 }).limit(300);
    res.json(tasks);
  } catch (err) { failure(res, err); }
});

router.post('/housekeeping/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    const title = String(req.body.title || '').trim();
    const notes = String(req.body.notes || '').trim();
    const category = req.body.category;
    const dueDate = req.body.dueDate;
    if (!validId(req.body.roomId) || !title || title.length > 120 || notes.length > 500 || !['turnover', 'cleaning', 'inspection', 'maintenance'].includes(category) || !validDate(dueDate)) {
      return res.status(400).json({ msg: 'Enter a room, task title, category, and valid due date.' });
    }
    const room = await Room.findOne({ _id: req.body.roomId, property: property._id });
    if (!room) return res.status(404).json({ msg: 'Room not found at this property.' });
    let assignedStaff = null;
    if (req.body.assignedStaffId) {
      if (!validId(req.body.assignedStaffId)) return res.status(400).json({ msg: 'Invalid staff ID.' });
      assignedStaff = await StaffMember.findOne({ _id: req.body.assignedStaffId, property: property._id, active: true });
      if (!assignedStaff) return res.status(404).json({ msg: 'Active staff member not found at this property.' });
    }
    const task = await HousekeepingTask.create({ property: property._id, room: room._id, title, category, dueDate, notes, assignedStaff: assignedStaff?._id || null });
    await task.populate('room', 'name number');
    await task.populate('assignedStaff', 'name role active');
    res.status(201).json(task);
  } catch (err) { failure(res, err); }
});

// --- Guest requests & issues raised by customers during their stay ---------
const GUEST_OPEN = GuestRequest.OPEN_STATUSES;
const OWNER_NEXT = ['acknowledged', 'in_progress', 'completed', 'declined'];

router.get('/guest-requests/:propertyId', async (req, res) => {
  try {
    const property = await propertyForOwner(req, res, req.params.propertyId);
    if (!property) return;
    const filter = { property: property._id };
    if (req.query.status === 'open') filter.status = { $in: GUEST_OPEN };
    else if (req.query.status && GuestRequest.STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const requests = await GuestRequest.find(filter).sort({ status: 1, priority: -1, createdAt: -1 }).limit(200)
      .populate('booking', 'checkIn checkOut stayStatus guest user').lean();
    const open = await GuestRequest.countDocuments({ property: property._id, status: { $in: GUEST_OPEN } });
    res.json({ requests, openCount: open });
  } catch (err) { failure(res, err); }
});

router.patch('/guest-request/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ msg: 'Invalid request ID.' });
    const request = await GuestRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Guest request not found in your account.' });
    await requirePropertyAccess(req.user, request.property);
    if (['completed', 'declined', 'cancelled'].includes(request.status)) return res.status(409).json({ msg: 'This request is already closed.' });
    const status = req.body.status;
    if (!OWNER_NEXT.includes(status)) return res.status(400).json({ msg: 'Choose a valid status update.' });
    const note = String(req.body.note || '').trim().slice(0, 500);
    const eta = String(req.body.eta || '').trim().slice(0, 80);
    const changes = { status };
    if (req.body.escalated !== undefined) { if (typeof req.body.escalated !== 'boolean') return res.status(400).json({ msg: 'Invalid escalation flag.' }); changes.escalated = req.body.escalated; }
    if (req.body.assignedStaffId !== undefined) {
      const staff = validId(req.body.assignedStaffId) && await StaffMember.findOne({ _id: req.body.assignedStaffId, property: request.property, active: true });
      if (!staff) return res.status(400).json({ msg: 'Choose active staff at this property.' });
      changes.assignedStaff = staff._id;
    }
    if (eta !== '') changes.eta = eta;
    if (['completed', 'declined'].includes(status)) changes.resolvedAt = new Date();
    const updated = await GuestRequest.findOneAndUpdate({ _id: request._id, property: request.property, status: request.status }, {
      $set: changes,
      $push: { updates: { status, note, byRole: req.user.role, at: new Date() } }
    }, { new: true }).populate('booking', 'checkIn checkOut stayStatus guest user');
    if (!updated) return res.status(409).json({ msg: 'This request changed while you were editing. Refresh and try again.' });
    res.json(updated);
  } catch (err) { failure(res, err); }
});

module.exports = router;
