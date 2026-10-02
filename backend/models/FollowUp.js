const mongoose = require('mongoose');

const CHANNELS = ['call', 'whatsapp', 'email', 'sms', 'visit', 'other'];

const FollowUpSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', required: true },
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  dueAt: { type: Date, required: true },
  channel: { type: String, enum: CHANNELS, default: 'call' },
  note: { type: String, default: '', maxlength: 300 },
  status: { type: String, enum: ['pending', 'done', 'cancelled'], default: 'pending' },
  outcome: { type: String, default: '', maxlength: 300 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

FollowUpSchema.index({ owner: 1, status: 1, dueAt: 1 });
FollowUpSchema.index({ inquiry: 1, status: 1, dueAt: 1 });

module.exports = mongoose.model('FollowUp', FollowUpSchema);
module.exports.CHANNELS = CHANNELS;
