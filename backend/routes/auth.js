const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const PartnerApplication = require('../models/PartnerApplication');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body || {};

    if (!name || /\d/.test(name.trim()) || !/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
      return res.status(400).json({ msg: 'Full name cannot contain numbers. Please enter alphabetic letters only.' });
    }
    if (role && role !== 'user') {
      return res.status(403).json({ msg: 'Owner accounts require an admin-issued setup link.' });
    }
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ msg: 'Email and a password of at least 8 characters are required.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    if (await User.exists({ email: cleanEmail }) || await PartnerApplication.exists({ email: cleanEmail })) {
      return res.status(409).json({ msg: 'This email already has an account or owner application. Sign in, or ask the admin for an owner setup link.' });
    }

    const user = new User({ name, email: cleanEmail, phone: phone || '', password, role: 'user' });
    await user.save();

    const secret = process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
    console.log('Token generated successfully');
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('--- REGISTRATION CRASH ---');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Stack Trace:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Complete an approved owner's one-time setup link and choose a private password.
router.post('/owner-setup', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
        typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password) > 72 ||
        password !== confirmPassword) {
      return res.status(400).json({ msg: 'Enter a valid setup link and matching password (10–72 bytes).' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const owner = await User.findOne({
      ownerSetupTokenHash: tokenHash,
      ownerSetupExpiresAt: { $gt: now },
      role: 'owner'
    }).select('+ownerSetupTokenHash +ownerSetupExpiresAt');
    if (!owner) return res.status(400).json({ msg: 'Setup link is invalid or expired. Ask the admin for a new link.' });
    if (owner.ownerManagementMode === 'BOOKMYVILLA_MANAGED' || ['pending', 'rejected', 'suspended'].includes(owner.status)) return res.status(403).json({ msg: 'Owner panel access is not enabled for this account. Contact Admin.' });

    const approved = owner.ownerAccessApprovedAt || await PartnerApplication.exists({ email: owner.email, status: 'approved' });
    if (!approved) return res.status(403).json({ msg: 'Property owner application is not approved.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await User.findOneAndUpdate(
      { _id: owner._id, ownerSetupTokenHash: tokenHash, ownerSetupExpiresAt: { $gt: new Date() } },
      {
        $set: { password: passwordHash, ownerPasswordSetAt: new Date() },
        $unset: { ownerSetupTokenHash: 1, ownerSetupExpiresAt: 1 }
      },
      { new: true }
    );
    if (!updated) return res.status(400).json({ msg: 'Setup link is invalid or expired. Ask the admin for a new link.' });
    res.json({ msg: 'Password set. Sign in with your application email.', email: updated.email });
  } catch (err) {
    console.error('Owner password setup error:', err);
    res.status(500).json({ msg: 'Could not set owner password.' });
  }
});

// Use audited Admin account actions for account removal.
router.delete('/user/:id', (req,res) => res.status(403).json({ msg: 'Use authorized Admin account actions.' }));

// Login
router.post('/login', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Login is temporarily unavailable. Please try again.' });
  }
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide both email address and password.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid email address or password.' });
    }

    let isMatch = false;
    try {
      if (user.password) {
        isMatch = await bcrypt.compare(password, user.password);
      }
    } catch (bErr) {
      isMatch = false;
    }

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid email address or password.' });
    }

    if (['pending','rejected','suspended'].includes(user.status)) return res.status(403).json({ msg: 'This account is not active. Contact Admin.' });
    if (user.role === 'owner' && user.ownerManagementMode === 'BOOKMYVILLA_MANAGED') return res.status(403).json({ msg: 'BookMyVilla manages your villas through the Villa Manager panel. Owner login is not enabled.' });

    // Block property owner login if property has not been accepted/approved by Admin
    if (user.role === 'owner' && !user.ownerAccessApprovedAt) {
      try {
        const PartnerApplication = require('../models/PartnerApplication');
        const cleanUserEmail = (user.email || '').toLowerCase().trim();
        const partnerApps = await PartnerApplication.find({ 
          email: { $regex: new RegExp('^' + cleanUserEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
        }).sort({ appliedAt: -1 });

        if (partnerApps && partnerApps.length > 0) {
          const hasApproved = partnerApps.some(app => app.status === 'approved');
          if (!hasApproved) {
            const latestStatus = partnerApps[0].status;
            return res.status(403).json({
              msg: `Property Owner login blocked: Your property application is currently '${latestStatus}'. You can log in once the admin accepts your property listing.`
            });
          }
        }
      } catch (partnerErr) {
        console.error('Partner application lookup notice:', partnerErr.message);
      }
    }

    const secret = process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ msg: 'Server error during authentication: ' + err.message, error: err.message });
  }
});

// GET Login info fallback (prevents Cannot GET /api/auth/login)
router.get('/login', (req, res) => {
  res.json({ msg: 'Authentication endpoint active. Submit a POST request with email and password to log in.' });
});

// Step 1: Request 6-Digit OTP for Secure Password Reset
router.post('/request-otp', async (req, res) => {
  if (process.env.NODE_ENV !== 'test' && !(process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_OTP === 'true')) return res.status(503).json({ msg: 'OTP delivery is not configured. Use password sign in or contact Admin.' });
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ msg: 'Please provide your registered email address.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
    });

    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email address. Please check your email or register.' });
    }
    if (user.role !== 'user') {
      return res.status(403).json({ msg: 'Ask the admin for a password setup link for this account.' });
    }

    // Generate secure 6-digit OTP code
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    user.resetOtp = generatedOtp;
    user.resetOtpExpires = expiryTime;
    await user.save();

    console.log(`🔑 [SECURITY OTP GENERATED] For ${cleanEmail}: OTP is [ ${generatedOtp} ] (Expires in 15 mins)`);

    res.json({
      success: true,
      msg: `Verification OTP generated for ${cleanEmail}! Use OTP: ${generatedOtp}`,
      otp: generatedOtp
    });
  } catch (err) {
    console.error('Error generating reset OTP:', err);
    res.status(500).json({ msg: 'Server error generating verification code.', error: err.message });
  }
});

// Step 2: Verify 6-Digit OTP & Reset Password Securely
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, otpCode, newPassword, confirmPassword } = req.body;
    if (!email || !otpCode || !newPassword) {
      return res.status(400).json({ msg: 'Please enter your email, 6-digit verification code, and new password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ msg: 'New password and confirmation password do not match.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
    });

    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email address.' });
    }
    if (user.role !== 'user') {
      return res.status(403).json({ msg: 'Ask the admin for a password setup link for this account.' });
    }

    // Verify OTP code security & Expiry
    if (!user.resetOtp || user.resetOtp.trim() !== otpCode.trim()) {
      return res.status(400).json({ msg: 'Invalid verification OTP code. Please check the code or request a new one.' });
    }

    if (!user.resetOtpExpires || new Date() > new Date(user.resetOtpExpires)) {
      return res.status(400).json({ msg: 'Verification OTP code has expired. Please click "Resend Code".' });
    }

    // OTP Verified! Update user password and clear OTP
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    console.log(`✅ [SECURE PASSWORD RESET SUCCESSFUL] For user: ${cleanEmail}`);
    res.json({ success: true, msg: 'Password verified & reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ msg: 'Server error while resetting password.', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Mobile number (OTP) login/registration — Guest/Traveler quick sign-up.
// NOTE: OTP delivery is dev-mode only for now (no SMS gateway configured):
// the generated code is returned in the API response / logged to the
// server console instead of being sent as a real text message.
// ---------------------------------------------------------------------------

const PhoneOtp = require('../models/PhoneOtp');

const cleanPhoneNumber = (phone) => (phone || '').toString().replace(/\D/g, '').slice(-10);
const isValidIndianMobile = (phone) => /^[6-9]\d{9}$/.test(phone);

const INACTIVE_STATUSES = ['pending', 'rejected', 'suspended'];
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// Checks a submitted OTP. Wrong guesses are counted on the record so a code
// can't be brute-forced; after MAX_OTP_ATTEMPTS a new OTP must be requested.
const checkPhoneOtp = async (phone, purpose, otp) => {
  const record = await PhoneOtp.findOne({ phone, purpose });
  if (!record) return { error: 'Please request an OTP first.' };
  if (new Date() > new Date(record.expiresAt)) return { error: 'OTP has expired. Please request a new one.' };
  if (record.attempts >= MAX_OTP_ATTEMPTS) return { error: 'Too many wrong attempts. Please request a new OTP.' };
  if (record.otp !== (otp || '').toString().trim()) {
    record.attempts += 1;
    await record.save();
    return { error: 'Invalid OTP. Please check the code and try again.' };
  }
  return { record };
};

const signGuestToken = (user) => {
  const secret = process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026';
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
};

const guestPayload = (user) => ({ id: user._id, name: user.name, email: user.email || '', phone: user.phone, role: user.role });

// Step 1: Request a 6-digit OTP — `purpose: 'register'` (default) for a new
// number, `purpose: 'login'` for an existing account signing in without a password.
router.post('/phone/send-otp', async (req, res) => {
  // TEMPORARY (owner-requested for live testing): demo OTP is controlled only by
  // ALLOW_DEMO_OTP, including in production. Remove before real users sign up.
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_DEMO_OTP !== 'true') return res.status(503).json({ msg: 'OTP delivery is not configured. Use password sign in or contact Admin.' });
  try {
    const cleanPhone = cleanPhoneNumber(req.body.phone);
    const purpose = req.body.purpose === 'login' ? 'login' : 'register';
    if (!isValidIndianMobile(cleanPhone)) {
      return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number.' });
    }

    const existingUser = await User.findOne({ phone: cleanPhone });
    if (purpose === 'register' && existingUser) {
      return res.status(409).json({ msg: 'This mobile number is already registered. Please log in instead.' });
    }
    if (purpose === 'login' && !existingUser) {
      return res.status(404).json({ msg: 'No account found with this mobile number. Please create one first.' });
    }

    const previous = await PhoneOtp.findOne({ phone: cleanPhone, purpose });
    if (previous && Date.now() - new Date(previous.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ msg: 'Please wait a few seconds before requesting another OTP.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await PhoneOtp.findOneAndUpdate(
      { phone: cleanPhone, purpose },
      { otp, expiresAt, attempts: 0, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`🔑 [DEV OTP] ${purpose === 'login' ? 'Login' : 'Registration'} OTP for +91${cleanPhone}: [ ${otp} ] (expires in 10 mins)`);

    res.json({
      success: true,
      msg: `Dev Mode: SMS gateway is not configured yet, so here is your OTP directly — ${otp}`,
      otp, // returned only because no real SMS provider is wired up yet
      phone: cleanPhone
    });
  } catch (err) {
    console.error('Error generating phone OTP:', err);
    res.status(500).json({ msg: 'Server error generating OTP. Please try again.' });
  }
});

// Step 2 (sign-up): check the OTP before the guest is asked to create a
// password. The code isn't used up here — /phone/register checks it again.
router.post('/phone/verify-otp', async (req, res) => {
  try {
    const cleanPhone = cleanPhoneNumber(req.body.phone);
    if (!isValidIndianMobile(cleanPhone)) {
      return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!req.body.otp) {
      return res.status(400).json({ msg: 'Please enter the OTP sent to your mobile number.' });
    }
    const { error } = await checkPhoneOtp(cleanPhone, 'register', req.body.otp);
    if (error) return res.status(400).json({ msg: error });
    res.json({ verified: true });
  } catch (err) {
    console.error('Phone OTP verify error:', err);
    res.status(500).json({ msg: 'Server error verifying OTP. Please try again.' });
  }
});

// Step 3 (sign-up): verify OTP + create the new guest/traveler account
router.post('/phone/register', async (req, res) => {
  try {
    const { otp, name, password, email } = req.body;
    const cleanPhone = cleanPhoneNumber(req.body.phone);

    if (!isValidIndianMobile(cleanPhone)) {
      return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!name || /\d/.test(name.trim()) || !/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
      return res.status(400).json({ msg: 'Full name cannot contain numbers. Please enter alphabetic letters only.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }
    if (!otp) {
      return res.status(400).json({ msg: 'Please enter the OTP sent to your mobile number.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ msg: 'Please enter a valid email address, or leave it blank.' });
    }

    const { record: otpRecord, error: otpError } = await checkPhoneOtp(cleanPhone, 'register', otp);
    if (otpError) {
      return res.status(400).json({ msg: otpError });
    }

    const existingPhoneUser = await User.findOne({ phone: cleanPhone });
    if (existingPhoneUser) {
      return res.status(409).json({ msg: 'This mobile number is already registered. Please log in instead.' });
    }
    if (cleanEmail) {
      const existingEmailUser = await User.findOne({ email: cleanEmail });
      if (existingEmailUser) {
        return res.status(400).json({ msg: 'This email address is already in use by another account.' });
      }
    }

    const newUser = new User({
      name: name.trim(),
      phone: cleanPhone,
      password,
      role: 'user',
      ...(cleanEmail ? { email: cleanEmail } : {}) // omit the key entirely when blank
    });
    await newUser.save();
    await PhoneOtp.deleteOne({ _id: otpRecord._id });

    res.status(201).json({ token: signGuestToken(newUser), user: guestPayload(newUser) });
  } catch (err) {
    console.error('Phone registration error:', err);
    res.status(500).json({ msg: 'Server error creating your account. Please try again.' });
  }
});

// Returning guest/traveler login: mobile number + password
router.post('/phone/login', async (req, res) => {
  try {
    const { password } = req.body;
    const cleanPhone = cleanPhoneNumber(req.body.phone);

    if (!isValidIndianMobile(cleanPhone)) {
      return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!password) {
      return res.status(400).json({ msg: 'Please enter your password.' });
    }

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(400).json({ msg: 'No account found with this mobile number. Please create one first.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect password. Please try again.' });
    }
    if (INACTIVE_STATUSES.includes(user.status)) {
      return res.status(403).json({ msg: 'This account is not active. Contact Admin.' });
    }

    res.json({ token: signGuestToken(user), user: guestPayload(user) });
  } catch (err) {
    console.error('Phone login error:', err);
    res.status(500).json({ msg: 'Server error during login. Please try again.' });
  }
});

// Returning guest/traveler login: mobile number + OTP (from /phone/send-otp with purpose 'login')
router.post('/phone/login-otp', async (req, res) => {
  try {
    const cleanPhone = cleanPhoneNumber(req.body.phone);
    if (!isValidIndianMobile(cleanPhone)) {
      return res.status(400).json({ msg: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!req.body.otp) {
      return res.status(400).json({ msg: 'Please enter the OTP sent to your mobile number.' });
    }

    const { record, error } = await checkPhoneOtp(cleanPhone, 'login', req.body.otp);
    if (error) return res.status(400).json({ msg: error });

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(400).json({ msg: 'No account found with this mobile number. Please create one first.' });
    }
    if (INACTIVE_STATUSES.includes(user.status)) {
      return res.status(403).json({ msg: 'This account is not active. Contact Admin.' });
    }

    await PhoneOtp.deleteOne({ _id: record._id });
    res.json({ token: signGuestToken(user), user: guestPayload(user) });
  } catch (err) {
    console.error('Phone OTP login error:', err);
    res.status(500).json({ msg: 'Server error during login. Please try again.' });
  }
});

const auth = require('../middleware/auth');

// Update User/Provider Profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, bio } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      bio: user.bio
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ msg: 'Server error updating profile' });
  }
});

module.exports = router;
