const mongoose = require('mongoose');

const HousekeepingTaskSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, enum: ['turnover', 'cleaning', 'inspection', 'maintenance'], required: true },
  dueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['open', 'in_progress', 'done'], default: 'open' },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', default: null },
  notes: { type: String, default: '', maxlength: 500 },
  dedupeKey: { type: String, unique: true, sparse: true },
  completedAt: { type: Date, default: null },
  stage: { type: String, enum: ['dirty', 'cleaning', 'inspection', 'ready'], default: 'dirty' },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  checklist: { type: [String], default: [] },
  photos: { type: [String], default: [] },
  history: [{ from: String, to: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now }
});

HousekeepingTaskSchema.index({ property: 1, dueDate: 1, status: 1 });
module.exports = mongoose.model('HousekeepingTask', HousekeepingTaskSchema);
