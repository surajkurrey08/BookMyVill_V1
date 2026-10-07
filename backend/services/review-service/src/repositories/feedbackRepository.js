const Feedback = require('../models/Feedback');

const PUBLIC_FIELDS = '_id guestName rating reviewText facilitiesUsed createdAt';

module.exports = {
  forProperties: ids => Feedback.find({ propertyId: { $in: ids } }).sort({ createdAt: -1 }).lean(),
  all: () => Feedback.find().sort({ createdAt: -1 }).lean(),
  publishedForProperty: id => Feedback.find({ propertyId: id, selectedForHotelPage: true }).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean(),
  findById: id => Feedback.findById(id),
  create: data => Feedback.create(data),
  remove: id => Feedback.findByIdAndDelete(id)
};
