const mongoose = require('mongoose');
const { database } = require('../config');

// Owned by review-service. propertyId/ownerId are references by ID only;
// villa and user data stay in their own services.
const FeedbackSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  propertyName: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, index: true },
  guestName: { type: String, required: true },
  guestPhone: { type: String },
  rating: { type: Number, required: true, min: 1, max: 5 },
  reviewText: { type: String, required: true },
  facilitiesUsed: [{ type: String }],
  selectedForHotelPage: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'feedbacks' });

module.exports = database.connection.model('Feedback', FeedbackSchema);
