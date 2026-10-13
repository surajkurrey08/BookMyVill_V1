const mongoose = require('mongoose');

// An offer shown as a slide in the website hero. Managed from Admin > Offers.
const siteOfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, trim: true, maxlength: 160, default: '' },
    badge: { type: String, trim: true, maxlength: 24, default: '' },
    ctaLabel: { type: String, trim: true, maxlength: 24, default: '' },
    ctaLink: { type: String, trim: true, maxlength: 300, default: '' },
    imageData: { type: String, default: '', select: false },
    imageVersion: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteOffer', siteOfferSchema);
