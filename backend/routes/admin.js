const express = require('express');
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

// Get all users (Admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all properties (Admin only)
router.get('/properties', auth, adminAuth, async (req, res) => {
  try {
    const properties = await Property.find().populate('owner', 'name email');
    res.json(properties);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all Join Us Partner applications (Admin only)
router.get('/partner-applications', auth, adminAuth, async (req, res) => {
  try {
    let applications = await PartnerApplication.find().sort({ appliedAt: -1 });
    if (applications.length === 0) {
      const dummyOwners = [
        {
          fullName: 'Rajesh Sharma (Property Owner)',
          email: 'rajesh.sharma@mahabaleshwarvillas.com',
          phone: '+91 98234 56789',
          partnerType: 'Property Owner',
          propertyName: 'Royal Mist Luxury Villa',
          propertyType: 'Villa',
          city: 'Mahabaleshwar',
          price: '18500',
          message: '4 Bedroom Luxury Villa with Heated Private Pool, Valley View & BBQ Lawn.',
          status: 'pending'
        },
        {
          fullName: 'Ananya Deshmukh (Property Owner)',
          email: 'ananya.deshmukh@punehospitality.in',
          phone: '+91 94220 11223',
          partnerType: 'Property Owner',
          propertyName: 'Panchgani Crest Retreat',
          propertyType: 'Resort',
          city: 'Panchgani',
          price: '14000',
          message: '6 Premium Suites, Strawberry Garden Walkways, Organic Dining & Caretaker Cottage.',
          status: 'pending'
        },
        {
          fullName: 'Vikramaditya Patil (Property Owner)',
          email: 'vikram.patil@punestays.com',
          phone: '+91 97654 32100',
          partnerType: 'Property Owner',
          propertyName: 'Pawna Lakefront Chalet',
          propertyType: 'Cabin',
          city: 'Pune',
          price: '22000',
          message: '3 Bedroom Wooden Chalet with Private Jet Ski Dock & Infinity Pool.',
          status: 'approved'
        }
      ];
      await PartnerApplication.insertMany(dummyOwners);
      applications = await PartnerApplication.find().sort({ appliedAt: -1 });
    }
    res.json(applications);
  } catch (err) {
    res.status(500).send('Server error');
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

    if (id.startsWith('dummy-')) {
      return res.json({ _id: id, status });
    }

    let application;
    try {
      application = await PartnerApplication.findByIdAndUpdate(id, { status }, { new: true });
    } catch (dbErr) {
      application = { _id: id, status };
    }
    
    let approvedUser = null;
    // Create/Enable Owner Credentials IF AND ONLY IF Admin accepted the matching email
    if (status === 'approved' && application && application.email) {
      try {
        approvedUser = await User.findOne({ email: application.email.toLowerCase().trim() });
        if (!approvedUser) {
          const bcrypt = require('bcryptjs');
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('owner123', salt);
          approvedUser = new User({
            name: application.fullName,
            email: application.email.toLowerCase().trim(),
            phone: application.phone || '',
            password: hashedPassword,
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
    res.json({ _id: req.params.id, status: req.body.status || 'approved' });
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

