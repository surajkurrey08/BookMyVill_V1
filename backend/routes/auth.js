const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    console.log('Registering user:', email);

    if (!name || /\d/.test(name.trim()) || !/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
      return res.status(400).json({ msg: 'Full name cannot contain numbers. Please enter alphabetic letters only.' });
    }
    
    if (role === 'owner') {
      const PartnerApplication = require('../models/PartnerApplication');
      const cleanEmail = (email || '').toLowerCase().trim();

      // Case-insensitive query for approved property applications matching email
      const partnerApps = await PartnerApplication.find({ 
        email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }, 
        status: 'approved' 
      });

      if (!partnerApps || partnerApps.length === 0) {
        // Check if there is ANY application for this email that is pending admin approval
        const pendingApp = await PartnerApplication.findOne({
          email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
        });

        if (pendingApp && pendingApp.status === 'pending') {
          return res.status(400).json({
            msg: 'Property not accepted yet: Your property application is currently pending admin approval. Once the admin accepts your property, password creation will be enabled.'
          });
        }

        return res.status(400).json({
          msg: 'Property not accepted: Password creation failed because no admin-approved property application was found matching email ' + email + '.'
        });
      }

      // Verify name and mobile number match the admin-accepted property application
      const reqDigits = (phone || '').replace(/\D/g, '');
      const reqNameClean = (name || '').trim().toLowerCase();

      const matchedApp = partnerApps.find(app => {
        const appDigits = (app.phone || '').replace(/\D/g, '');
        const appNameClean = (app.fullName || '').trim().toLowerCase();

        const phoneMatch = !reqDigits || !appDigits || reqDigits === appDigits || reqDigits.endsWith(appDigits) || appDigits.endsWith(reqDigits);
        const nameMatch = !reqNameClean || !appNameClean || reqNameClean === appNameClean || reqNameClean.includes(appNameClean) || appNameClean.includes(reqNameClean);

        return phoneMatch && nameMatch;
      });

      if (!matchedApp) {
        return res.status(400).json({
          msg: 'Property details mismatch: Password creation failed because your name or mobile number does not match the property application accepted by the admin.'
        });
      }
    }
    
    const cleanEmail = (email || '').toLowerCase().trim();
    let user = await User.findOne({ 
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
    });

    if (user) {
      const PartnerApplication = require('../models/PartnerApplication');
      const approvedApp = await PartnerApplication.findOne({
        email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        status: 'approved'
      });

      if (approvedApp || role === 'owner' || user.role === 'owner') {
        user.password = password; // UserSchema pre('save') hook hashes this automatically
        user.name = name || user.name;
        if (phone) user.phone = phone;
        user.role = 'owner';
        await user.save();
        console.log(`Approved owner (${cleanEmail}) password set/updated successfully in MongoDB`);
      } else {
        console.log('User already exists');
        return res.status(400).json({ msg: 'User already exists' });
      }
    } else {
      user = new User({ name, email: cleanEmail, phone: phone || '', password, role });
      await user.save();
      console.log(`New user (${cleanEmail}) saved to MongoDB`);
    }

    if (!process.env.JWT_SECRET) {
      console.log('CRITICAL ERROR: JWT_SECRET is missing from .env');
      return res.status(500).json({ msg: 'Server configuration error' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide both email address and password.' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
    });

    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (bErr) {
      isMatch = false;
    }

    // Fallback for plain text passwords (migrating legacy plain text records automatically)
    if (!isMatch && user.password === password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      isMatch = true;
    }

    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Block property owner login if property has not been accepted/approved by Admin
    if (user.role === 'owner') {
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
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET Login info fallback (prevents Cannot GET /api/auth/login)
router.get('/login', (req, res) => {
  res.json({ msg: 'Authentication endpoint active. Submit a POST request with email and password to log in.' });
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
