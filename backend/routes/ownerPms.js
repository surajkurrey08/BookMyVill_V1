const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const PartnerApplication = require('../models/PartnerApplication');
const User = require('../models/User');
const { reserveNights, activeNightFilter } = require('../services/inventory');

const router = express.Router();
router.use(ownerAuth);

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function nightsBetween(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return null;
  const first = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(+first) || Number.isNaN(+last) || first.toISOString().slice(0, 10) !== start || last.toISOString().slice(0, 10) !== end) return null;
  const count = Math.round((last - first) / 86400000);
  if (count < 1 || count > 366) return null;
  return Array.from({ length: count }, (_, i) => new Date(+first + i * 86400000).toISOString().slice(0, 10));
}

async function ownedProperty(req, res, id) {
  if (!validId(id)) {
    res.status(400).json({ msg: 'Invalid property ID.' });
    return null;
  }
  const property = await Property.findOne({ _id: id, owner: req.user.id });
  if (!property) res.status(404).json({ msg: 'Property not found in your account.' });
  return property;
}

async function ownedRoom(req, res, id) {
  if (!validId(id)) {
    res.status(400).json({ msg: 'Invalid room ID.' });
    return null;
  }
  const room = await Room.findById(id);
  if (!room || !(await Property.exists({ _id: room.property, owner: req.user.id }))) {
    res.status(404).json({ msg: 'Room not found in your account.' });
    return null;
  }
  return room;
}

function fail(res, err) {
  console.error('Owner PMS error:', err);
  if (!res.headersSent) res.status(500).json({ msg: 'Could not complete this action. Please try again.' });
}

router.get('/properties', async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id }).select('_id name location status').sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) { fail(res, err); }
});

router.get('/approved-listings', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email');
    const email = (user?.email || '').toLowerCase().trim();
    if (!email) return res.json([]);
    const applications = await PartnerApplication.find({ email, status: 'approved', partnerType: { $in: ['Property Owner', 'Villa Host'] } }).select('_id propertyName city propertyType');
    const existing = await Property.find({ owner: req.user.id }).select('name sourceApplication');
    res.json(applications.filter(app => app.propertyName && app.propertyName !== 'N/A' && !existing.some(property => String(property.sourceApplication || '') === String(app._id) || property.name.toLowerCase().trim() === app.propertyName.toLowerCase().trim())));
  } catch (err) { fail(res, err); }
});

router.post('/approved-listings/:applicationId/import', async (req, res) => {
  try {
    if (!validId(req.params.applicationId)) return res.status(400).json({ msg: 'Invalid application ID.' });
    const user = await User.findById(req.user.id).select('email');
    const email = (user?.email || '').toLowerCase().trim();
    const application = await PartnerApplication.findOne({ _id: req.params.applicationId, email, status: 'approved', partnerType: { $in: ['Property Owner', 'Villa Host'] } });
    if (!application || !application.propertyName || application.propertyName === 'N/A') return res.status(404).json({ msg: 'Approved listing not found in your account.' });
    const existing = await Property.findOne({ owner: req.user.id, $or: [{ sourceApplication: application._id }, { name: application.propertyName }] });
    if (existing) {
      if (!existing.sourceApplication) { existing.sourceApplication = application._id; await existing.save(); }
      return res.json(existing);
    }
    const numericPrice = Number(String(application.price || '').replace(/[^\d.]/g, ''));
    const property = await Property.create({ owner: req.user.id, sourceApplication: application._id, name: application.propertyName, type: application.propertyType || 'Villa', location: application.city || 'Mahabaleshwar', price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : 10000, mapLink: application.mapLink || '', photos: application.photos || [], videos: application.videos || [], status: 'approved' });
    res.status(201).json(property);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'This approved listing has already been imported.' });
    fail(res, err);
  }
});

router.get('/properties/:propertyId/availability', async (req, res) => {
  try {
    const property = await ownedProperty(req, res, req.params.propertyId);
    if (!property) return;
    const start = req.query.start;
    const end = req.query.end;
    const dates = nightsBetween(start, end);
    if (!dates) return res.status(400).json({ msg: 'Choose a valid date range of 1–366 nights.' });
    const [rooms, roomNights, unassignedBookings] = await Promise.all([
      Room.find({ property: property._id }).sort({ number: 1 }),
      RoomNight.find({ property: property._id, date: { $gte: start, $lt: end }, ...activeNightFilter() }).sort({ date: 1 }),
      Booking.find({ property: property._id, room: null, status: 'confirmed', checkIn: { $lt: new Date(`${end}T00:00:00.000Z`) }, checkOut: { $gt: new Date(`${start}T00:00:00.000Z`) } })
        .populate('user', 'name email').select('user guest checkIn checkOut status')
    ]);
    res.json({ property, rooms, nights: roomNights, unassignedBookings, start, end });
  } catch (err) { fail(res, err); }
});

router.post('/properties/:propertyId/rooms', async (req, res) => {
  try {
    const property = await ownedProperty(req, res, req.params.propertyId);
    if (!property) return;
    const name = String(req.body.name || '').trim();
    const number = String(req.body.number || '').trim();
    const type = String(req.body.type || '').trim();
    const capacity = Number(req.body.capacity);
    const baseRate = Number(req.body.baseRate);
    if (!name || name.length > 80 || !number || number.length > 30 || !type || type.length > 60 || !Number.isInteger(capacity) || capacity < 1 || capacity > 50 || req.body.baseRate === '' || !Number.isFinite(baseRate) || baseRate < 0) {
      return res.status(400).json({ msg: 'Enter a room name, unique number, type, capacity (1–50), and valid base rate.' });
    }
    const room = await Room.create({ property: property._id, name, number, type, capacity, baseRate });
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'This room number already exists for this property.' });
    fail(res, err);
  }
});

router.patch('/rooms/:roomId', async (req, res) => {
  try {
    const room = await ownedRoom(req, res, req.params.roomId);
    if (!room) return;
    const { name, number, type, capacity, baseRate, active } = req.body;
    if (name !== undefined) room.name = String(name).trim();
    if (number !== undefined) room.number = String(number).trim();
    if (type !== undefined) room.type = String(type).trim();
    if (capacity !== undefined) room.capacity = Number(capacity);
    if (baseRate !== undefined) room.baseRate = Number(baseRate);
    if (active !== undefined) room.active = active === true;
    if (!room.name || room.name.length > 80 || !room.number || room.number.length > 30 || !room.type || room.type.length > 60 || !Number.isInteger(room.capacity) || room.capacity < 1 || room.capacity > 50 || baseRate === '' || !Number.isFinite(room.baseRate) || room.baseRate < 0) {
      return res.status(400).json({ msg: 'Invalid room details.' });
    }
    if (!room.active && await RoomNight.exists({ room: room._id, date: { $gte: new Date().toISOString().slice(0, 10) }, kind: 'booking' })) {
      return res.status(409).json({ msg: 'This room has future reservations and cannot be deactivated.' });
    }
    await room.save();
    res.json(room);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'This room number already exists for this property.' });
    fail(res, err);
  }
});

router.post('/rooms/:roomId/blocks', async (req, res) => {
  try {
    const room = await ownedRoom(req, res, req.params.roomId);
    if (!room) return;
    if (!room.active) return res.status(409).json({ msg: 'Activate this room before blocking dates.' });
    const dates = nightsBetween(req.body.start, req.body.end);
    const reason = String(req.body.reason || '').trim();
    if (!dates || reason.length > 200) return res.status(400).json({ msg: 'Choose valid dates and a reason under 200 characters.' });
    const reference = new mongoose.Types.ObjectId();
    await reserveNights(room, dates, 'block', reference, { reason });
    res.status(201).json({ reference, room: room._id, start: req.body.start, end: req.body.end, reason });
  } catch (err) { if (err.status) res.status(err.status).json({ msg: err.message }); else fail(res, err); }
});

router.delete('/blocks/:reference', async (req, res) => {
  try {
    if (!validId(req.params.reference)) return res.status(400).json({ msg: 'Invalid block ID.' });
    const night = await RoomNight.findOne({ kind: 'block', reference: req.params.reference });
    if (!night || !(await Property.exists({ _id: night.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Block not found in your account.' });
    await RoomNight.deleteMany({ kind: 'block', reference: night.reference });
    res.json({ msg: 'Dates unblocked.' });
  } catch (err) { fail(res, err); }
});

router.post('/bookings/:bookingId/assign-room', async (req, res) => {
  try {
    if (!validId(req.params.bookingId) || !validId(req.body.roomId)) return res.status(400).json({ msg: 'Invalid booking or room ID.' });
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking || !(await Property.exists({ _id: booking.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Booking not found in your account.' });
    if (booking.status !== 'confirmed' || booking.room) return res.status(409).json({ msg: 'Only an unassigned confirmed booking can be assigned.' });
    const room = await Room.findOne({ _id: req.body.roomId, property: booking.property, active: true });
    if (!room) return res.status(404).json({ msg: 'Active room not found at this property.' });
    const dates = nightsBetween(booking.checkIn.toISOString().slice(0, 10), booking.checkOut.toISOString().slice(0, 10));
    if (!dates) return res.status(409).json({ msg: 'Booking dates are invalid or exceed one year.' });
    const operationId = await reserveNights(room, dates, 'booking', booking._id);
    try {
      const updated = await Booking.findOneAndUpdate({ _id: booking._id, room: null, status: 'confirmed' }, { $set: { room: room._id }, $push: { actionHistory: { action: 'Room Assigned', performedBy: `Property Owner (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: `Room ${room.number} assigned` } } }, { new: true });
      if (!updated) {
        await RoomNight.deleteMany({ operationId });
        return res.status(409).json({ msg: 'Booking changed while assigning the room. Refresh and try again.' });
      }
      res.json(updated);
    } catch (err) {
      await RoomNight.deleteMany({ operationId });
      throw err;
    }
  } catch (err) { if (err.status) res.status(err.status).json({ msg: err.message }); else fail(res, err); }
});

module.exports = router;
