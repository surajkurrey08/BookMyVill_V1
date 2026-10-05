const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const { HttpError } = require('../utils/validate');
const CHECKLIST = ['Bedroom', 'Bathroom', 'Linen', 'Towels', 'Kitchen', 'Floor', 'Amenities', 'Pool', 'Damage check'];
async function unavailableRooms(property) {
  const [rooms, tasks] = await Promise.all([
    Room.find({ property, $or: [{ active: false }, { operationalStatus: { $in: ['maintenance', 'out_of_order'] } }] }).select('_id active operationalStatus').lean(),
    HousekeepingTask.find({ property, category: { $in: ['turnover', 'cleaning', 'inspection'] }, status: { $ne: 'done' } }).select('room stage').lean()
  ]);
  return new Map([...tasks.map(t => [String(t.room), t.stage === 'inspection' ? 'inspection' : t.stage === 'cleaning' ? 'cleaning' : 'dirty']), ...rooms.map(r => [String(r._id), r.active === false ? 'out_of_order' : r.operationalStatus])]);
}
async function requireRoomReady(roomId) {
  const room = await Room.findById(roomId);
  if (!room || !room.active || ['maintenance', 'out_of_order'].includes(room.operationalStatus)) throw new HttpError(409, 'Room is under maintenance or out of order.');
  const unavailable = await unavailableRooms(room.property);
  if (unavailable.has(String(room._id))) throw new HttpError(409, 'Complete cleaning and final inspection before using this room.');
  return room;
}
module.exports = { CHECKLIST, unavailableRooms, requireRoomReady };
