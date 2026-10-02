const mongoose = require('mongoose');
const RoomNight = require('../models/RoomNight');
const { HttpError } = require('../utils/validate');
const { ensureModelIndexes } = require('../utils/modelIndexes');

// Night-level inventory ledger shared by room blocks, room assignment and
// quotation holds. It never relies on multi-document transactions (the
// production database may be a standalone mongod); instead every write is
// all-or-nothing through the unique {room, date} index plus compensation.

const isDuplicate = err => err && (err.code === 11000 || (Array.isArray(err.writeErrors) && err.writeErrors.some(item => item.code === 11000)));

// Nights whose hold has lapsed are free even if the TTL monitor has not
// removed them yet.
const activeNightFilter = (now = new Date()) => ({ $or: [{ kind: { $ne: 'hold' } }, { expiresAt: { $gt: now } }] });

async function purgeExpiredHolds(roomId, dates) {
  const result = await RoomNight.deleteMany({ room: roomId, date: { $in: dates }, kind: 'hold', expiresAt: { $lte: new Date() } });
  return result.deletedCount || 0;
}

async function reserveNights(room, dates, kind, reference, { reason = '', expiresAt = null, conflictMessage } = {}) {
  const operationId = new mongoose.Types.ObjectId();
  const docs = dates.map(date => ({ property: room.property, room: room._id, date, kind, reference, operationId, reason, expiresAt: kind === 'hold' ? expiresAt : null }));
  // The unique {room, date} index must exist before any night is written.
  await ensureModelIndexes(RoomNight);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await RoomNight.insertMany(docs, { ordered: true });
      return operationId;
    } catch (err) {
      await RoomNight.deleteMany({ operationId });
      if (!isDuplicate(err)) throw err;
      // A lapsed hold may still be occupying the night: clear it and retry once.
      if (attempt === 1 && await purgeExpiredHolds(room._id, dates) > 0) continue;
      throw new HttpError(409, conflictMessage || 'Room is already blocked, reserved, or held by a quotation for one of these nights.');
    }
  }
  throw new HttpError(409, conflictMessage || 'Room is not available for these nights.');
}

// Nights in the range that are unavailable for `reference` (its own holds and
// bookings do not count against it).
async function conflictingNights(roomId, dates, ignoreReference = null) {
  const filter = { room: roomId, date: { $in: dates }, ...activeNightFilter() };
  if (ignoreReference) filter.reference = { $ne: ignoreReference };
  return RoomNight.find(filter).select('date kind').sort({ date: 1 }).lean();
}

async function releaseHolds(reference) {
  const result = await RoomNight.deleteMany({ kind: 'hold', reference });
  return result.deletedCount || 0;
}

async function activeHoldCount(reference) {
  return RoomNight.countDocuments({ kind: 'hold', reference, expiresAt: { $gt: new Date() } });
}

// Moves a quotation's live hold onto a booking, reserving any night whose hold
// has lapsed. On failure the ledger is restored to its previous state.
async function convertHoldToBooking(room, dates, holdReference, bookingId) {
  const now = new Date();
  const conversionOp = new mongoose.Types.ObjectId();
  const held = await RoomNight.find({ kind: 'hold', reference: holdReference, room: room._id, date: { $in: dates }, expiresAt: { $gt: now } }).select('date expiresAt').lean();
  const restoreExpiry = held.reduce((max, night) => (night.expiresAt > max ? night.expiresAt : max), now);
  if (held.length) {
    await RoomNight.updateMany(
      { kind: 'hold', reference: holdReference, room: room._id, date: { $in: held.map(night => night.date) }, expiresAt: { $gt: now } },
      { $set: { kind: 'booking', reference: bookingId, operationId: conversionOp, expiresAt: null } }
    );
  }
  const converted = await RoomNight.find({ kind: 'booking', reference: bookingId, operationId: conversionOp }).select('date').lean();
  const convertedDates = new Set(converted.map(night => night.date));
  const missing = dates.filter(date => !convertedDates.has(date));
  if (!missing.length) return { converted: converted.length, reserved: 0 };
  try {
    await reserveNights(room, missing, 'booking', bookingId, { conflictMessage: `${room.name || 'The room'} is no longer available on ${missing.join(', ')}.` });
    return { converted: converted.length, reserved: missing.length };
  } catch (err) {
    if (converted.length) {
      await RoomNight.updateMany({ kind: 'booking', reference: bookingId, operationId: conversionOp }, { $set: { kind: 'hold', reference: holdReference, expiresAt: restoreExpiry } });
    }
    throw err;
  }
}

async function releaseBookingNights(bookingId) {
  await RoomNight.deleteMany({ kind: 'booking', reference: bookingId });
}

module.exports = { isDuplicate, activeNightFilter, purgeExpiredHolds, reserveNights, conflictingNights, releaseHolds, activeHoldCount, convertHoldToBooking, releaseBookingNights };
