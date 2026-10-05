const mongoose = require('mongoose');
const AdminAudit = require('../models/AdminAudit');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const { HttpError, cleanText } = require('../utils/validate');
const { hasPermission } = require('./adminRbac');
const { MANAGEMENT_MODES, MANAGEMENT_FIELDS, MANAGEMENT_SELECT, managementMode } = require('./propertyAccess');

// Shared admin operations. Admin never writes entity status directly from a
// route; it goes through these so the state machine, impact and audit are
// consistent for any caller.

async function recordAudit(admin, entry) {
  return AdminAudit.create({
    actor: admin._id, actorName: admin.name || admin.email || 'Admin',
    ip: entry.ip || '', ...entry
  });
}

// Confirmed future bookings that a property-level action would affect.
async function propertyImpact(propertyId) {
  const now = new Date();
  const [futureBookings, imminent] = await Promise.all([
    Booking.countDocuments({ property: propertyId, status: 'confirmed', checkOut: { $gte: now } }),
    Booking.countDocuments({ property: propertyId, status: 'confirmed', stayStatus: { $ne: 'checked_out' }, checkIn: { $gte: now, $lt: new Date(+now + 7 * 86400000) } })
  ]);
  return { futureBookings, checkingInWithin7Days: imminent };
}

const PROPERTY_TRANSITIONS = {
  approve: { to: 'approved', from: ['pending', 'under_review', 'suspended', 'rejected'], needsReason: false },
  request_changes: { to: 'under_review', from: ['pending', 'under_review', 'approved'], needsReason: true },
  reject: { to: 'rejected', from: ['pending', 'under_review', 'approved'], needsReason: true },
  suspend: { to: 'suspended', from: ['approved'], needsReason: true },
  unsuspend: { to: 'approved', from: ['suspended'], needsReason: false }
};

async function reviewProperty(admin, propertyId, action, reasonRaw, { ip } = {}) {
  const rule = PROPERTY_TRANSITIONS[action];
  if (!rule) throw new HttpError(400, 'Unknown property review action.');
  const property = await Property.findById(propertyId).select('+listingDraft +dataEntryStatus +assignedDataEntryUser');
  if (!property) throw new HttpError(404, 'Property not found.');
  const from = property.status;
  if (!rule.from.includes(from)) throw new HttpError(409, `A ${from} property cannot be ${action.replace('_', ' ')}d.`);
  const reason = cleanText(reasonRaw, 500);
  if (reason === null) throw new HttpError(400, 'Reason is too long.');
  if (rule.needsReason && !reason) throw new HttpError(400, 'A reason is required for this action (it is kept in the audit trail).');
  if (action === 'approve' && property.listingDraft && property.dataEntryStatus !== 'READY_FOR_REVIEW') throw new HttpError(409, 'Data Entry must submit a completed listing before it can be approved.');

  // Optimistic guard so two admins cannot apply conflicting transitions.
  const dataEntryReview = property.assignedDataEntryUser || property.listingDraft;
  const entryUpdate = dataEntryReview && ['approve', 'request_changes', 'reject'].includes(action) ? { dataEntryStatus: action === 'approve' ? 'COMPLETED' : 'CHANGES_REQUIRED', dataEntryReviewReason: action === 'approve' ? '' : reason, dataEntryUpdatedAt: new Date() } : {};
  const updated = await Property.findOneAndUpdate({ _id: property._id, status: from }, { $set: { status: rule.to, ...entryUpdate }, ...(dataEntryReview && { $inc: { dataEntryRevision: 1 } }) }, { new: true });
  if (!updated) throw new HttpError(409, 'This property changed while you were reviewing it. Refresh and try again.');
  const impact = await propertyImpact(property._id);
  await recordAudit(admin, {
    action: `property.${action}`, entityType: 'property', entityId: property._id, entityLabel: property.name,
    before: { status: from }, after: { status: rule.to }, reason, meta: { impact }, ip
  });
  return { property: updated, impact };
}

const ACCOUNT_ACTIONS = {
  suspend: { status: 'suspended', needsReason: true, roles: ['owner', 'user'] },
  restrict: { status: 'restricted', needsReason: true, roles: ['owner', 'user'] },
  activate: { status: 'active', needsReason: false, roles: ['owner', 'user'] }
};

async function setAccountStatus(admin, userId, action, reasonRaw, { ip } = {}) {
  const rule = ACCOUNT_ACTIONS[action];
  if (!rule) throw new HttpError(400, 'Unknown account action.');
  const user = await User.findById(userId).select('_id name email role status');
  if (!user) throw new HttpError(404, 'Account not found.');
  if (user.role === 'admin') throw new HttpError(403, 'Admin accounts are managed under the Admin Team section.');
  if (!rule.roles.includes(user.role)) throw new HttpError(400, 'This action does not apply to this account.');
  const reason = cleanText(reasonRaw, 500);
  if (reason === null) throw new HttpError(400, 'Reason is too long.');
  if (rule.needsReason && !reason) throw new HttpError(400, 'A reason is required for this action.');
  const from = user.status;
  if (from === rule.status) throw new HttpError(409, `This account is already ${rule.status}.`);
  const updated = await User.findOneAndUpdate({ _id: user._id, status: from }, { $set: { status: rule.status, statusReason: reason } }, { new: true }).select('-password');
  if (!updated) throw new HttpError(409, 'This account changed while you were editing. Refresh and try again.');
  await recordAudit(admin, {
    action: `account.${action}`, entityType: user.role === 'owner' ? 'owner' : 'customer', entityId: user._id, entityLabel: user.name || user.email,
    before: { status: from }, after: { status: rule.status }, reason, ip
  });
  return updated;
}

async function setAdminRole(admin, targetId, adminRole, extraPermissions, { ip } = {}) {
  const { ROLE_PERMISSIONS } = require('./adminRbac');
  if (adminRole !== null && !ROLE_PERMISSIONS[adminRole]) throw new HttpError(400, 'Unknown admin role.');
  const target = await User.findById(targetId).select('_id name email role adminRole adminPermissions');
  if (!target || target.role !== 'admin') throw new HttpError(404, 'Admin team member not found.');
  if (String(target._id) === String(admin._id) && adminRole !== 'super_admin' && adminRole !== null) {
    throw new HttpError(409, 'You cannot lower your own access level.');
  }
  const before = { adminRole: target.adminRole, adminPermissions: target.adminPermissions };
  const { PERMISSIONS } = require('./adminRbac');
  const perms = Array.isArray(extraPermissions) ? [...new Set(extraPermissions.filter(p => PERMISSIONS.includes(p)))] : target.adminPermissions;
  target.adminRole = adminRole;
  target.adminPermissions = perms;
  await target.save();
  await recordAudit(admin, {
    action: 'team.role_change', entityType: 'admin', entityId: target._id, entityLabel: target.name || target.email,
    before, after: { adminRole, adminPermissions: perms }, ip
  });
  return target;
}

async function setPropertyManagement(admin, propertyId, changes, { ip } = {}) {
  if (!hasPermission(admin, 'properties.manage')) throw new HttpError(403, 'Property management permission required.');
  if (!mongoose.isValidObjectId(propertyId)) throw new HttpError(400, 'Invalid property ID.');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).some(key => !MANAGEMENT_FIELDS.includes(key))) {
    throw new HttpError(400, 'Supply management mode or management assignments only.');
  }
  const property = await Property.findById(propertyId).select(MANAGEMENT_SELECT).lean();
  if (!property) throw new HttpError(404, 'Property not found.');
  const before = {
    managementMode: managementMode(property),
    assignedVillaManager: property.assignedVillaManager ? String(property.assignedVillaManager) : null,
    assignedDataEntryUser: property.assignedDataEntryUser ? String(property.assignedDataEntryUser) : null,
  };
  const after = { ...before, ...changes };
  if (!MANAGEMENT_MODES.includes(after.managementMode)) throw new HttpError(400, 'Invalid property management mode.');
  if (after.managementMode === 'SELF_MANAGED') {
    if (changes.assignedVillaManager != null) throw new HttpError(400, 'Villa Managers can only be assigned to BookMyVilla-managed properties.');
    after.assignedVillaManager = null;
  }
  for (const [field, role] of [['assignedVillaManager', 'villa_manager'], ['assignedDataEntryUser', 'data_entry']]) {
    if (after[field] !== null) {
      if (typeof after[field] !== 'string' || !/^[a-f\d]{24}$/i.test(after[field])) throw new HttpError(400, `Invalid ${field} ID.`);
      const account = await User.findOne({ _id: after[field], role, status: { $in: ['active', 'approved'] } }).select('_id');
      if (!account) throw new HttpError(400, `Assignment requires an active ${role.replace('_', ' ')} account.`);
      after[field] = String(account._id);
    }
  }
  if (MANAGEMENT_FIELDS.every(key => before[key] === after[key])) return Property.findById(propertyId).select(MANAGEMENT_SELECT);
  if ((before.managementMode !== after.managementMode || before.assignedVillaManager !== after.assignedVillaManager) &&
      await Booking.exists({ property: property._id, stayStatus: 'in_house' })) {
    throw new HttpError(409, 'Finish the active stay before transferring operational responsibility. Existing bookings and tasks are preserved.');
  }
  // Guard all previous management fields, including legacy absent values.
  const guard = { _id: property._id };
  for (const field of MANAGEMENT_FIELDS) guard[field] = property[field] === undefined ? { $exists: false } : property[field];
  const updated = await Property.findOneAndUpdate(guard, { $set: after }, { new: true, runValidators: true }).select(MANAGEMENT_SELECT);
  if (!updated) throw new HttpError(409, 'Property management changed while you were editing. Refresh and try again.');
  await recordAudit(admin, { action: 'property.management_change', entityType: 'property', entityId: property._id, entityLabel: property.name, before, after, ip });
  return updated;
}

module.exports = { recordAudit, propertyImpact, reviewProperty, setAccountStatus, setAdminRole, setPropertyManagement, PROPERTY_TRANSITIONS, ACCOUNT_ACTIONS };
