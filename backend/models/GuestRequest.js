const mongoose = require('mongoose');

// A request or issue raised by a guest during (or just after) their stay.
// `request` = a service ask (towels, food, taxi…); `issue` = something wrong
// (AC, cleaning, noise…) which is treated as higher priority. Both surface in
// the owner's Guest Operations so the caretaker/owner can action them, and the
// status flows back to the guest's trip page.
const KINDS = ['request', 'issue'];
const REQUEST_CATEGORIES = ['housekeeping', 'towels', 'water', 'food', 'extra_bed', 'taxi', 'amenities', 'checkout_help', 'maintenance', 'extra_guests', 'early_checkin', 'late_checkout', 'extend_stay', 'room_change', 'other'];
const ISSUE_CATEGORIES = ['cleaning', 'ac', 'water', 'wifi', 'food', 'noise', 'pool', 'staff', 'billing', 'safety', 'maintenance', 'other'];
const STATUSES = ['open', 'acknowledged', 'in_progress', 'completed', 'declined', 'cancelled'];
const OPEN_STATUSES = ['open', 'acknowledged', 'in_progress'];

const GuestRequestSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestName: { type: String, default: '', maxlength: 100 },
  kind: { type: String, enum: KINDS, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  photos: { type: [String], default: [] },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  escalated: { type: Boolean, default: false },
  status: { type: String, enum: STATUSES, default: 'open' },
  eta: { type: String, default: '', maxlength: 80 },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', default: null },
  // Visible status updates, newest handled on the trip page. `note` is shown to
  // the guest; keep internal remarks out of it.
  updates: [{
    status: { type: String, enum: STATUSES },
    note: { type: String, default: '', maxlength: 500 },
    byRole: { type: String, enum: ['guest', 'owner', 'villa_manager', 'system'], default: 'owner' },
    at: { type: Date, default: Date.now }
  }],
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

GuestRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
GuestRequestSchema.index({ property: 1, status: 1 });
GuestRequestSchema.index({ booking: 1, createdAt: -1 });

module.exports = mongoose.model('GuestRequest', GuestRequestSchema);
module.exports.KINDS = KINDS;
module.exports.REQUEST_CATEGORIES = REQUEST_CATEGORIES;
module.exports.ISSUE_CATEGORIES = ISSUE_CATEGORIES;
module.exports.STATUSES = STATUSES;
module.exports.OPEN_STATUSES = OPEN_STATUSES;
