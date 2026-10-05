const Property = require('../models/Property');
const mongoose = require('mongoose');
const { hasPermission } = require('./adminRbac');
const { HttpError, validId } = require('../utils/validate');

const MANAGEMENT_MODES = ['SELF_MANAGED', 'BOOKMYVILLA_MANAGED'];
const MANAGEMENT_FIELDS = ['managementMode', 'assignedVillaManager', 'assignedDataEntryUser'];
const MANAGEMENT_SELECT = '+assignedVillaManager +assignedDataEntryUser';
const LISTING_FIELDS = ['name', 'type', 'location', 'mapLink', 'amenities', 'facilities', 'photos', 'videos'];
const idOf = value => String(value?._id || value?.id || value || '');
const managementMode = property => property.managementMode === undefined ? 'SELF_MANAGED' : property.managementMode;
const active = user => user && (['villa_manager', 'data_entry'].includes(user.role)
  ? ['active', 'approved'].includes(user.status || 'active')
  : !['pending', 'rejected', 'suspended'].includes(user.status));

// Ownership, reporting, listing work and operational rights are separate.
// Callers pass the account loaded by authentication, never body-supplied roles.
function canManageProperty(user, property) {
  if (!active(user) || !property) return false;
  if (user.role === 'admin') return hasPermission(user, 'properties.manage');
  if (user.role === 'owner') return idOf(property.owner) === idOf(user) && managementMode(property) === 'SELF_MANAGED';
  return user.role === 'villa_manager' && managementMode(property) === 'BOOKMYVILLA_MANAGED' && idOf(property.assignedVillaManager) === idOf(user);
}

function canAccessProperty(user, property, access = 'operate') {
  if (!active(user) || !property) return false;
  if (access === 'operate') return canManageProperty(user, property);
  if (access === 'listing') return user.role === 'data_entry' ? ['active', 'approved'].includes(user.status || 'active') && idOf(property.assignedDataEntryUser) === idOf(user) : canManageProperty(user, property);
  if (access === 'report') {
    if (user.role === 'admin') return hasPermission(user, 'properties.view');
    return (user.role === 'owner' && idOf(property.owner) === idOf(user)) || canManageProperty(user, property);
  }
  return false;
}

function propertyScope(user, access = 'operate') {
  if (!active(user)) return { _id: { $in: [] } };
  if (user.role === 'admin') return hasPermission(user, access === 'report' ? 'properties.view' : 'properties.manage') ? {} : { _id: { $in: [] } };
  if (user.role === 'owner') return access === 'report' ? { owner: idOf(user) } : { owner: idOf(user), $or: [{ managementMode: 'SELF_MANAGED' }, { managementMode: { $exists: false } }] };
  if (user.role === 'villa_manager') return { managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: idOf(user) };
  if (user.role === 'data_entry' && access === 'listing') return ['active', 'approved'].includes(user.status || 'active') ? { assignedDataEntryUser: idOf(user) } : { _id: { $in: [] } };
  return { _id: { $in: [] } };
}

function assertPropertyAccess(user, property, access = 'operate') {
  if (!property) throw new HttpError(404, 'Property not found.');
  if (!canAccessProperty(user, property, access)) {
    const own = user?.role === 'owner' && idOf(property.owner) === idOf(user);
    throw new HttpError(own || user?.role === 'admin' ? 403 : 404, own ? 'This property is managed by BookMyVilla. Operational changes require its assigned Villa Manager.' : 'Property access denied.');
  }
  return property;
}

async function requirePropertyAccess(user, propertyId, access = 'operate') {
  if (propertyId instanceof mongoose.Types.ObjectId) propertyId = String(propertyId);
  if (!validId(propertyId)) throw new HttpError(400, 'Invalid property ID.');
  return assertPropertyAccess(user, await Property.findById(propertyId).select(MANAGEMENT_SELECT), access);
}

// Owner-wide catalog entries also affect managed properties. Preserve the old
// global behavior for self-managed portfolios, but require explicit selection
// when an owner also has company-managed properties.
async function requireOwnerPropertySelection(owner, ids = []) {
  if (!Array.isArray(ids) || ids.some(id => !validId(String(id)))) throw new HttpError(400, 'Invalid property selection.');
  const unique = [...new Set(ids.map(String))];
  const properties = await Property.find({ owner, ...(unique.length && { _id: { $in: unique } }) }).select(MANAGEMENT_SELECT);
  if (unique.length && properties.length !== unique.length) throw new HttpError(404, 'One of the selected properties is not in your account.');
  for (const property of properties) assertPropertyAccess({ id: owner, role: 'owner' }, property);
  return unique.length ? properties.map(property => property._id) : [];
}

function managementFilters(query) {
  const filter = {};
  if (query.managementMode !== undefined) {
    if (!MANAGEMENT_MODES.includes(query.managementMode)) throw new HttpError(400, 'Invalid management mode filter.');
    if (query.managementMode === 'SELF_MANAGED') filter.$or = [{ managementMode: 'SELF_MANAGED' }, { managementMode: { $exists: false } }];
    else filter.managementMode = query.managementMode;
  }
  for (const key of MANAGEMENT_FIELDS.slice(1)) {
    if (query[key] !== undefined) {
      if (query[key] === 'unassigned') { filter[key] = null; continue; }
      if (typeof query[key] !== 'string' || !validId(query[key])) throw new HttpError(400, `Invalid ${key} filter.`);
      filter[key] = query[key];
    }
  }
  return filter;
}

function listingView(property) {
  const doc = property.toObject ? property.toObject() : property;
  return Object.fromEntries(['_id', ...LISTING_FIELDS, 'status', 'managementMode', 'assignedDataEntryUser', 'createdAt'].filter(key => doc[key] !== undefined).map(key => [key, doc[key]]));
}

// Owner-facing reports retain property visibility without internal assignments.
function ownerPropertyView(user, property) {
  const value = property.toObject ? property.toObject() : { ...property };
  value.managementMode = managementMode(value);
  value.canOperate = canManageProperty(user, value);
  delete value.assignedVillaManager;
  delete value.assignedDataEntryUser;
  return value;
}

module.exports = { MANAGEMENT_MODES, MANAGEMENT_FIELDS, MANAGEMENT_SELECT, LISTING_FIELDS, managementMode, canManageProperty, canAccessProperty, propertyScope, assertPropertyAccess, requirePropertyAccess, requireOwnerPropertySelection, managementFilters, listingView, ownerPropertyView };
