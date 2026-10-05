const mongoose = require('mongoose');

// Short-lived OTP record used for mobile-number sign-up and OTP login. Kept as
// its own collection (rather than fields on User) because at sign-up OTP
// time there is no User document yet.
const PhoneOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['register', 'login'], default: 'register' },
  attempts: { type: Number, default: 0 }, // wrong guesses against this code
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PhoneOtp', PhoneOtpSchema);
