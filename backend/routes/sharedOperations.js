const express = require('express');
const router = express.Router();
const Housekeeping = require('../models/HousekeepingTask');
const Task = require('../models/OperationalTask');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { CHECKLIST } = require('../services/roomReadiness');
const { requirePropertyAccess } = require('../services/propertyAccess');
const { staffId, roomId, text, photos, findScoped } = require('../services/operationInputs');
const { validDate, intInRange, HttpError, sendError } = require('../utils/validate');
router.use(require('../middleware/propertyOperatorAuth'));
const route = fn => async (req,res) => { try { await fn(req,res); } catch(err) { sendError(res,err,'Property operations'); } };
router.patch(['/housekeeping/:id', '/housekeeping-task/:id'], route(async (req, res) => {
  const task = await findScoped(Housekeeping, req, req.params.id);
  if (req.body.status !== undefined) throw new HttpError(409, 'Use Dirty ? Cleaning ? Inspection ? Ready, with all readiness checks.');
  const stage = req.body.stage || task.stage; const allowed = { dirty: ['dirty', 'cleaning'], cleaning: ['cleaning', 'inspection'], inspection: ['inspection', 'cleaning', 'ready'], ready: ['ready', 'dirty'] };
  if (!allowed[task.stage]?.includes(stage)) throw new HttpError(409, 'Follow Dirty → Cleaning → Inspection → Ready.');
  const checklist = req.body.checklist ?? task.checklist;
  if (!Array.isArray(checklist) || new Set(checklist).size !== checklist.length || checklist.some(c => !CHECKLIST.includes(c))) throw new HttpError(400, 'Choose valid readiness checks.');
  if (stage === 'ready' && checklist.length !== CHECKLIST.length) throw new HttpError(409, 'Complete all readiness checks before final inspection approval.');
  const set = { stage, status: stage === 'ready' ? 'done' : stage === 'dirty' ? 'open' : 'in_progress', completedAt: stage === 'ready' ? new Date() : null, checklist };
  if (req.body.assignedStaffId !== undefined) set.assignedStaff = await staffId(req.body.assignedStaffId, task.property);
  if (req.body.notes !== undefined) set.notes = text(req.body.notes, 500);
  if (req.body.photos !== undefined) set.photos = photos(req.body.photos);
  if (req.body.priority !== undefined) { if (!['normal', 'high'].includes(req.body.priority)) throw new HttpError(400, 'Invalid priority.'); set.priority = req.body.priority; }
  const updated = await Housekeeping.findOneAndUpdate({ _id: task._id, __v: task.__v }, { $set: set, $inc: { __v: 1 }, $push: { history: { from: task.stage, to: stage, by: req.user.id, at: new Date() } } }, { new: true });
  if (!updated) throw new HttpError(409, 'Readiness changed. Refresh and try again.');
  res.json(updated);
}));

router.post('/tasks', route(async (req, res) => {
  const property = await requirePropertyAccess(req.user, req.body.propertyId);
  const kind = req.body.kind;
  if (!['task', 'maintenance', 'damage', 'restock', 'stay_change'].includes(kind) || !validDate(req.body.dueDate) || !['normal', 'high'].includes(req.body.priority || 'normal')) throw new HttpError(400, 'Choose valid task type, deadline and priority.');
  const room = await roomId(req.body.roomId, property._id); const severity = req.body.severity || 'minor';
  if (!['minor', 'maintenance', 'out_of_order'].includes(severity) || (severity !== 'minor' && (kind !== 'maintenance' || !room))) throw new HttpError(400, 'Serious maintenance requires a room.');
  const amount = req.body.estimatedAmount === undefined || req.body.estimatedAmount === '' ? null : intInRange(req.body.estimatedAmount, 0, 100000000);
  if (req.body.estimatedAmount !== undefined && req.body.estimatedAmount !== '' && amount === null) throw new HttpError(400, 'Enter a valid damage estimate.');
  let booking = null;
  if (req.body.bookingId) { booking = await findScoped(Booking, req, req.body.bookingId); if (String(booking.property) !== String(property._id)) throw new HttpError(400, 'Booking belongs to a different property.'); }
  const task = await Task.create({ property: property._id, room, booking: booking?._id || null, kind, title: text(req.body.title, 120, true), category: text(req.body.category || 'other', 50), notes: text(req.body.notes, 1000), priority: req.body.priority || 'normal', assignedStaff: await staffId(req.body.assignedStaffId, property._id), dueDate: req.body.dueDate, severity, estimatedAmount: amount, photos: photos(req.body.photos || []), createdBy: req.user.id, history: [{ status: 'open', by: req.user.id }] });
  if (kind === 'maintenance' && severity !== 'minor') await Room.updateOne({ _id: room }, { $set: { operationalStatus: severity } });
  res.status(201).json(task);
}));
router.patch('/tasks/:id', route(async (req, res) => {
  const task = await findScoped(Task, req, req.params.id); const status = req.body.status || task.status;
  const allowed = { open: ['open', 'in_progress'], in_progress: ['in_progress', 'resolved'], resolved: ['resolved', 'in_progress', 'verified'], verified: ['verified'] };
  if (!allowed[task.status].includes(status)) throw new HttpError(409, 'Start work, resolve, then verify the task.');
  const changes = { status };
  if (req.body.assignedStaffId !== undefined) changes.assignedStaff = await staffId(req.body.assignedStaffId, task.property);
  if (req.body.notes !== undefined) changes.notes = text(req.body.notes, 1000);
  if (req.body.photos !== undefined) changes.photos = photos(req.body.photos);
  const updated = await Task.findOneAndUpdate({ _id: task._id, __v: task.__v }, { $set: changes, $inc: { __v: 1 }, $push: { history: { status, by: req.user.id, note: changes.notes || '' } } }, { new: true });
  if (!updated) throw new HttpError(409, 'Task changed. Refresh and try again.');
  if (task.kind === 'maintenance' && task.room && status === 'verified') {
    const remaining = await Task.find({ property: task.property, room: task.room, kind: 'maintenance', status: { $ne: 'verified' }, severity: { $ne: 'minor' } }).select('severity').lean();
    await Room.updateOne({ _id: task.room }, { $set: { operationalStatus: remaining.some(t => t.severity === 'out_of_order') ? 'out_of_order' : remaining.length ? 'maintenance' : 'ready' } });
  }
  res.json(updated);
}));


module.exports = router;
