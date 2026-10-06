const GuideArea = require('../models/GuideArea');
const LocalGuide = require('../models/LocalGuide');
const { HttpError, validId } = require('../utils/validate');

// Villas match a guide area by location name ("Mahabaleshwar", " mahabaleshwar ").
const areaKey = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

// The guide option a guest can add at checkout for this villa, or null when the
// villa's location has no active area with at least one active guide.
async function guideOffer(property) {
  const area = await GuideArea.findOne({ key: areaKey(property?.location), active: true }).select('_id name dailyRate').lean();
  if (!area || !await LocalGuide.exists({ area: area._id, active: true })) return null;
  return { areaId: area._id, area: area.name, dailyRate: area.dailyRate };
}

async function bookingGuideArea(booking, property) {
  if (!booking?.guide?.requested || booking.status !== 'confirmed' || booking.paymentStatus !== 'paid' || booking.stayStatus === 'checked_out') throw new HttpError(409, 'Guide assignment requires a paid, confirmed booking with a guide request and an upcoming or current stay.');
  return GuideArea.findOne({ key: areaKey(property?.location) }).select('_id name').lean();
}

async function assignBookingGuide(booking, area, guideId, performedBy) {
  if (!area || !validId(guideId) || !await LocalGuide.exists({ _id: guideId, area: area._id, active: true })) throw new HttpError(400, 'Choose an active guide from the villa location.');
  const result = await require('../models/Booking').updateOne({ _id: booking._id, status: 'confirmed', paymentStatus: 'paid', stayStatus: { $ne: 'checked_out' }, 'guide.requested': true }, { $set: { 'guide.assigned': guideId, 'guide.assignedAt': new Date() }, $push: { actionHistory: { action: 'Local Guide Assigned', performedBy, reason: `Guide ${guideId}` } } });
  if (!result.matchedCount) throw new HttpError(409, 'The booking changed. Refresh before assigning a guide.');
  return { _id: booking._id, guide: guideId };
}

module.exports = { areaKey, guideOffer, bookingGuideArea, assignBookingGuide };
