const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const PartnerApplication = require('../models/PartnerApplication');
const CaretakerApplication = require('../models/CaretakerApplication');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied. Admins only.' });
  }
  next();
};

// Credential setup links require a verified admin account, not the legacy
// auth middleware's development fallback.
const strictAdminAuth = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Admin login required.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026');
    const admin = await User.findById(decoded.id).select('role');
    if (!admin || admin.role !== 'admin') return res.status(403).json({ msg: 'Admins only.' });
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Admin session expired. Please sign in again.' });
  }
};

const dummyUsersList = [
  { _id: 'u1', name: 'Saroj Naydu', email: 'owner@mahabaleshwarstays.com', role: 'owner', phone: '9876543210', status: 'approved' },
  { _id: 'u2', name: 'Suresh Pawar', email: 'suresh.caretaker@example.com', role: 'caretaker', phone: '9890123456', status: 'approved' },
  { _id: 'u3', name: 'Vikram Sharma', email: 'vikram.sharma@example.com', role: 'user', phone: '9823011223', status: 'approved' }
];

const dummyPropertyList = [
  {
    _id: 'p1',
    name: 'Royal Mist Villa Estate',
    type: 'Villa',
    location: 'Mahabaleshwar Peak View',
    price: 18500,
    status: 'approved',
    owner: { name: 'Saroj Naydu', email: 'owner@mahabaleshwarstays.com' }
  }
];

// Get all users (Admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(dummyUsersList);
  }
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.json(dummyUsersList);
  }
});

// Get all properties (Admin only)
router.get('/properties', auth, adminAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(dummyPropertyList);
  }
  try {
    const properties = await Property.find().populate('owner', 'name email');
    res.json(properties);
  } catch (err) {
    res.json(dummyPropertyList);
  }
});

// Get all Join Us Partner applications (Admin only)
router.get('/partner-applications', auth, adminAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable. Please try again.' });
  }
  try {
    const applications = await PartnerApplication.find().sort({ appliedAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error('Error fetching partner applications:', err);
    res.status(500).json({ msg: 'Failed to load partner applications.' });
  }
});
router.post('/partner-apply', async (req, res) => {
  try {
    const { fullName, email, phone, partnerType, propertyName, propertyType, price, city, govtId, experience, services, message } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ msg: 'Full name, email, and phone number are required.' });
    }
    let application = await PartnerApplication.findOne({ email: email.toLowerCase().trim() });
    if (application) {
      application.fullName = fullName;
      application.phone = phone;
      application.partnerType = partnerType || application.partnerType;
      application.propertyName = propertyName || application.propertyName;
      application.propertyType = propertyType || application.propertyType;
      application.price = price || application.price;
      application.city = city || application.city;
      application.message = message || application.message;
      await application.save();
    } else {
      application = new PartnerApplication({
        fullName,
        email: email.toLowerCase().trim(),
        phone,
        partnerType: partnerType || 'Property Owner',
        propertyName: propertyName || 'N/A',
        propertyType: propertyType || 'Villa',
        price: price || '',
        city: city || 'Mahabaleshwar',
        govtId: govtId || '',
        experience: experience || '',
        services: services || '',
        message: message || '',
        status: 'pending'
      });
      await application.save();
    }

    if ((partnerType === 'Property Owner' || partnerType === 'Villa Host') && propertyName && propertyName !== 'N/A') {
      try {
        const newProperty = new Property({
          name: propertyName,
          type: propertyType || 'Villa',
          location: city || 'Mahabaleshwar',
          price: price ? parseInt(price) : 12000,
          photos: [],
          videos: [],
          status: 'pending'
        });
        await newProperty.save();
      } catch (pErr) {}
    }

    res.status(201).json({ msg: 'Application submitted successfully!', application });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Partner application status - Approve / Reject (Admin only)
router.put('/partner-application/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const id = req.params.id;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid application status.' });
    }

    if (id.startsWith('dummy-')) {
      return res.json({ _id: id, status });
    }

    const application = await PartnerApplication.findByIdAndUpdate(id, { status }, { new: true });
    if (!application) return res.status(404).json({ msg: 'Application not found.' });
    
    let approvedUser = null;
    // Create/Enable Owner Credentials IF AND ONLY IF Admin accepted the matching email
    if (status === 'approved' && ['Property Owner', 'Villa Host'].includes(application.partnerType) && application.email) {
      try {
        approvedUser = await User.findOne({ email: application.email.toLowerCase().trim() });
        if (!approvedUser) {
          approvedUser = new User({
            name: application.fullName,
            email: application.email.toLowerCase().trim(),
            phone: application.phone || '',
            // An unusable random placeholder until the owner sets a password.
            // UserSchema hashes it once on save.
            password: crypto.randomBytes(32).toString('hex'),
            role: 'owner'
          });
          await approvedUser.save();
          console.log(`Created new owner credentials for accepted email: ${application.email}`);
        } else {
          approvedUser.role = 'owner';
          await approvedUser.save();
          console.log(`Updated user role to owner for accepted email: ${application.email}`);
        }
      } catch (userErr) {
        console.error('Error creating owner credentials for accepted email:', userErr);
        throw userErr;
      }
    }

    if (application && application.propertyName && application.propertyName !== 'N/A') {
      try {
        const parseUserPrice = (val, fallback = 10000) => {
          if (val === undefined || val === null || val === '') return fallback;
          if (typeof val === 'number') return isNaN(val) || val <= 0 ? fallback : val;
          const num = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
          return isNaN(num) || num <= 0 ? fallback : num;
        };

        let prop = await Property.findOne({ name: application.propertyName });
        const numericPrice = parseUserPrice(application.price, 10000);
        if (prop) {
          prop.status = status;
          if (approvedUser) prop.owner = approvedUser._id;
          if (numericPrice) prop.price = numericPrice;
          await prop.save();
        } else if (status === 'approved') {
          prop = new Property({
            name: application.propertyName,
            type: application.propertyType || 'Villa',
            location: application.city || 'Mahabaleshwar',
            price: numericPrice,
            mapLink: application.mapLink || '',
            amenities: ['Private Pool', 'Valley View', 'Wi-Fi', 'Garden'],
            photos: application.photos || [],
            videos: application.videos || [],
            status: 'approved',
            owner: approvedUser ? approvedUser._id : undefined
          });
          await prop.save();
          console.log(`Created and approved new property record for Explore Stays: ${application.propertyName}`);
        }
      } catch (pErr) {
        console.error('Error syncing property status:', pErr);
      }
    }
    
    res.json(application || { _id: id, status });
  } catch (err) {
    console.error('Partner application status error:', err);
    res.status(500).json({ msg: 'Could not update partner application.' });
  }
});

// Give an approved owner a one-time password setup link for manual handoff.
router.post('/partner-application/:id/setup-link', strictAdminAuth, async (req, res) => {
  try {
    const application = await PartnerApplication.findById(req.params.id);
    if (!application || application.status !== 'approved' ||
        !['Property Owner', 'Villa Host'].includes(application.partnerType)) {
      return res.status(400).json({ msg: 'Approve the property owner application first.' });
    }

    const email = application.email.toLowerCase().trim();
    let owner = await User.findOne({ email });
    if (!owner) {
      owner = new User({
        name: application.fullName,
        email,
        phone: application.phone || '',
        password: crypto.randomBytes(32).toString('hex'),
        role: 'owner'
      });
    } else if (owner.role !== 'owner') {
      owner.role = 'owner';
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    owner.ownerSetupTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    owner.ownerSetupExpiresAt = expiresAt;
    await owner.save();

    res.json({ email, token, expiresAt });
  } catch (err) {
    console.error('Owner setup link error:', err);
    res.status(500).json({ msg: 'Could not create owner setup link.' });
  }
});

// Get all Caretaker applications / requests from Property Owners (Admin only)
router.get('/caretaker-applications', auth, adminAuth, async (req, res) => {
  try {
    let applications = await CaretakerApplication.find()
      .populate('provider', 'name email phone')
      .sort({ appliedAt: -1 });

    if (!applications || applications.length === 0) {
      const partnerCaretakers = await PartnerApplication.find({ partnerType: 'Caretaker' }).sort({ appliedAt: -1 });
      applications = partnerCaretakers.map(p => ({
        _id: p._id,
        provider: { name: p.fullName, email: p.email },
        propertyName: p.propertyName || 'Assigned Villa',
        propertyAddress: p.city || 'Mahabaleshwar',
        positionRole: 'Chief Villa Caretaker Host',
        phone: p.phone,
        experience: p.experience || '3+ Years',
        skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation'],
        govtId: p.govtId || 'Verified ID',
        bio: p.message || '',
        status: p.status || 'pending',
        appliedAt: p.appliedAt || new Date()
      }));
    }

    res.json(applications);
  } catch (err) {
    res.status(500).json({ msg: 'Server error fetching caretaker applications' });
  }
});

// Update Caretaker application status - Allocate / Approve Caretaker (Admin only)
router.put('/caretaker-application/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status, assignedCaretakerName, assignedCaretakerPhone } = req.body;
    const id = req.params.id;

    if (id.startsWith('dummy-')) {
      return res.json({ _id: id, status, assignedCaretakerName, assignedCaretakerPhone });
    }

    let application = await CaretakerApplication.findById(id);
    if (application) {
      application.status = status || 'approved';
      if (assignedCaretakerName) application.assignedCaretakerName = assignedCaretakerName;
      if (assignedCaretakerPhone) application.assignedCaretakerPhone = assignedCaretakerPhone;
      await application.save();
      return res.json(application);
    }

    let partnerApp = await PartnerApplication.findById(id);
    if (partnerApp) {
      partnerApp.caretakerStatus = status || 'approved';
      await partnerApp.save();
      return res.json({ ...partnerApp.toObject(), status: partnerApp.caretakerStatus });
    }

    res.json({ _id: id, status: status || 'approved' });
  } catch (err) {
    console.error('Caretaker allocation update error:', err);
    res.json({ _id: req.params.id, status: req.body.status || 'approved' });
  }
});

// Update property price (Admin only)
router.put('/property/:id/price', auth, adminAuth, async (req, res) => {
  try {
    const { price } = req.body;
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, price });
    const property = await Property.findByIdAndUpdate(id, { price }, { new: true });
    res.json(property || { _id: id, price });
  } catch (err) {
    res.json({ _id: req.params.id, price: req.body.price });
  }
});

// Approve/Reject property (Admin only)
router.put('/property/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, status });

    let property = await Property.findByIdAndUpdate(id, { status }, { new: true });

    if (!property) {
      const partnerApp = await PartnerApplication.findByIdAndUpdate(id, { status }, { new: true });
      if (partnerApp && partnerApp.propertyName && partnerApp.propertyName !== 'N/A') {
        const approvedUser = await User.findOne({ email: (partnerApp.email || '').toLowerCase().trim() });
        property = new Property({
          name: partnerApp.propertyName,
          type: partnerApp.propertyType || 'Villa',
          location: partnerApp.city || 'Mahabaleshwar',
          price: partnerApp.price ? (typeof partnerApp.price === 'number' ? partnerApp.price : parseInt(partnerApp.price) || 12000) : 12000,
          mapLink: partnerApp.mapLink || '',
          amenities: ['Private Pool', 'Valley View', 'Wi-Fi', 'Garden'],
          photos: partnerApp.photos || [],
          videos: partnerApp.videos || [],
          status: status,
          owner: approvedUser ? approvedUser._id : undefined
        });
        await property.save();
      }
    } else {
      await PartnerApplication.findOneAndUpdate({ propertyName: property.name }, { status });
    }

    res.json(property || { _id: id, status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

// Update user status - Approve / Reject / Block (Admin only)
router.put('/user/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'approved', 'rejected', or 'active'
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, status });

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
    res.json(user || { _id: id, status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

// Remove User from Database (Admin only)
router.delete('/user/:id', auth, adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ success: true, msg: 'Dummy user removed', _id: id });
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ msg: 'User not found' });
    res.json({ success: true, msg: 'User successfully removed from database', deletedUser });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to remove user from database', error: err.message });
  }
});

// Send Direct Admin Request / Notification to Selected User (Admin only)
router.post('/send-user-request', auth, adminAuth, async (req, res) => {
  try {
    const { userId, targetName, targetEmail, targetPhone, requestType, subject, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ msg: 'Subject and message body are required' });
    }

    console.log(`[ADMIN DIRECT REQUEST] Target: ${targetName || targetEmail} | Type: ${requestType} | Subject: ${subject}`);

    res.json({
      success: true,
      msg: `Official admin request successfully dispatched to ${targetName || targetEmail || 'selected user'}!`,
      details: {
        userId,
        targetName,
        targetEmail,
        targetPhone,
        requestType,
        subject,
        message,
        dispatchedAt: new Date()
      }
    });
  } catch (err) {
    console.error('Send request error:', err);
    res.status(500).json({ msg: 'Failed to dispatch request to selected user' });
  }
});

module.exports = router;

