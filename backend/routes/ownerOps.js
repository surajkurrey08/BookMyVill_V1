const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const StaffMember = require('../models/StaffMember');
const HousekeepingTask = require('../models/HousekeepingTask');

const router = express.Router();
router.use(ownerAuth);

const validId = value => mongoose.Types.ObjectId.isValid(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const indiaDate = date => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

async function propertyForOwner(req, res, id) {
  if (!validId(id)) { res.status(400).json({ msg: 'Invalid property ID.' }); return null; }
  const property = await Property.findOne({ _id: id, owner: req.user.id });
  if (!property) res.status(404).json({ msg: 'Property not found in your account.' });
  return property;
}

async function bookingForOwner(req, res, id) {
  if (!validId(id)) { res.status(400).json({ msg: 'Invalid booking ID.' }); return null; }
  const booking = await Booking.findById(id);
  if (!booking || !(await Property.exists({ _id: booking.property, owner: req.user.id }))) {
    res.status(404).json({ msg: 'Booking not found in your account.' });
    return null;
  }
  return booking;
}

function failure(res, err) {
  console.error('Owner operations error:', err);
  if (!res.headersSent) res.status(500).json({ msg: 'Could not complete this action. Please try again.' });
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
    const [arrivalsToday, departuresToday, inHouse, openTasks] = await Promise.all([
      Booking.countDocuments({ property: property._id, status: 'confirmed', checkIn: { $gte: todayStart, $lt: tomorrow }, stayStatus: { $in: ['expected', null] } }),
      Booking.countDocuments({ property: property._id, status: 'confirmed', checkOut: { $gte: todayStart, $lt: tomorrow }, stayStatus: 'in_house' }),
      Booking.countDocuments({ property: property._id, status: 'confirmed', stayStatus: 'in_house' }),
      HousekeepingTask.countDocuments({ property: property._id, status: { $ne: 'done' } })
    ]);
    res.json({ property: { _id: property._id, name: property.name }, start, end, today, bookings, summary: {
      arrivalsToday, departuresToday, inHouse, openTasks
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
    const roomNeedsCleaning = await HousekeepingTask.exists({ property: booking.property, room: booking.room, category: { $in: ['turnover', 'cleaning'] }, status: { $ne: 'done' }, dueDate: { $lte: indiaDate(new Date()) } });
    if (roomNeedsCleaning) return res.status(409).json({ msg: 'Complete the room cleaning task before check-in.' });
    const now = new Date();
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: 'confirmed', room: { $ne: null }, stayStatus: { $in: ['expected', null] } }, {
      $set: { stayStatus: 'in_house', actualCheckIn: now },
      $push: { actionHistory: { action: 'Guest Checked In', performedBy: `Property Owner (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: 'Guest arrival recorded in owner operations.', timestamp: now } }
    }, { new: true }).populate('user', 'name email phone').populate('room', 'name number');
    if (!updated) return res.status(409).json({ msg: 'Booking state changed. Refresh the board.' });
    res.json(updated);
  } catch (err) { failure(res, err); }
});

router.post('/bookings/:bookingId/check-out', async (req, res) => {
  try {
    const booking = await bookingForOwner(req, res, req.params.bookingId);
    if (!booking) return;
    if (booking.stayStatus !== 'in_house') return res.status(409).json({ msg: 'Only an in-house guest can be checked out.' });
    const now = new Date();
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: 'confirmed', stayStatus: 'in_house' }, {
      $set: { stayStatus: 'checked_out', actualCheckOut: now },
      $push: { actionHistory: { action: 'Guest Checked Out', performedBy: `Property Owner (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: 'Guest departure recorded in owner operations.', timestamp: now } }
    }, { new: true }).populate('user', 'name email phone').populate('room', 'name number');
    if (!updated) return res.status(409).json({ msg: 'Booking state changed. Refresh the board.' });
    let task = null;
    let warning = null;
    try {
      await HousekeepingTask.init();
      task = await HousekeepingTask.findOneAndUpdate({ dedupeKey: `checkout:${booking._id}` }, {
        $setOnInsert: { property: booking.property, room: booking.room, booking: booking._id, title: 'Clean room after checkout', category: 'turnover', dueDate: indiaDate(now), status: 'open' }
      }, { new: true, upsert: true, setDefaultsOnInsert: true });
    } catch (err) {
      console.error('Checkout housekeeping task error:', err);
      warning = 'Checkout saved, but the cleaning task could not be created. Add it manually.';
    }
    res.json({ booking: updated, task, warning });
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
    if (!name || name.length > 100 || !['caretaker', 'front_desk', 'housekeeping', 'maintenance', 'manager'].includes(role) || phone.length > 20 || (phone && !/^[+\d\s()-]+$/.test(phone))) {
      return res.status(400).json({ msg: 'Enter a valid staff name, role, and optional phone.' });
    }
    res.status(201).json(await StaffMember.create({ property: property._id, name, role, phone }));
  } catch (err) { failure(res, err); }
});

router.patch('/staff-member/:staffId', async (req, res) => {
  try {
    if (!validId(req.params.staffId)) return res.status(400).json({ msg: 'Invalid staff ID.' });
    const staff = await StaffMember.findById(req.params.staffId);
    if (!staff || !(await Property.exists({ _id: staff.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Staff member not found in your account.' });
    if (req.body.name !== undefined) staff.name = String(req.body.name).trim();
    if (req.body.role !== undefined) staff.role = req.body.role;
    if (req.body.phone !== undefined) staff.phone = String(req.body.phone).trim();
    if (req.body.active !== undefined) staff.active = req.body.active === true;
    if (!staff.name || staff.name.length > 100 || !['caretaker', 'front_desk', 'housekeeping', 'maintenance', 'manager'].includes(staff.role) || staff.phone.length > 20 || (staff.phone && !/^[+\d\s()-]+$/.test(staff.phone))) {
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

router.patch('/housekeeping-task/:taskId', async (req, res) => {
  try {
    if (!validId(req.params.taskId)) return res.status(400).json({ msg: 'Invalid task ID.' });
    const task = await HousekeepingTask.findById(req.params.taskId);
    if (!task || !(await Property.exists({ _id: task.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Task not found in your account.' });
    const changes = {};
    if (req.body.status !== undefined) {
      const allowed = { open: ['open', 'in_progress', 'done'], in_progress: ['in_progress', 'open', 'done'], done: ['done', 'open'] };
      if (!allowed[task.status]?.includes(req.body.status)) return res.status(409).json({ msg: 'Invalid task status change.' });
      changes.status = req.body.status;
      changes.completedAt = req.body.status === 'done' ? new Date() : null;
    }
    if (req.body.dueDate !== undefined) {
      if (!validDate(req.body.dueDate)) return res.status(400).json({ msg: 'Invalid due date.' });
      changes.dueDate = req.body.dueDate;
    }
    if (req.body.notes !== undefined) {
      const notes = String(req.body.notes).trim();
      if (notes.length > 500) return res.status(400).json({ msg: 'Notes must be under 500 characters.' });
      changes.notes = notes;
    }
    if (req.body.assignedStaffId !== undefined) {
      if (req.body.assignedStaffId === null || req.body.assignedStaffId === '') changes.assignedStaff = null;
      else {
        if (!validId(req.body.assignedStaffId)) return res.status(400).json({ msg: 'Invalid staff ID.' });
        const staff = await StaffMember.findOne({ _id: req.body.assignedStaffId, property: task.property, active: true });
        if (!staff) return res.status(404).json({ msg: 'Active staff member not found at this property.' });
        changes.assignedStaff = staff._id;
      }
    }
    if (Object.keys(changes).length === 0) return res.status(400).json({ msg: 'No task changes supplied.' });
    const update = { $set: changes };
    if (changes.status && changes.status !== task.status) update.$push = { history: { from: task.status, to: changes.status, by: req.user.id, at: new Date() } };
    const updated = await HousekeepingTask.findOneAndUpdate({ _id: task._id, status: task.status }, update, { new: true }).populate('room', 'name number').populate('assignedStaff', 'name role active');
    if (!updated) return res.status(409).json({ msg: 'Task changed while editing. Refresh and try again.' });
    res.json(updated);
  } catch (err) { failure(res, err); }
});

module.exports = router;
