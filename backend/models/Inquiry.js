const mongoose = require('mongoose');

const SOURCES = ['website', 'phone', 'whatsapp', 'instagram', 'facebook', 'walk_in', 'agent', 'ota', 'referral', 'email', 'other'];
const STATUSES = ['new', 'contacted', 'qualified', 'quotation_sent', 'follow_up', 'payment_pending', 'booked', 'lost'];
const LOST_REASONS = ['price', 'dates_unavailable', 'booked_elsewhere', 'no_response', 'plans_cancelled', 'requirements_not_met', 'other'];
// Pipeline depth used for the conversion funnel; follow_up sits beside
// quotation_sent and lost keeps whatever depth the lead had reached.
const STAGE_RANK = { new: 0, contacted: 1, qualified: 2, quotation_sent: 3, follow_up: 3, payment_pending: 4, booked: 5 };

const InquirySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, unique: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  guestName: { type: String, required: true, trim: true, maxlength: 100 },
  guestPhone: { type: String, default: '', maxlength: 20 },
  guestPhoneKey: { type: String, default: '' },
  guestEmail: { type: String, default: '', lowercase: true, maxlength: 120 },
  source: { type: String, enum: SOURCES, required: true },
  sourceDetail: { type: String, default: '', maxlength: 120 },
  status: { type: String, enum: STATUSES, default: 'new' },
  furthestStage: { type: Number, default: 0 },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  checkIn: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  checkOut: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  flexibleDates: { type: Boolean, default: false },
  adults: { type: Number, min: 0, max: 50, default: 2 },
  children: { type: Number, min: 0, max: 50, default: 0 },
  infants: { type: Number, min: 0, max: 20, default: 0 },
  pets: { type: Number, min: 0, max: 10, default: 0 },
  budgetMin: { type: Number, min: 0, default: null },
  budgetMax: { type: Number, min: 0, default: null },
  destination: { type: String, default: '', maxlength: 80 },
  requirements: { type: [String], default: [] },
  message: { type: String, default: '', maxlength: 2000 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', default: null },
  nextFollowUpAt: { type: Date, default: null },
  lostReason: { type: String, enum: [...LOST_REASONS, null], default: null },
  lostNote: { type: String, default: '', maxlength: 300 },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  marketingConsent: { type: Boolean, default: false },
  firstResponseAt: { type: Date, default: null },
  lastActivityAt: { type: Date, default: Date.now },
  // Bumped by every owner edit; clients send it back to detect concurrent edits.
  revision: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

InquirySchema.index({ owner: 1, status: 1, updatedAt: -1 });
InquirySchema.index({ owner: 1, createdAt: -1 });
InquirySchema.index({ owner: 1, nextFollowUpAt: 1 });
InquirySchema.index({ owner: 1, guestPhoneKey: 1 });

module.exports = mongoose.model('Inquiry', InquirySchema);
module.exports.SOURCES = SOURCES;
module.exports.STATUSES = STATUSES;
module.exports.LOST_REASONS = LOST_REASONS;
module.exports.STAGE_RANK = STAGE_RANK;
