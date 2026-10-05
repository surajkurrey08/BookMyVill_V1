const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const { publicProperty } = require('../services/publicViews');
const accountAuth = require('../middleware/accountAuth');
const { MANAGEMENT_FIELDS, MANAGEMENT_SELECT, LISTING_FIELDS, propertyScope, managementFilters, listingView, requirePropertyAccess, assertPropertyAccess, canAccessProperty, ownerPropertyView } = require('../services/propertyAccess');
const { sendError } = require('../utils/validate');
router.use('/data-entry', require('./dataEntry'));

// Add Property (Protected - Owners only)
router.post('/add', require('../middleware/ownerAuth'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Access denied' });

  try {
    if (MANAGEMENT_FIELDS.some(key => Object.hasOwn(req.body, key))) return res.status(403).json({ msg: 'Only authorized admins may change property management.' });
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
router.get('/my-properties', accountAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable.' });
  }
  try {
    if (!['owner', 'villa_manager', 'data_entry', 'admin'].includes(req.user.role)) return res.status(403).json({ msg: 'Property account access required.' });
    const access = req.user.role === 'data_entry' ? 'listing' : 'report';
    const properties = await Property.find({ $and: [propertyScope(req.user, access), managementFilters(req.query)] }).select(MANAGEMENT_SELECT).sort({ createdAt: -1 });
    res.json(req.user.role === 'data_entry' ? properties.map(listingView) : req.user.role === 'owner' ? properties.map(property => ownerPropertyView(req.user, property)) : properties);
  } catch (err) {
    sendError(res, err, 'Property list');
  }
});

// Get all properties (Public - Only Admin Approved Properties)
router.get('/all', async (req, res) => {
  try {
    const properties = await Property.find({ status: 'approved' });
    res.json(properties.map(publicProperty));
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get single property details
router.get('/:id', (req, res, next) => {
  // Existing public reads remain public. A supplied session must be valid and
  // is required for internal/unpublished listing access.
  if (req.header('x-auth-token') || req.header('authorization')) return accountAuth(req, res, next);
  next();
}, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }
    let property = await Property.findById(req.params.id).select(req.user && req.user.role !== 'user' ? MANAGEMENT_SELECT : '').populate('owner', 'name email phone');
    if (req.user && req.user.role !== 'user' && (req.user.role !== 'owner' || canAccessProperty(req.user, property, 'report'))) {
      assertPropertyAccess(req.user, property, req.user.role === 'data_entry' ? 'listing' : 'report');
      return res.json(req.user.role === 'data_entry' ? listingView(property) : req.user.role === 'owner' ? ownerPropertyView(req.user, property) : property);
    }
    if (!property) return res.status(404).json({ msg: 'Property not found' });
    if (property.status !== 'approved') return res.status(404).json({ msg: 'Property is not published.' });
    res.json(publicProperty(property));
  } catch (err) {
    sendError(res, err, 'Property details');
  }
});

// Update property (Protected - Owner or Admin)
router.put('/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }

    if (MANAGEMENT_FIELDS.some(key => Object.hasOwn(req.body, key))) return res.status(403).json({ msg: 'Use the authorized admin management operation to change management mode or assignments.' });
    const property = await requirePropertyAccess(req.user, req.params.id, req.user.role === 'data_entry' ? 'listing' : 'operate');
    if (req.user.role === 'data_entry' && Object.keys(req.body).some(key => !LISTING_FIELDS.includes(key))) return res.status(403).json({ msg: 'Data Entry accounts may only update listing data.' });
    if (req.user.role === 'data_entry') {
      const draft = await require('../services/dataEntry').saveDraft(req.user, req.params.id, req.body);
      return res.json({ _id: property._id, ...Object.fromEntries(LISTING_FIELDS.map(key => [key, draft.draft[key]])), status: property.status });
    }

    const { name, type, location, price, mapLink, amenities, photos, videos, status } = req.body;
    if (name) property.name = name;
    if (type) property.type = type;
    if (location) property.location = location;
    if (price) property.price = Math.max(1, Math.abs(parseInt(price) || 10000));
    if (mapLink !== undefined) property.mapLink = mapLink;
    if (amenities !== undefined) property.amenities = Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(s => s.trim()).filter(Boolean) : []);
    if (req.body.facilities !== undefined) property.facilities = Array.isArray(req.body.facilities) ? req.body.facilities : [];
    if (photos) property.photos = photos;
    if (videos) property.videos = videos;
    if (status && req.user.role === 'admin') property.status = status;
    if (!property.owner) property.owner = req.user.id;

    // Optional guest stay-pass details (check-in times, Wi-Fi, house rules…).
    if (req.body.stayInfo && typeof req.body.stayInfo === 'object') {
      const s = req.body.stayInfo;
      const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
      property.stayInfo = {
        checkInTime: str(s.checkInTime, 40),
        checkOutTime: str(s.checkOutTime, 40),
        wifiName: str(s.wifiName, 60),
        wifiPassword: str(s.wifiPassword, 60),
        houseRules: Array.isArray(s.houseRules) ? s.houseRules.map(r => String(r).slice(0, 160)).filter(Boolean).slice(0, 20) : (property.stayInfo?.houseRules || []),
        arrivalNotes: str(s.arrivalNotes, 1000),
        foodInfo: str(s.foodInfo, 1000)
      };
    }

    await property.save();
    res.json(req.user.role === 'data_entry' ? listingView(property) : property);
  } catch (err) {
    sendError(res, err, 'Property update');
  }
});

// Delete property (Protected - Owner or Admin)
router.delete('/:id', require('../middleware/accountAuth'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ msg: 'Invalid property ID format' });
    }

    const property = await requirePropertyAccess(req.user, req.params.id);
    if (req.user.role === 'villa_manager') return res.status(403).json({ msg: 'Villa Managers cannot delete properties.' });

    const Booking = require('../models/Booking');
    const Room = require('../models/Room');
    if (await Booking.exists({ property: property._id }) || await Room.exists({ property: property._id })) {
      return res.status(409).json({ msg: 'Remove rooms and resolve bookings before deleting this property.' });
    }
    await Property.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Property deleted successfully' });
  } catch (err) {
    sendError(res, err, 'Property deletion');
  }
});

module.exports = router;
