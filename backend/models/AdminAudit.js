const mongoose = require('mongoose');

// Immutable record of a meaningful admin action. There is intentionally no
// update or delete path for these documents: the audit trail is append-only so
// it can be trusted in disputes. `before`/`after` capture the changed fields.
const AdminAuditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, default: '' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  entityLabel: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: undefined },
  after: { type: mongoose.Schema.Types.Mixed, default: undefined },
  reason: { type: String, default: '', maxlength: 500 },
  meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

AdminAuditSchema.index({ createdAt: -1 });
AdminAuditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AdminAuditSchema.index({ actor: 1, createdAt: -1 });

// Hard-stop any attempt to mutate an existing audit entry.
const freeze = function (next) { next(new Error('Audit log entries are immutable.')); };
AdminAuditSchema.pre('findOneAndUpdate', freeze);
AdminAuditSchema.pre('updateOne', freeze);
AdminAuditSchema.pre('updateMany', freeze);
AdminAuditSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Audit log entries are immutable.'));
  next();
});

module.exports = mongoose.model('AdminAudit', AdminAuditSchema);
