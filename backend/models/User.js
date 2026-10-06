const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Optional + sparse: lets phone-only guest accounts (no email given at
  // registration) coexist with email-based accounts without violating the
  // unique index (sparse index only enforces uniqueness among documents
  // that actually have the field set).
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'owner', 'admin', 'data_entry', 'villa_manager'], default: 'user' },
  // 'suspended' locks the account (accountAuth denies it); 'restricted' is a
  // soft flag the admin can set without locking sign-in.
  status: { type: String, enum: ['approved', 'rejected', 'pending', 'active', 'suspended', 'restricted'], default: 'active' },
  // Admin-console RBAC (only meaningful when role === 'admin'). A legacy admin
  // with no adminRole is treated as super_admin for backward compatibility.
  adminRole: { type: String, enum: ['super_admin', 'operations', 'finance', 'support', 'risk', 'content', 'read_only', null], default: null },
  adminPermissions: { type: [String], default: [] },
  statusReason: { type: String, default: '' },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  resetOtp: { type: String, default: null },
  resetOtpExpires: { type: Date, default: null },
  ownerSetupTokenHash: { type: String, default: null, select: false },
  ownerSetupExpiresAt: { type: Date, default: null, select: false },
  ownerPasswordSetAt: { type: Date, default: null },
  // Set when Admin issues an Owner panel setup link for an owner who has no
  // partner application (e.g. added by Data Entry); lets /owner-setup proceed.
  ownerAccessApprovedAt: { type: Date, default: null },
  // Owners only, chosen by the admin when creating the owner: whether the
  // owner runs their properties themselves or BookMyVilla runs them from the
  // Villa Manager panel. New properties inherit this (see models/Property.js).
  ownerManagementMode: { type: String, enum: ['SELF_MANAGED', 'BOOKMYVILLA_MANAGED'], default: undefined },
  ownerVillaManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },
  // Contact details for owners added by the Villa Manager team (BookMyVilla-
  // managed owners don't sign in; the team contacts them directly).
  ownerProfile: {
    type: new mongoose.Schema({
      whatsapp: { type: String, default: '', maxlength: 20 },
      address: { type: String, default: '', maxlength: 300 },
      alternateName: { type: String, default: '', maxlength: 100 },
      alternatePhone: { type: String, default: '', maxlength: 20 },
      notes: { type: String, default: '', maxlength: 1000 }
    }, { _id: false }),
    default: undefined
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', UserSchema);
