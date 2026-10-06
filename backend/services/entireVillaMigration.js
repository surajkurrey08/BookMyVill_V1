const mongoose = require('mongoose');
const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const { indiaDate, HttpError } = require('../utils/validate');
const { ensureModelIndexes } = require('../utils/modelIndexes');

// One-off: turn every room-by-room property into a whole-villa listing with a
// single "Entire villa" unit. Past bookings and rooms are kept (old rooms are
// only deactivated). Future booked/blocked nights on old rooms are copied onto
// the new unit with the same kind and reference, so those dates stay closed and
// are released again if that booking is cancelled or the block removed.

const MAX_CAPACITY = 50;

async function planFor(property) {
  const rooms = await Room.find({ property: property._id }).lean();
  const active = rooms.filter(r => r.active !== false);
  const details = property.listingData?.details || {};
  const rate = Math.max(Number(property.price) || 0, ...active.map(r => r.baseRate || 0)) || 10000;
  const futureNights = rooms.length ? await RoomNight.countDocuments({ room: { $in: rooms.map(r => r._id) }, date: { $gte: indiaDate() }, kind: { $in: ['booking', 'block'] } }) : 0;
  if (active.length === 1 && rooms.length === 1) {
    return { action: 'reuse_single_unit', unit: active[0], capacity: active[0].capacity, rate, rooms: rooms.length, futureNights };
  }
  const capacity = Math.max(1, Number(details.guestCapacity) || 0, active.reduce((sum, r) => sum + (r.capacity || 0), 0));
  return { action: rooms.length ? 'merge_rooms_into_entire_unit' : 'create_entire_unit', capacity, rate, rooms: rooms.length, activeRooms: active.length, futureNights };
}

// Dry run: what would change, without writing anything.
async function planMigration() {
  const properties = await Property.find({ bookingMode: { $ne: 'ENTIRE' } }).select('_id name type location price status listingData').lean();
  const plan = [];
  for (const property of properties) plan.push({ _id: property._id, name: property.name, type: property.type, status: property.status, ...await planFor(property) });
  return plan.map(({ unit, ...row }) => row);
}

async function migrateProperty(property) {
  const plan = await planFor(property);
  if (plan.capacity > MAX_CAPACITY) throw new HttpError(400, `${property.name} has capacity ${plan.capacity}, above the supported ${MAX_CAPACITY} guests. Review its capacity before applying migration.`);
  if (plan.action === 'reuse_single_unit') {
    await Room.updateOne({ _id: plan.unit._id }, { $set: { baseRate: plan.rate } });
    await Property.updateOne({ _id: property._id }, { $set: { bookingMode: 'ENTIRE' } });
    return plan;
  }
  const rooms = await Room.find({ property: property._id }).select('_id number active').lean();
  const number = rooms.some(r => r.number === 'ENTIRE') ? `ENTIRE-${Date.now()}` : 'ENTIRE';
  const unit = await Room.create({ property: property._id, name: 'Entire villa', number, type: 'Entire villa', capacity: plan.capacity, baseRate: plan.rate });
  try {
    if (rooms.length) {
      const nights = await RoomNight.find({ room: { $in: rooms.map(r => r._id) }, date: { $gte: indiaDate() }, kind: { $in: ['booking', 'block'] } }).sort({ kind: 1 }).lean();
      const byDate = new Map();
      for (const night of nights) if (!byDate.has(night.date)) byDate.set(night.date, night); // one night per date on the single unit
      const operationId = new mongoose.Types.ObjectId();
      if (byDate.size) {
        await RoomNight.insertMany([...byDate.values()].map(night => ({
          property: property._id, room: unit._id, date: night.date, kind: night.kind, reference: night.reference, operationId,
          reason: night.reason || 'Carried over when this property became a whole-villa listing'
        })), { ordered: false });
      }
      await Room.updateMany({ _id: { $in: rooms.map(r => r._id) } }, { $set: { active: false } });
    }
    await Property.updateOne({ _id: property._id }, { $set: { bookingMode: 'ENTIRE', 'listingData.details.guestCapacity': plan.capacity } });
  } catch (err) {
    // Standalone MongoDB also needs retry-safe failure handling.
    await RoomNight.deleteMany({ room: unit._id });
    for (const old of rooms) await Room.updateOne({ _id: old._id }, { $set: { active: old.active !== false } });
    await Room.deleteOne({ _id: unit._id });
    throw err;
  }
  return plan;
}

async function applyMigration() {
  await Promise.all([ensureModelIndexes(Room), ensureModelIndexes(RoomNight)]);
  const properties = await Property.find({ bookingMode: { $ne: 'ENTIRE' } }).select('_id name type location price status listingData').lean();
  const done = [];
  for (const property of properties) done.push({ _id: property._id, name: property.name, ...await migrateProperty(property) });
  return done.map(({ unit, ...row }) => row);
}

module.exports = { planMigration, applyMigration };
