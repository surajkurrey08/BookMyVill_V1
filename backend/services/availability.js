const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { unavailableRooms } = require('./roomReadiness');
const { activeNightFilter } = require('./inventory');
const holdLocks = require('./holdLocks');
const { indiaDate } = require('../utils/validate');
async function calendar(property, dates) {
  const [rooms, ledger, readiness, inHouse, listing] = await Promise.all([
    Room.find({ property }).sort({ number: 1 }).lean(),
    RoomNight.find({ property, date: { $in: dates }, ...activeNightFilter() }).select('room date kind reference reason').lean(),
    unavailableRooms(property), Booking.find({ property, status: 'confirmed', stayStatus: 'in_house' }).select('room').lean(),
    Property.findById(property).select('bookingMode').lean()
  ]);
  // Checkout holds live in Redis (services/holdLocks), not in the ledger.
  const held = await holdLocks.heldDates([String(property), ...rooms.map(r => holdLocks.scopeFor(property, r._id, false))], dates);
  const occupied = new Set(inHouse.map(b => String(b.room)));
  const nights = new Map(ledger.map(n => [`${n.room}:${n.date}`, n]));
  const villaNights = new Map(ledger.map(n => [n.date, n]));
  return { dates, rooms: rooms.map(r => ({ ...r, days: dates.map(date => {
    const wholeVilla = listing?.bookingMode === 'ENTIRE' && r.active !== false;
    const night = nights.get(`${r._id}:${date}`) || (wholeVilla ? villaNights.get(date) : null)
      || ((held.get(holdLocks.scopeFor(property, r._id, false))?.has(date) || (wholeVilla && held.get(String(property))?.has(date))) ? { kind: 'hold' } : null);
    return { date, status: readiness.get(String(r._id)) || (date === indiaDate() && (occupied.has(String(r._id)) || (wholeVilla && inHouse.length > 0)) ? 'in_house' : night ? { block: 'blocked', booking: 'booked', hold: 'temporary_hold' }[night.kind] : 'available'), blockReference: night?.kind === 'block' ? night.reference : null, reason: night?.reason || '' };
  }) })) };
}
module.exports = { calendar };
