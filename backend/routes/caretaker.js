const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const CaretakerApplication = require('../models/CaretakerApplication');

// Apply for Caretaker (Owners/Providers only)
router.post('/apply', auth, async (req, res) => {
  try {
    const { propertyId, propertyName, phone, experience, services, govtId, bio } = req.body;

    const application = new CaretakerApplication({
      provider: req.user.id,
      property: propertyId || null,
      propertyName: propertyName || 'All Managed Properties',
      phone: phone || 'N/A',
      experience: experience || '3+ Years',
      services: services || ['Guest Check-in', 'Maintenance'],
      govtId: govtId || '',
      bio: bio || '',
      status: 'approved' // Auto-approve for instant live display
    });

    await application.save();
    res.status(201).json(application);
  } catch (err) {
    console.error('Caretaker apply error:', err.message);
    res.status(500).json({ msg: 'Failed to submit caretaker application' });
  }
});

// Get provider's caretaker applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    const applications = await CaretakerApplication.find({ provider: req.user.id }).sort({ appliedAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
