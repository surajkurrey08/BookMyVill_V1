const express = require('express');
const router = express.Router();
const PartnerApplication = require('../models/PartnerApplication');
const Property = require('../models/Property');

const parseUserPrice = (val, fallback = 10000) => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) || val <= 0 ? fallback : val;
  const num = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
  return isNaN(num) || num <= 0 ? fallback : num;
};

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

    if (/\d/.test(fullName.trim()) || !/^[a-zA-Z\s.'-]+$/.test(fullName.trim())) {
      return res.status(400).json({ msg: 'Property owner name cannot contain numbers. Please enter alphabetic letters only.' });
    }

    const numericPrice = parseUserPrice(price, 10000);

    // 1. Check if an application with this email already exists and update it
    let application = await PartnerApplication.findOne({ email: email.toLowerCase().trim() });
    if (application) {
      application.fullName = fullName;
      application.phone = phone;
      application.partnerType = partnerType || application.partnerType;
      application.propertyName = propertyName || application.propertyName;
      application.propertyType = propertyType || application.propertyType;
      application.price = price ? numericPrice : application.price;
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
        price: numericPrice,
        city: city || 'Mahabaleshwar',
        govtId: govtId || '',
        experience: experience || '',
        services: services || '',
        message: message || '',
        status: 'pending'
      });
      await application.save();
    }

    // 2. If Property Owner, also create a pending Property record in DB
    if ((partnerType === 'Property Owner' || partnerType === 'Villa Host') && propertyName && propertyName !== 'N/A') {
      try {
        const newProperty = new Property({
          name: propertyName,
          type: propertyType || 'Villa',
          location: city || 'Mahabaleshwar',
          price: numericPrice,
          photos: [],
          videos: [],
          status: 'pending'
        });
        await newProperty.save();
      } catch (propErr) {
        console.error('Error saving property record alongside partner application:', propErr);
      }
    }

    res.status(201).json({ 
      msg: 'Property application submitted successfully! Your credentials will be created once the Admin accepts your property matching your email address.', 
      application
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
