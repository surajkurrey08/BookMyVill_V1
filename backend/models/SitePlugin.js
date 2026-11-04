const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  key: { type: String, enum: ['omniflow'], required: true, unique: true, immutable: true },
  enabled: { type: Boolean, default: false },
  frontendUrl: { type: String, default: '', maxlength: 2048 },
  backendUrl: { type: String, default: '', maxlength: 2048 },
  widgetKey: { type: String, default: '', maxlength: 260 },
  revision: { type: Number, default: 1 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SitePlugin', schema);
