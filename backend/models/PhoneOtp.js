const mongoose = require('mongoose');

// Short-lived OTP record used for the mobile-number sign-up flow. Kept as
// its own collection (rather than fields on User) because at OTP-request
// time there is no User document yet.
const PhoneOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['register'], default: 'register' },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PhoneOtp', PhoneOtpSchema);
