const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managementMode: { type: String, enum: ['SELF_MANAGED', 'BOOKMYVILLA_MANAGED'], default: 'SELF_MANAGED' },
  // ENTIRE: the whole property is one bookable unit (villas, cottages) — guests
  // book all of it, never room by room. ROOMS: each room/unit is booked separately.
  bookingMode: { type: String, enum: ['ENTIRE', 'ROOMS'], default: 'ROOMS' },
  // "Show on website" switch. Customers see a property only when it is
  // admin-approved AND this is on (see services/publicViews PUBLIC_LISTING).
  websiteVisible: { type: Boolean, default: true },
  // "Verified" blue tick for guests. BookMyVilla-managed villas are verified by
  // us automatically; self-managed owners request it and Admin reviews.
  verification: {
    status: { type: String, enum: ['none', 'requested', 'verified', 'rejected'], default: 'none' },
    note: { type: String, default: '', maxlength: 500 },
    requestedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 500 }
  },
  // Internal handover notes for the Villa Manager team; never public.
  handover: {
    type: new mongoose.Schema({
      keyLocation: { type: String, default: '', maxlength: 200 },
      caretakerName: { type: String, default: '', maxlength: 100 },
      caretakerPhone: { type: String, default: '', maxlength: 20 },
      notes: { type: String, default: '', maxlength: 1000 }
    }, { _id: false }),
    default: undefined,
    select: false
  },
  // Internal assignments are opt-in in authorized queries, never public data.
  assignedVillaManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  assignedDataEntryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, select: false },
  sourceApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerApplication', unique: true, sparse: true },
  name: { type: String, required: true },
  type: { type: String, default: 'Villa' },
  location: { type: String, required: true },
  price: { type: Number, default: 10000 },
  mapLink: { type: String, default: '' },
  amenities: [{ type: String }],
  facilities: [{ type: String }],
  photos: [{ type: String }],
  videos: [{ type: String }],
  // Listing content shares the existing property record. Staff drafts are
  // private until submitted into the existing admin approval workflow.
  listingData: { type: mongoose.Schema.Types.Mixed, default: {} },
  listingDraft: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  dataEntryStatus: { type: String, enum: ['ASSIGNED', 'DRAFT', 'IN_PROGRESS', 'INCOMPLETE', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED'], default: 'ASSIGNED', select: false },
  dataEntryReviewReason: { type: String, default: '', select: false },
  dataEntryRevision: { type: Number, default: 0, select: false },
  dataEntryCompletion: { type: Number, default: null, select: false },
  dataEntryUpdatedAt: { type: Date, default: null, select: false },
  assignedCaretaker: {
    name: String,
    phone: String,
    experience: String,
    role: String,
    govtIdStatus: { type: String, default: 'Verified' },
    assignedDate: { type: Date, default: Date.now }
  },
  // Optional stay-pass details the owner can fill so guests self-serve on
  // arrival instead of calling. Wi-Fi is only ever returned to a guest with a
  // confirmed booking (see the trip endpoint). Everything here is optional and
  // falls back to sensible defaults on the customer trip page.
  stayInfo: {
    checkInTime: { type: String, default: '', maxlength: 40 },
    checkOutTime: { type: String, default: '', maxlength: 40 },
    wifiName: { type: String, default: '', maxlength: 60 },
    wifiPassword: { type: String, default: '', maxlength: 60 },
    houseRules: { type: [String], default: [] },
    arrivalNotes: { type: String, default: '', maxlength: 1000 },
    foodInfo: { type: String, default: '', maxlength: 1000 }
  },
  // 'under_review' (changes requested) and 'suspended' (admin takedown) hide
  // the property from customers like 'pending'/'rejected' do — only 'approved'
  // is public — without deleting its bookings.
  status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'], default: 'approved' },
  createdAt: { type: Date, default: Date.now }
});

PropertySchema.index({ managementMode: 1, assignedVillaManager: 1 });
PropertySchema.index({ assignedDataEntryUser: 1 });
PropertySchema.index({ assignedDataEntryUser: 1, dataEntryStatus: 1, dataEntryUpdatedAt: -1 });

// A new property inherits its owner's management choice (set by the admin when
// the owner was created), however the property is created. An explicitly set
// managementMode is left alone.
PropertySchema.pre('validate', async function inheritOwnerManagement() {
  if (!this.isNew || !this.owner || !this.$isDefault('managementMode')) return;
  const User = mongoose.model('User');
  const owner = await User.findById(this.owner).select('role ownerManagementMode ownerVillaManager').lean();
  if (owner?.role !== 'owner' || owner.ownerManagementMode !== 'BOOKMYVILLA_MANAGED') return;
  this.managementMode = 'BOOKMYVILLA_MANAGED';
  if (!this.assignedVillaManager && owner.ownerVillaManager &&
      await User.exists({ _id: owner.ownerVillaManager, role: 'villa_manager', status: { $in: ['active', 'approved'] } })) {
    this.assignedVillaManager = owner.ownerVillaManager;
  }
});

module.exports = mongoose.model('Property', PropertySchema);
