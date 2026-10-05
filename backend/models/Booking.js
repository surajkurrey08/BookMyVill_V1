const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['accommodation', 'addon', 'fee', 'discount'], required: true },
  label: { type: String, required: true, maxlength: 140 },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  tax: { type: Number, default: 0 }
}, { _id: false });

const BookingSchema = new mongoose.Schema({
  paymentVerification: { type: Date, select: false },
  // Guest account, when the guest booked while signed in. Bookings converted
  // from an owner quotation may have no account; `guest` then identifies them.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  guest: {
    name: { type: String, maxlength: 100 },
    phone: { type: String, maxlength: 20 },
    phoneKey: { type: String, maxlength: 20 },
    email: { type: String, maxlength: 120 }
  },
  guestDetails: {
    arrivalTime: { type: String, default: '', maxlength: 40 },
    idType: { type: String, default: '', maxlength: 40 },
    idLastFour: { type: String, default: '', maxlength: 4 },
    specialRequests: { type: String, default: '', maxlength: 500 },
    additionalGuests: { type: [String], default: [] },
    idProof: { type: String, default: '', maxlength: 2000000 }
  },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  source: { type: String, enum: ['website', 'quotation', 'walk_in', 'phone', 'whatsapp', 'agent', 'ota', 'other'], default: 'website' },
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  inquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', default: null },
  adults: { type: Number, min: 0, max: 50, default: null },
  children: { type: Number, min: 0, max: 50, default: null },
  infants: { type: Number, min: 0, max: 20, default: null },
  pets: { type: Number, min: 0, max: 10, default: null },
  lineItems: { type: [LineItemSchema], default: undefined },
  taxAmount: { type: Number, default: null },
  discountAmount: { type: Number, default: null },
  securityDepositAmount: { type: Number, default: 0 },
  cancellationPolicy: { type: String, default: '', maxlength: 1200 },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  stayType: { type: String, enum: ['night', 'day'], default: 'night' },
  guests: { type: Number, min: 1, max: 50, default: 1 },
  stayStatus: { type: String, enum: ['expected', 'in_house', 'checked_out'], default: 'expected' },
  actualCheckIn: { type: Date, default: null },
  actualCheckOut: { type: Date, default: null },
  operations: {
    actualGuests: { type: Number, min: 1, max: 50 },
    idVerified: { type: Boolean, default: false },
    depositVerified: { type: Boolean, default: false },
    internalNote: { type: String, default: '', maxlength: 500 },
    extraGuestAmount: { type: Number, min: 0, default: 0 },
    extraGuestPaymentStatus: { type: String, enum: ['not_required', 'quote_required', 'pending', 'paid'], default: 'not_required' }
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paidAt: { type: Date, default: null },
  paymentSource: { type: String, enum: ['razorpay', 'manual'], default: null },
  paymentMode: { type: String, enum: ['test', 'live', 'manual'], default: null },
  manualPaymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'upi'], default: null },
  manualPaymentReference: { type: String, default: '' },
  manualPaymentRecordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  refundStatus: {
    type: String,
    enum: ['none', 'initiated', 'processed', 'failed'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  actionHistory: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    targetUser: { type: String, required: true },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// A room cannot have two simultaneous in-house stays, even under racing check-ins.
BookingSchema.index({ room:1 }, { unique:true, partialFilterExpression:{ stayStatus:'in_house', room:{ $type:'objectId' } } });
module.exports = mongoose.model('Booking', BookingSchema);
