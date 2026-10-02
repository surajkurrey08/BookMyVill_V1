const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// Add Property (Protected - Owners only)
router.post('/add', require('../middleware/ownerAuth'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Access denied' });

  try {
    const { name, type, location, price, mapLink, amenities, photos, videos } = req.body;
    const newProperty = new Property({
      owner: req.user.id,
      name,
      type,
      location,
      price: price ? Math.max(1, Math.abs(parseInt(price) || 10000)) : 10000,
      mapLink: mapLink || '',
      amenities: Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(s => s.trim()).filter(Boolean) : []),
      photos: photos || [],
      videos: videos || [],
      status: 'pending' // Enforce Admin Approval before publishing to public website
    });
    await newProperty.save();
    res.json(newProperty);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all properties for an owner
router.get('/my-properties', require('../middleware/ownerAuth'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable.' });
  }
  try {
    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    console.error('Error fetching owner properties:', err);
    res.status(500).json({ msg: 'Could not load owner properties.' });
  }
});

// Get all properties (Public - Only Admin Approved Properties)
router.get('/all', async (req, res) => {
  try {
    const dbProperties = await Property.find({ status: 'approved' }).populate('owner', 'name email phone');
    const PartnerApplication = require('../models/PartnerApplication');
    const approvedApps = await PartnerApplication.find({ status: 'approved' });

    const partnerProps = approvedApps
      .filter(app => app.propertyName && app.propertyName !== 'N/A')
      .filter(app => !dbProperties.some(dp => dp.name?.toLowerCase().trim() === app.propertyName?.toLowerCase().trim()))
      .map((app, idx) => ({
        _id: app._id,
        name: app.propertyName,
        type: app.propertyType || 'Villa',
        location: app.city || 'Mahabaleshwar',
        price: app.price ? (typeof app.price === 'number' ? app.price : parseInt(app.price) || 12000) : 12000,
        mapLink: app.mapLink || '',
        amenities: ['Private Pool', 'Valley View', 'Wi-Fi', 'Garden'],
        photos: app.photos || [],
        videos: app.videos || [],
        status: 'approved',
        owner: { name: app.fullName, email: app.email, phone: app.phone }
      }));

    res.json([...dbProperties, ...partnerProps]);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get single property details
router.get('/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }
    let property = await Property.findById(req.params.id).populate('owner', 'name email phone');
    if (!property) {
      const PartnerApplication = require('../models/PartnerApplication');
      const partnerApp = await PartnerApplication.findById(req.params.id);
      if (partnerApp && partnerApp.propertyName && partnerApp.propertyName !== 'N/A') {
        property = {
          _id: partnerApp._id,
          name: partnerApp.propertyName,
          type: partnerApp.propertyType || 'Villa',
          location: partnerApp.city || 'Mahabaleshwar',
          price: partnerApp.price ? (typeof partnerApp.price === 'number' ? partnerApp.price : parseInt(partnerApp.price) || 12000) : 12000,
          mapLink: partnerApp.mapLink || '',
          amenities: ['Private Pool', 'Valley View', 'Wi-Fi', 'Garden'],
          photos: partnerApp.photos || [],
          videos: partnerApp.videos || [],
          status: partnerApp.status || 'pending',
          owner: { name: partnerApp.fullName, email: partnerApp.email, phone: partnerApp.phone }
        };
      }
    }
    if (!property) return res.status(404).json({ msg: 'Property not found' });
    res.json(property);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update property (Protected - Owner or Admin)
router.put('/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }

    let property = await Property.findById(req.params.id);

    if (!property) return res.status(404).json({ msg: 'Property not found' });

    let ownerIdStr = '';
    if (property.owner) {
      ownerIdStr = property.owner._id ? property.owner._id.toString() : property.owner.toString();
    }

    const isOwnerOrAdmin = req.user.role === 'admin' || (req.user.role === 'owner' && ownerIdStr === req.user.id);

    if (!isOwnerOrAdmin) {
      return res.status(403).json({ msg: 'Not authorized to update this property' });
    }

    const { name, type, location, price, mapLink, amenities, photos, videos, status } = req.body;
    if (name) property.name = name;
    if (type) property.type = type;
    if (location) property.location = location;
    if (price) property.price = Math.max(1, Math.abs(parseInt(price) || 10000));
    if (mapLink !== undefined) property.mapLink = mapLink;
    if (amenities !== undefined) property.amenities = Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(s => s.trim()).filter(Boolean) : []);
    if (photos) property.photos = photos;
    if (videos) property.videos = videos;
    if (status && req.user.role === 'admin') property.status = status;
    if (!property.owner) property.owner = req.user.id;

    await property.save();
    res.json(property);
  } catch (err) {
    console.error('Error updating property:', err.message);
    res.status(500).send('Server error updating property');
  }
});

// Delete property (Protected - Owner or Admin)
router.delete('/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }

    let property = await Property.findById(req.params.id);

    if (!property) return res.status(404).json({ msg: 'Property not found' });

    if (property.owner && property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to delete this property' });
    }

    const Booking = require('../models/Booking');
    const Room = require('../models/Room');
    if (await Booking.exists({ property: property._id }) || await Room.exists({ property: property._id })) {
      return res.status(409).json({ msg: 'Remove rooms and resolve bookings before deleting this property.' });
    }
    await Property.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Property deleted successfully' });
  } catch (err) {
    console.error('Error deleting property:', err.message);
    res.status(500).send('Server error deleting property');
  }
});

module.exports = router;
