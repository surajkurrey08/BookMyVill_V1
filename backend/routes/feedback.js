const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Feedback = require('../models/Feedback');
const Property = require('../models/Property');

let defaultFeedbackList = [
  {
    _id: 'fb-1',
    propertyName: 'Royal Mist Villa Estate',
    ownerId: 'owner123',
    guestName: 'Ananya Deshmukh',
    guestPhone: '+91 99887 76655',
    rating: 5,
    reviewText: 'Breathtaking mountain view and exceptional caretaker service! The private bonfire and hot breakfast made our Mahabaleshwar trip unforgettable.',
    facilitiesUsed: ['Complimentary Breakfast', 'Night Bonfire', 'Personal Chef', 'Private Swimming Pool'],
    selectedForHotelPage: true
  },
  {
    _id: 'fb-2',
    propertyName: 'Royal Mist Villa Estate',
    ownerId: 'owner123',
    guestName: 'Vikram & Swati Mehta',
    guestPhone: '+91 98765 43210',
    rating: 5,
    reviewText: 'Super clean rooms, misty valley breeze, and peaceful ambience. Key handover was smooth and Wi-Fi speed was top notch.',
    facilitiesUsed: ['Free High-Speed Wi-Fi', '24/7 Power Backup', 'Lawn & Garden'],
    selectedForHotelPage: true
  }
];

// @route   GET api/feedback/owner
// @desc    Get all tourist feedback for owner's properties
router.get('/owner', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(defaultFeedbackList);
  }
  try {
    const ownerProperties = await Property.find({ owner: req.user.id });
    const propIds = ownerProperties.map(p => p._id);

    let feedbackList = await Feedback.find({
      $or: [{ ownerId: req.user.id }, { propertyId: { $in: propIds } }]
    }).sort({ createdAt: -1 });

    if (feedbackList.length === 0) {
      feedbackList = defaultFeedbackList;
    }
    res.json(feedbackList);
  } catch (err) {
    console.error('Feedback GET Error:', err.message);
    res.json(defaultFeedbackList);
  }
});

// @route   GET api/feedback/admin
// @desc    Get all tourist feedback for admin dashboard across all properties
router.get('/admin', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(defaultFeedbackList);
  }
  try {
    let feedbackList = await Feedback.find().sort({ createdAt: -1 });
    if (feedbackList.length === 0) {
      feedbackList = defaultFeedbackList;
    }
    res.json(feedbackList);
  } catch (err) {
    console.error('Admin Feedback GET Error:', err.message);
    res.json(defaultFeedbackList);
  }
});

// @route   GET api/feedback/property/:propertyId
// @desc    Get owner-selected feedback for a specific property details page
router.get('/property/:propertyId', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(defaultFeedbackList);
  }
  try {
    const { propertyId } = req.params;
    let selectedFeedback = await Feedback.find({
      propertyId,
      selectedForHotelPage: true
    }).sort({ createdAt: -1 });

    if (selectedFeedback.length === 0) {
      selectedFeedback = await Feedback.find({ propertyId }).sort({ rating: -1 }).limit(5);
    }

    if (selectedFeedback.length === 0) {
      selectedFeedback = defaultFeedbackList;
    }
    res.json(selectedFeedback);
  } catch (err) {
    res.json(defaultFeedbackList);
  }
});

// @route   PUT api/feedback/:id/toggle-select
// @desc    Toggle owner selection status for displaying feedback on property details page
router.put('/:id/toggle-select', auth, async (req, res) => {
  const { id } = req.params;

  // Handle in-memory fallback toggle if DB is disconnected
  if (mongoose.connection.readyState !== 1) {
    const item = defaultFeedbackList.find(f => f._id === id || f.id === id);
    if (item) {
      item.selectedForHotelPage = !item.selectedForHotelPage;
      return res.json(item);
    }
    return res.json({ _id: id, selectedForHotelPage: true, msg: 'Selection toggled' });
  }

  try {
    const fb = await Feedback.findById(id);
    if (!fb) return res.status(404).json({ msg: 'Feedback record not found' });

    fb.selectedForHotelPage = !fb.selectedForHotelPage;
    await fb.save();
    res.json(fb);
  } catch (err) {
    console.error('Error toggling feedback selection:', err);
    res.status(500).json({ msg: 'Failed to update feedback selection' });
  }
});

// @route   DELETE api/feedback/:id
// @desc    Delete a tourist feedback entry
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (mongoose.connection.readyState !== 1) {
    defaultFeedbackList = defaultFeedbackList.filter(f => f._id !== id && f.id !== id);
    return res.json({ msg: 'Feedback removed' });
  }
  try {
    await Feedback.findByIdAndDelete(id);
    res.json({ msg: 'Feedback removed successfully' });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ msg: 'Failed to delete feedback' });
  }
});

// @route   POST api/feedback
// @desc    Public route for tourists to submit stay feedback
router.post('/', async (req, res) => {
  try {
    const { propertyId, propertyName, guestName, guestPhone, rating, reviewText, facilitiesUsed } = req.body;
    
    let ownerId = null;
    let finalPropName = propertyName || 'Mahabaleshwar Villa';

    if (propertyId && mongoose.connection.readyState === 1) {
      const prop = await Property.findById(propertyId);
      if (prop) {
        ownerId = prop.owner;
        if (!propertyName && prop.title) finalPropName = prop.title;
      }
    }

    const newFeedback = {
      _id: 'fb-' + Date.now(),
      propertyId: propertyId || req.body.ownerId || 'prop-101',
      propertyName: finalPropName,
      ownerId,
      guestName: guestName || 'Guest Tourist',
      guestPhone: guestPhone || '',
      rating: Number(rating) || 5,
      reviewText: reviewText || 'Wonderful stay experience!',
      facilitiesUsed: Array.isArray(facilitiesUsed) ? facilitiesUsed : [],
      selectedForHotelPage: true,
      createdAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      const saved = new Feedback(newFeedback);
      await saved.save();
      return res.json(saved);
    }

    defaultFeedbackList.unshift(newFeedback);
    res.json(newFeedback);
  } catch (err) {
    console.error('Feedback POST Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
