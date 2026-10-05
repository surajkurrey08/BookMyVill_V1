// Queue ownership is resolved from Property on every read. Transfers never
// clone a booking/task or overwrite its historical actor attribution.
const Booking = require('../models/Booking');
const Request = require('../models/GuestRequest');
const Housekeeping = require('../models/HousekeepingTask');
const Task = require('../models/OperationalTask');
const { indiaDate, addDays } = require('../utils/validate');
const seriousIssue = { kind: 'issue', $or: [{ category: { $in: ['safety', 'billing'] } }, { escalated: true }] };
async function operationQueue(ids) {
  const p = { $in: ids }, today = new Date(`${indiaDate()}T00:00:00Z`), tomorrow = new Date(`${addDays(indiaDate(), 1)}T00:00:00Z`);
  const [bookings, requests, housekeeping, tasks] = await Promise.all([
    Booking.find({ property: p, stayStatus: { $ne: 'checked_out' }, $or: [{ createdAt: { $gte: new Date(Date.now() - 86400000) } }, { checkIn: { $gte: today, $lt: tomorrow } }, { stayStatus: 'in_house', checkOut: { $lt: tomorrow } }, { 'guestDetails.arrivalTime': { $ne: '' } }, { paymentStatus: 'pending' }] }).select('_id property room guest.name checkIn checkOut stayStatus status paymentStatus guestDetails.arrivalTime createdAt').populate('property', 'name').sort({ createdAt: -1 }).limit(100).lean(),
    Request.find({ property: p, status: { $in: Request.OPEN_STATUSES } }).select('_id property booking code kind category description status escalated').populate('property', 'name').sort({ createdAt: -1 }).limit(100).lean(),
    Housekeeping.find({ property: p, status: { $ne: 'done' } }).select('_id property room booking title stage dueDate').populate('property', 'name').sort({ dueDate: 1 }).limit(100).lean(),
    Task.find({ property: p, status: { $ne: 'verified' } }).select('_id property room booking title kind status dueDate').populate('property', 'name').sort({ dueDate: 1 }).limit(100).lean()
  ]);
  return { bookings, requests, housekeeping, tasks };
}
module.exports = { operationQueue, seriousIssue };
