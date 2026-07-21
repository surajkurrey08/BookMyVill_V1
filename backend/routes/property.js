const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// Add Property (Protected - Owners only)
router.post('/add', auth, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Access denied' });

  try {
    const { name, type, location, price, photos, videos } = req.body;
    const newProperty = new Property({
      owner: req.user.id,
      name,
      type,
      location,
      price: price ? parseInt(price) : 10000,
      photos: photos || [],
      videos: videos || [],
      status: 'approved'
    });
    await newProperty.save();
    res.json(newProperty);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all properties for an owner
router.get('/my-properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id });
    res.json(properties);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all properties (Public)
router.get('/all', async (req, res) => {
  try {
    const properties = await Property.find({});
    res.json(properties);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get single property details
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('owner', 'name email');
    if (!property) return res.status(404).json({ msg: 'Property not found' });
    res.json(property);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
