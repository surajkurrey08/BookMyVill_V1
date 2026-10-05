const express = require('express');
const router = express.Router();
const PartnerApplication = require('../models/PartnerApplication');
const PartnerInquiry = require('../models/PartnerInquiry');
const { partnerContact } = require('../utils/partnerContact');
const mongoose = require('mongoose');

router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ msg: 'We cannot save your request right now. Please try again shortly.' });
  next();
});

const parseUserPrice = (val, fallback = 10000) => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) || val <= 0 ? fallback : val;
  const num = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
  return isNaN(num) || num <= 0 ? fallback : num;
};

const handleApply = async (req, res) => {
  let contact;
  try { contact = partnerContact(req.body || {}); }
  catch (err) { return res.status(400).json({ msg: err.message }); }
  const applicationType = req.body.applicationType || 'property-listing';
  if (!['owner-registration', 'property-listing'].includes(applicationType)) return res.status(400).json({ msg: 'Choose owner registration or property listing.' });
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
      mapLink,
      photos,
      videos,
      govtId, 
      experience, 
      services, 
      message 
    } = { ...req.body, ...contact };

    if (!fullName || !email || !phone) {
      return res.status(400).json({ msg: 'Full name, email, and phone number are required.' });
    }

    const numericPrice = parseUserPrice(price, 10000);

    // 1. Check if an application with this email already exists and update it
    let application = await PartnerApplication.findOne({
      email,
      applicationType: applicationType === 'owner-registration' ? applicationType : { $ne: 'owner-registration' },
    });
    if (application?.status === 'approved') return res.status(409).json({ msg: 'This application is already approved. Please contact the team for changes.' });
    if (application) {
      application.applicationType = applicationType;
      application.fullName = fullName;
      application.phone = phone;
      application.partnerType = partnerType || application.partnerType;
      application.propertyName = propertyName || application.propertyName;
      application.propertyType = propertyType || application.propertyType;
      application.price = price ? numericPrice : application.price;
      application.city = city || application.city;
      application.mapLink = mapLink || application.mapLink;
      if (Array.isArray(photos)) application.photos = photos;
      if (Array.isArray(videos)) application.videos = videos;
      application.message = message || application.message;
      application.status = 'pending';
      application.appliedAt = new Date();
      await application.save();
    } else {
      application = new PartnerApplication({
        applicationType,
        fullName,
        email: email.toLowerCase().trim(),
        phone,
        partnerType: partnerType || 'Property Owner',
        propertyName: propertyName || 'N/A',
        propertyType: propertyType || 'Villa',
        price: applicationType === 'owner-registration' ? '' : numericPrice,
        city: city || 'Mahabaleshwar',
        mapLink: mapLink || '',
        photos: Array.isArray(photos) ? photos : [],
        videos: Array.isArray(videos) ? videos : [],
        govtId: govtId || '',
        experience: experience || '',
        services: services || '',
        message: message || '',
        status: 'pending'
      });
      await application.save();
    }

    res.status(201).json({ 
      msg: 'Application received by our admin team. Your owner account will be available after approval.',
      application: { _id: application._id, status: application.status, applicationType: application.applicationType }
    });
  } catch (err) {
    console.error('Partner application error:', err);
    res.status(500).json({ msg: 'Failed to submit application. Please try again.' });
  }
};

// Submit Partner / Join Us Application (Public)
router.post('/apply', handleApply);
router.post('/', handleApply);

// Inquiries are saved independently: they never reset or approve an application.
router.post('/inquiry', async (req, res) => {
  let contact;
  try {
    contact = partnerContact(req.body || {});
    if (contact.message.length < 10) throw new Error('Tell us about your inquiry in at least 10 characters.');
  } catch (err) { return res.status(400).json({ msg: err.message }); }
  try {
    const inquiry = await PartnerInquiry.create(contact);
    res.status(201).json({ msg: 'Inquiry received by our admin team. We will contact you using the details provided.', inquiry: { _id: inquiry._id, status: inquiry.status } });
  } catch (err) {
    console.error('Partner inquiry error:', err);
    res.status(500).json({ msg: 'Could not save your inquiry. Please try again.' });
  }
});

// Get all applications (Public/Admin)
router.get('/all', async (req, res) => {
  try {
    const apps = await PartnerApplication.find({ status: 'approved', partnerType: { $in: ['Property Owner', 'Villa Host'] } })
      .select('fullName partnerType propertyName city experience status').sort({ appliedAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
