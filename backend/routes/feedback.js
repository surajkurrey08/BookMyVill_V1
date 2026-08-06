const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Feedback = require('../models/Feedback');
const Property = require('../models/Property');

// @route   GET api/feedback/owner
// @desc    Get all tourist feedback for owner's properties
router.get('/owner', auth, async (req, res) => {
  try {
    const ownerProperties = await Property.find({ owner: req.user.id });
    const propIds = ownerProperties.map(p => p._id);

    let feedbackList = await Feedback.find({
      $or: [{ ownerId: req.user.id }, { propertyId: { $in: propIds } }]
    }).sort({ createdAt: -1 });

    if (feedbackList.length === 0) {
      // Seed default tourist feedback
      const sampleProp = ownerProperties.length > 0 ? ownerProperties[0] : null;
      const defaults = [
        {
          propertyId: sampleProp ? sampleProp._id : req.user.id,
          propertyName: sampleProp ? sampleProp.name : 'Strawberry Hills Villa',
          ownerId: req.user.id,
          guestName: 'Ananya Deshmukh',
          guestPhone: '+91 99887 76655',
          rating: 5,
          reviewText: 'Breathtaking mountain view and exceptional caretaker service! The private bonfire and hot breakfast made our Mahabaleshwar trip unforgettable.',
          facilitiesUsed: ['Complimentary Breakfast', 'Night Bonfire', 'Personal Chef', 'Private Swimming Pool']
        },
        {
          propertyId: sampleProp ? sampleProp._id : req.user.id,
          propertyName: sampleProp ? sampleProp.name : 'Valley View Estate',
          ownerId: req.user.id,
          guestName: 'Vikram & Swati Mehta',
          guestPhone: '+91 98765 43210',
          rating: 4,
          reviewText: 'Super clean rooms and peaceful ambience. Key handover was quick and Wi-Fi speed was top notch.',
          facilitiesUsed: ['Free High-Speed Wi-Fi', '24/7 Power Backup', 'Lawn & Garden']
        }
      ];
      feedbackList = await Feedback.insertMany(defaults);
    }
    res.json(feedbackList);
  } catch (err) {
    console.error('Feedback GET Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/feedback
// @desc    Public route for tourists to submit stay feedback
router.post('/', async (req, res) => {
  try {
    const { propertyId, propertyName, guestName, guestPhone, rating, reviewText, facilitiesUsed } = req.body;
    
    let ownerId = null;
    if (propertyId) {
      const prop = await Property.findById(propertyId);
      if (prop) ownerId = prop.owner;
    }

    const newFeedback = new Feedback({
      propertyId: propertyId || req.body.ownerId,
      propertyName: propertyName || 'Mahabaleshwar Villa',
      ownerId,
      guestName,
      guestPhone,
      rating: Number(rating) || 5,
      reviewText,
      facilitiesUsed: facilitiesUsed || []
    });

    const saved = await newFeedback.save();
    res.json(saved);
  } catch (err) {
    console.error('Feedback POST Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
