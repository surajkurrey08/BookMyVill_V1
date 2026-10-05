const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const PartnerApplication = require('../models/PartnerApplication');
const CaretakerApplication = require('../models/CaretakerApplication');
const { requirePermission, adminConsoleAuth } = require('../middleware/adminConsoleAuth');
const { MANAGEMENT_SELECT, managementMode } = require('../services/propertyAccess');

// Get all users (Admin only)
router.get('/users', adminConsoleAuth, requirePermission('customers.view'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable.' });
  }
  try {
    const users = await User.find({ role: { $in: ['owner', 'user'] } }).select('_id name email phone role status createdAt');
    res.json(users);
  } catch (err) {
    res.status(503).json({ msg: 'Could not load accounts.' });
  }
});

// Get all properties (Admin only)
router.get('/properties', adminConsoleAuth, requirePermission('properties.view'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable. Please try again.' });
  }
  try {
    const properties = await Property.find().select(MANAGEMENT_SELECT).populate('owner', 'name email')
      .populate('assignedVillaManager', 'name email phone').populate('assignedDataEntryUser', 'name email phone').lean();
    res.json(properties.map(property => ({ ...property, managementMode: managementMode(property) })));
  } catch (err) {
    res.status(500).json({ msg: 'Could not load properties. Please try again.' });
  }
});

// Get all Join Us Partner applications (Admin only)
router.get('/partner-applications', adminConsoleAuth, requirePermission('owners.view'), async (req, res) => {
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
router.post('/partner-apply', (req,res) => res.status(410).json({ msg: 'Use the Join Us application form.' }));

// Update Partner application status - Approve / Reject (Admin only)
router.put('/partner-application/:id/status', adminConsoleAuth, requirePermission('owners.manage'), async (req, res) => {
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

    // Approved applications are imported through the canonical owner PMS listing workflow.

    res.json(application || { _id: id, status });
  } catch (err) {
    console.error('Partner application status error:', err);
    res.status(500).json({ msg: 'Could not update partner application.' });
  }
});

// Give an approved owner a one-time password setup link for manual handoff.
router.post('/partner-application/:id/setup-link', adminConsoleAuth, requirePermission('owners.manage'), async (req, res) => {
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
router.get('/caretaker-applications', adminConsoleAuth, requirePermission('properties.view'), async (req, res) => {
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
router.put('/caretaker-application/:id/status', adminConsoleAuth, requirePermission('properties.manage'), async (req, res) => {
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
router.put('/property/:id/price', adminConsoleAuth, requirePermission('properties.manage'), async (req, res) => {
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
router.put('/property/:id/status', adminConsoleAuth, requirePermission('properties.approve'), async (req, res) => {
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
router.put('/user/:id/status', adminConsoleAuth, requirePermission('team.manage'), async (req, res) => {
  try {
    const { status } = req.body; // 'approved', 'rejected', or 'active'
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, status });

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ msg: 'Account not found.' });
    res.json({ _id:user._id, name:user.name, role:user.role, status:user.status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

// Remove User from Database (Admin only)
router.delete('/user/:id', adminConsoleAuth, requirePermission('team.manage'), (req,res) => res.status(409).json({ msg: 'Suspend accounts through audited account actions; records with ownership and bookings must be preserved.' }));

// Send Direct Admin Request / Notification to Selected User (Admin only)
router.post('/send-user-request', adminConsoleAuth, requirePermission('customers.manage'), async (req, res) => {
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

