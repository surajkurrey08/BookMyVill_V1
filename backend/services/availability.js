const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const { unavailableRooms } = require('./roomReadiness');
const { activeNightFilter } = require('./inventory');
const { indiaDate } = require('../utils/validate');
async function calendar(property, dates) {
  const [rooms, ledger, readiness, inHouse] = await Promise.all([
    Room.find({ property }).sort({ number: 1 }).lean(),
    RoomNight.find({ property, date: { $in: dates }, ...activeNightFilter() }).select('room date kind reference reason').lean(),
    unavailableRooms(property), Booking.find({ property, status: 'confirmed', stayStatus: 'in_house' }).select('room').lean()
  ]);
  const occupied = new Set(inHouse.map(b => String(b.room)));
  const nights = new Map(ledger.map(n => [`${n.room}:${n.date}`, n]));
  return { dates, rooms: rooms.map(r => ({ ...r, days: dates.map(date => {
    const night = nights.get(`${r._id}:${date}`);
    return { date, status: readiness.get(String(r._id)) || (date === indiaDate() && occupied.has(String(r._id)) ? 'in_house' : night ? { block: 'blocked', booking: 'booked', hold: 'temporary_hold' }[night.kind] : 'available'), blockReference: night?.kind === 'block' ? night.reference : null, reason: night?.reason || '' };
  }) })) };
}
module.exports = { calendar };
