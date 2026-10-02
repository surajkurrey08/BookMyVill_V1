const mongoose = require('mongoose');

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'withdrawn', 'converted'];
const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict', 'non_refundable', 'custom'];
const TAX_MODES = ['none', 'gst_hotel', 'custom'];

const AddOnLineSchema = new mongoose.Schema({
  addOn: { type: mongoose.Schema.Types.ObjectId, ref: 'AddOn', required: true },
  name: { type: String, required: true },
  category: String,
  pricingUnit: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  tax: { type: Number, default: 0 }
}, { _id: false });

const FeeLineSchema = new mongoose.Schema({
  label: { type: String, required: true, maxlength: 80 },
  amount: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  tax: { type: Number, default: 0 }
}, { _id: false });

// A priced offer for one accommodation unit (a room, or a whole villa set up
// as a single unit). Only drafts are editable: what a guest was sent is kept
// exactly as sent, and changes are made through a new revision.
const QuotationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, unique: true },
  publicToken: { type: String, required: true, unique: true, select: false },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  roomSnapshot: { name: String, number: String, type: { type: String }, capacity: Number },
  inquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', default: null },
  guest: {
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, default: '', maxlength: 20 },
    email: { type: String, default: '', maxlength: 120 }
  },
  guestPhoneKey: { type: String, default: '' },
  checkIn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  checkOut: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  nights: { type: Number, required: true, min: 1 },
  adults: { type: Number, min: 0, max: 50, default: 2 },
  children: { type: Number, min: 0, max: 50, default: 0 },
  infants: { type: Number, min: 0, max: 20, default: 0 },
  pets: { type: Number, min: 0, max: 10, default: 0 },
  nightlyRate: { type: Number, required: true, min: 0 },
  baseNightlyRate: { type: Number, required: true, min: 0 },
  addOns: { type: [AddOnLineSchema], default: [] },
  fees: { type: [FeeLineSchema], default: [] },
  promotion: {
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
    code: { type: String, default: '' },
    name: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 }
  },
  manualDiscount: {
    amount: { type: Number, default: 0 },
    reason: { type: String, default: '', maxlength: 120 }
  },
  taxMode: { type: String, enum: TAX_MODES, default: 'none' },
  customTaxRate: { type: Number, min: 0, max: 28, default: 0 },
  accommodationTaxRate: { type: Number, default: 0 },
  totals: {
    accommodation: { type: Number, default: 0 },
    addOns: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxable: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  securityDeposit: { type: Number, min: 0, default: 0 },
  advancePercent: { type: Number, min: 0, max: 100, default: 100 },
  balanceDueDaysBeforeCheckIn: { type: Number, min: 0, max: 60, default: 0 },
  schedule: {
    advanceAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    balanceDueDate: { type: String, default: null }
  },
  cancellationPolicy: { type: String, enum: CANCELLATION_POLICIES, default: 'moderate' },
  cancellationText: { type: String, default: '', maxlength: 1200 },
  notesToGuest: { type: String, default: '', maxlength: 1000 },
  internalNotes: { type: String, default: '', maxlength: 1000 },
  validityMinutes: { type: Number, min: 15, max: 20160, default: 1440 },
  validUntil: { type: Date, default: null },
  holdInventory: { type: Boolean, default: false },
  status: { type: String, enum: STATUSES, default: 'draft' },
  sentAt: { type: Date, default: null },
  sentVia: { type: [String], default: [] },
  firstViewedAt: { type: Date, default: null },
  lastViewedAt: { type: Date, default: null },
  viewCount: { type: Number, default: 0 },
  acceptedAt: { type: Date, default: null },
  acceptedName: { type: String, default: '', maxlength: 100 },
  rejectedAt: { type: Date, default: null },
  rejectReason: { type: String, default: '', maxlength: 300 },
  withdrawnAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
  convertedAt: { type: Date, default: null },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  paymentOrders: [{
    orderId: String,
    amount: Number,
    createdAt: { type: Date, default: Date.now }
  }],
  // Short-lived lock taken while converting so two conversions (owner click and
  // guest payment) can never both create a booking.
  lockedUntil: { type: Date, default: null },
  revisionOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

QuotationSchema.index({ owner: 1, status: 1, createdAt: -1 });
QuotationSchema.index({ owner: 1, inquiry: 1 });
QuotationSchema.index({ status: 1, validUntil: 1 });
QuotationSchema.index({ 'paymentOrders.orderId': 1 }, { sparse: true });

module.exports = mongoose.model('Quotation', QuotationSchema);
module.exports.STATUSES = STATUSES;
module.exports.CANCELLATION_POLICIES = CANCELLATION_POLICIES;
module.exports.TAX_MODES = TAX_MODES;
