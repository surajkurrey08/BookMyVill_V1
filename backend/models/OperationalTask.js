const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  archived: { type: Boolean, default: false },
  kind: { type: String, enum: ['task', 'maintenance', 'damage', 'restock', 'stay_change'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  category: { type: String, default: 'other', maxlength: 50 },
  notes: { type: String, default: '', maxlength: 1000 },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', default: null },
  dueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  photos: { type: [String], default: [] },
  estimatedAmount: { type: Number, min: 0, default: null },
  severity: { type: String, enum: ['minor', 'maintenance', 'out_of_order'], default: 'minor' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'verified'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  history: [{ status: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, note: String }]
}, { timestamps: true });
schema.index({ property: 1, kind: 1, status: 1, dueDate: 1 });
module.exports = mongoose.model('OperationalTask', schema);
