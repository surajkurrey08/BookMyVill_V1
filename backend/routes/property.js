const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const Room = require('../models/Room');
const { PUBLIC_LISTING, isPublicListing, publicProperty } = require('../services/publicViews');
const accountAuth = require('../middleware/accountAuth');
const { MANAGEMENT_FIELDS, MANAGEMENT_SELECT, LISTING_FIELDS, propertyScope, managementFilters, listingView, requirePropertyAccess, assertPropertyAccess, canAccessProperty, ownerPropertyView } = require('../services/propertyAccess');
const { sendError, HttpError } = require('../utils/validate');
const { storePropertyMedia, mediaOrigin, stayInfo } = require('../services/propertyMedia');
router.use('/media', require('./propertyMediaFiles'));
router.use('/data-entry', require('./dataEntry'));

// Add Property (Protected - Owners only)
router.post('/add', require('../middleware/ownerAuth'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Access denied' });

  let media, createdProperty;
  try {
    if (MANAGEMENT_FIELDS.some(key => Object.hasOwn(req.body, key))) return res.status(403).json({ msg: 'Only authorized admins may change property management.' });
    const { name, type, location, price, mapLink, amenities, photos, videos } = req.body;
    const maxGuests = Number(req.body.maxGuests ?? 2);
    if (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 50) return res.status(400).json({ msg: 'Choose a villa capacity of 1–50 guests.' });
    const newProperty = new Property({
      owner: req.user.id,
      bookingMode: 'ENTIRE',
      listingData: { details: { guestCapacity: maxGuests } },
      name,
      type,
      location,
      price: price ? Math.max(1, Math.abs(parseInt(price) || 10000)) : 10000,
      mapLink: mapLink || '',
      amenities: Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(s => s.trim()).filter(Boolean) : []),
      photos: [],
      videos: [],
      stayInfo: stayInfo(req.body.stayInfo),
      status: 'pending' // Enforce Admin Approval before publishing to public website
    });
    await newProperty.validate();
    media = await storePropertyMedia(photos || [], videos || [], mediaOrigin(req));
    newProperty.photos = media.photos;
    newProperty.videos = media.videos;
    await newProperty.save();
    createdProperty = newProperty;
    await Room.create({ property: newProperty._id, name: 'Entire villa', number: 'ENTIRE', type: 'Entire villa', capacity: maxGuests, baseRate: newProperty.price });
    res.json(newProperty);
  } catch (err) {
    if (createdProperty) await Property.deleteOne({ _id: createdProperty._id });
    if (media) await media.cleanup();
    if (err.name === 'ValidationError') return res.status(400).json({ msg: 'Property name and location are required; check your listing details.' });
    sendError(res, err, 'Property creation');
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
    const properties = await Property.find(PUBLIC_LISTING);
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
    if (!isPublicListing(property)) return res.status(404).json({ msg: 'Property is not published.' });
    res.json(publicProperty(property));
  } catch (err) {
    sendError(res, err, 'Property details');
  }
});

// Update property (Protected - Owner or Admin)
router.put('/:id', require('../middleware/accountAuth'), async (req, res) => {
  let media;
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
    const maxGuests = req.body.maxGuests === undefined ? null : Number(req.body.maxGuests);
    if (maxGuests !== null && (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 50)) throw new HttpError(400, 'Choose a villa capacity of 1–50 guests.');
    if (property.bookingMode === 'ENTIRE' && maxGuests !== null) {
      property.listingData = { ...property.listingData, details: { ...property.listingData?.details, guestCapacity: maxGuests } };
    }
    if (mapLink !== undefined) property.mapLink = mapLink;
    if (amenities !== undefined) property.amenities = Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',').map(s => s.trim()).filter(Boolean) : []);
    if (req.body.facilities !== undefined) property.facilities = Array.isArray(req.body.facilities) ? req.body.facilities : [];
    if (status && req.user.role === 'admin') property.status = status;
    if (!property.owner) property.owner = req.user.id;

    // Optional guest stay-pass details (check-in times, Wi-Fi, house rules…).
    if (req.body.stayInfo && typeof req.body.stayInfo === 'object') {
      property.stayInfo = stayInfo(req.body.stayInfo);
    }

    await property.validate();
    media = await storePropertyMedia(photos, videos, mediaOrigin(req));
    if (media.photos !== undefined) property.photos = media.photos;
    if (media.videos !== undefined) property.videos = media.videos;
    await property.save();
    if (property.bookingMode === 'ENTIRE' && (price !== undefined || maxGuests !== null)) {
      await Room.updateOne({ property: property._id, active: true }, { $set: { ...(price !== undefined && { baseRate: property.price }), ...(maxGuests !== null && { capacity: maxGuests }) } }, { runValidators: true });
    }
    res.json(req.user.role === 'data_entry' ? listingView(property) : property);
  } catch (err) {
    if (media) await media.cleanup();
    if (err.name === 'ValidationError') return res.status(400).json({ msg: 'Check your property listing details.' });
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
