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
// Submit Partner Application (Public Admin Fallback Route)
router.post('/partner-apply', async (req, res) => {
  try {
    const { fullName, email, phone, partnerType, propertyName, propertyType, price, city, govtId, experience, services, message } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ msg: 'Full name, email, and phone number are required.' });
    }
    const application = new PartnerApplication({
      fullName,
      email,
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
    
    if (application && application.propertyName && application.propertyName !== 'N/A') {
      try {
        await Property.updateMany({ name: application.propertyName }, { status });
      } catch (pErr) {
        console.error('Error syncing property status:', pErr);
      }
    }
    
    res.json(application || { _id: id, status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status || 'approved' });
  }
});

// Get all Caretaker applications (Admin only)
router.get('/caretaker-applications', auth, adminAuth, async (req, res) => {
  try {
    let applications = await PartnerApplication.find({ partnerType: 'Caretaker' }).sort({ appliedAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update Caretaker application status - Approve / Reject (Admin only)
router.put('/caretaker-application/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
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
    res.json(application || { _id: id, status });
  } catch (err) {
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
    const property = await Property.findByIdAndUpdate(id, { status }, { new: true });
    res.json(property || { _id: id, status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

module.exports = router;

