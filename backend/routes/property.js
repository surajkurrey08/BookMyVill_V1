const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// Add Property (Protected - Owners only)
router.post('/add', auth, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Access denied' });

  try {
    const { name, type, location, price, mapLink, photos, videos } = req.body;
    const newProperty = new Property({
      owner: req.user.id,
      name,
      type,
      location,
      price: price ? parseInt(price) : 10000,
      mapLink: mapLink || '',
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

// Update property (Protected - Owner or Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    if (property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to update this property' });
    }

    const { name, type, location, price, mapLink, photos, videos, status } = req.body;
    if (name) property.name = name;
    if (type) property.type = type;
    if (location) property.location = location;
    if (price) property.price = parseInt(price);
    if (mapLink !== undefined) property.mapLink = mapLink;
    if (photos) property.photos = photos;
    if (videos) property.videos = videos;
    if (status && req.user.role === 'admin') property.status = status;

    await property.save();
    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating property');
  }
});

// Delete property (Protected - Owner or Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    if (property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to delete this property' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Property deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error deleting property');
  }
});

module.exports = router;
