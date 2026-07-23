const express = require('express');
const router = express.Router();
const PartnerApplication = require('../models/PartnerApplication');
const Property = require('../models/Property');

const handleApply = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      phone, 
      partnerType, 
      propertyName, 
      propertyType, 
      price, 
      city, 
      govtId, 
      experience, 
      services, 
      message 
    } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({ msg: 'Full name, email, and phone number are required.' });
    }

    // 1. Save Partner Application in DB
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

    // 2. If Property Owner, also create a pending Property record in DB
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
      } catch (propErr) {
        console.error('Error saving property record alongside partner application:', propErr);
      }
    }

    // 3. Auto-create/upgrade host User account and generate token
    const User = require('../models/User');
    const jwt = require('jsonwebtoken');
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: fullName,
        email,
        phone: phone || '',
        password: req.body.password || 'owner123',
        role: 'owner'
      });
      await user.save();
    } else if (user.role !== 'owner' && user.role !== 'admin') {
      user.role = 'owner';
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    res.status(201).json({ 
      msg: 'Application submitted successfully! Redirecting to Owner Portal...', 
      application,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Partner application error:', err);
    res.status(500).json({ msg: 'Failed to submit application. Please try again.' });
  }
};

// Submit Partner / Join Us Application (Public)
router.post('/apply', handleApply);
router.post('/', handleApply);

// Get all applications (Public/Admin)
router.get('/all', async (req, res) => {
  try {
    const apps = await PartnerApplication.find().sort({ appliedAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
