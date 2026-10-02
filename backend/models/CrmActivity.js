const mongoose = require('mongoose');

// Append-only sales timeline: conversation log entries (calls, WhatsApp,
// email) recorded by staff, plus system events such as status changes and
// quotation milestones. Entries are internal and are never sent to guests.
const MANUAL_TYPES = ['note', 'call', 'whatsapp', 'email', 'sms', 'meeting'];
const SYSTEM_TYPES = ['created', 'status_change', 'assignment', 'follow_up', 'quote_created', 'quote_sent', 'quote_viewed', 'quote_accepted', 'quote_rejected', 'quote_withdrawn', 'quote_expired', 'quote_converted', 'payment', 'system'];

const CrmActivitySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', default: null },
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  type: { type: String, enum: [...MANUAL_TYPES, ...SYSTEM_TYPES], required: true },
  direction: { type: String, enum: ['inbound', 'outbound', 'internal'], default: 'internal' },
  body: { type: String, default: '', maxlength: 2000 },
  meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  actorType: { type: String, enum: ['owner', 'guest', 'system'], default: 'owner' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

CrmActivitySchema.index({ owner: 1, inquiry: 1, createdAt: -1 });
CrmActivitySchema.index({ owner: 1, quotation: 1, createdAt: -1 });
CrmActivitySchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('CrmActivity', CrmActivitySchema);
module.exports.MANUAL_TYPES = MANUAL_TYPES;
