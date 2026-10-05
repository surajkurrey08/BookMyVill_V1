const Property = require('../models/Property');
const Room = require('../models/Room');
const { HttpError, validId } = require('../utils/validate');
const { MANAGEMENT_SELECT, requirePropertyAccess } = require('./propertyAccess');

const STATES = ['ASSIGNED', 'DRAFT', 'IN_PROGRESS', 'INCOMPLETE', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED'];
const SELECT = `${MANAGEMENT_SELECT} +listingDraft +dataEntryStatus +dataEntryReviewReason +dataEntryRevision +dataEntryUpdatedAt +dataEntryCompletion`;
// Existing owner listing vocabulary; there is no separate amenity master.
const AMENITIES = ['Private Swimming Pool', 'Free High-Speed Wi-Fi', 'Mountain & Valley View', 'Complimentary Breakfast', 'Air Conditioning (AC)', 'Free Private Parking', 'BBQ & Grilling Setup', 'Lawn & Private Garden', '24/7 Power Backup', 'Night Bonfire & Campfire', 'Personal Chef / Caretaker', 'Equipped Kitchen', '24/7 Hot Water', 'Pet Friendly Stay', 'Indoor Games & Carrom', 'CCTV Security', 'Balcony'];
const TYPES = ['Villa', 'Hotel', 'Resort', 'Homestay', 'Apartment', 'Cottage'];
const CATEGORIES = ['Exterior', 'Interior', 'Bedroom', 'Bathroom', 'Kitchen', 'Pool', 'View', 'Parking', 'Other'];
const FIELDS = ['name', 'type', 'location', 'mapLink', 'amenities', 'facilities', 'photos', 'videos', 'details', 'rooms', 'photoCategories'];
const DETAIL_TEXT = { shortDescription: 250, description: 5000, address: 500, city: 80, state: 80, pincode: 6, landmark: 200, checkInTime: 5, checkOutTime: 5, arrivalInstructions: 1000, caretakerInfo: 500, petPolicy: 300, smokingPolicy: 300, partyPolicy: 300, childPolicy: 300 };
const DETAIL_NUMBER = { latitude: [-90, 90], longitude: [-180, 180], guestCapacity: [1, 500], bedrooms: [0, 200], bathrooms: [0, 200], floors: [0, 100], totalRooms: [0, 1000] };
const ROOM_FIELDS = ['_id', 'name', 'number', 'type', 'capacity', 'bedType', 'view', 'sizeSqFt', 'photos', 'amenities'];

function text(value, max, field) {
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, `${field} must be text under ${max} characters.`);
  return value.trim();
}
function list(value, max, length, field) {
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, `Too many ${field}.`);
  return [...new Set(value.map(v => text(v, length, field)).filter(Boolean))];
}
function media(value, kind = 'image') {
  const items = list(value, kind === 'image' ? 24 : 3, kind === 'image' ? 600000 : 2048, 'media items');
  if (items.some(v => !/^https?:\/\//i.test(v) && !/^\/(?!\/)/.test(v) && !(kind === 'image' && /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v)))) throw new HttpError(400, 'Use an HTTP image URL or a JPEG, PNG or WebP upload.');
  return items;
}
function normalizedDraft(body, previous = {}) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !FIELDS.includes(k))) throw new HttpError(403, 'Only assigned listing content can be edited. Pricing, management and operational fields are restricted.');
  const result = { ...previous };
  for (const key of ['name', 'type', 'location', 'mapLink']) if (body[key] !== undefined) result[key] = text(body[key], key === 'mapLink' ? 2048 : 160, key);
  if (body.type !== undefined && !TYPES.includes(body.type)) throw new HttpError(400, 'Choose a supported property type.');
  if (body.mapLink && !/^https?:\/\//i.test(body.mapLink)) throw new HttpError(400, 'Map link must start with https:// or http://.');
  for (const key of ['amenities', 'facilities']) if (body[key] !== undefined) result[key] = list(body[key], 40, 100, key);
  for (const key of ['photos', 'videos']) if (body[key] !== undefined) result[key] = media(body[key], key === 'videos' ? 'video' : 'image');
  if (body.photoCategories !== undefined) {
    if (!Array.isArray(body.photoCategories) || body.photoCategories.length > 24 || body.photoCategories.some(v => !CATEGORIES.includes(v))) throw new HttpError(400, 'Choose valid photo categories.');
    result.photoCategories = body.photoCategories;
  }
  if (body.details !== undefined) {
    const d = body.details;
    const allowed = [...Object.keys(DETAIL_TEXT), ...Object.keys(DETAIL_NUMBER), 'highlights', 'nearbyPlaces'];
    if (!d || Array.isArray(d) || typeof d !== 'object' || Object.keys(d).some(k => !allowed.includes(k))) throw new HttpError(403, 'Only property-level listing details and policies can be edited.');
    result.details = { ...previous.details };
    for (const [key, max] of Object.entries(DETAIL_TEXT)) if (d[key] !== undefined) result.details[key] = text(d[key], max, key);
    if (d.pincode && !/^\d{6}$/.test(d.pincode)) throw new HttpError(400, 'Pincode must contain six digits.');
    for (const key of ['checkInTime', 'checkOutTime']) if (d[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d[key])) throw new HttpError(400, 'Choose valid check-in and check-out times.');
    for (const [key, [min, max]] of Object.entries(DETAIL_NUMBER)) if (d[key] !== undefined) {
      if (d[key] === '' || d[key] === null) { result.details[key] = null; continue; }
      const value = Number(d[key]);
      if (!Number.isFinite(value) || value < min || value > max || (!['latitude', 'longitude'].includes(key) && !Number.isInteger(value))) throw new HttpError(400, `Enter a valid ${key}.`);
      result.details[key] = value;
    }
    if (d.highlights !== undefined) result.details.highlights = list(d.highlights, 12, 180, 'highlights');
    if (d.nearbyPlaces !== undefined) {
      if (!Array.isArray(d.nearbyPlaces) || d.nearbyPlaces.length > 20) throw new HttpError(400, 'Enter up to 20 nearby places.');
      result.details.nearbyPlaces = d.nearbyPlaces.map(place => {
        if (!place || Object.keys(place).some(k => !['name', 'category', 'distanceKm', 'travelMinutes'].includes(k))) throw new HttpError(400, 'Invalid nearby place.');
        const category = text(place.category || 'Attraction', 30, 'category');
        if (!['Attraction', 'Restaurant', 'Hospital', 'Fuel Station', 'Transport'].includes(category)) throw new HttpError(400, 'Choose a nearby place category.');
        const numbers = {};
        for (const key of ['distanceKm', 'travelMinutes']) { const value = Number(place[key] || 0); if (!Number.isFinite(value) || value < 0 || value > 10000) throw new HttpError(400, 'Invalid distance or travel time.'); numbers[key] = value; }
        return { name: text(place.name || '', 120, 'Place name'), category, ...numbers };
      });
    }
  }
  if (body.rooms !== undefined) {
    if (!Array.isArray(body.rooms) || body.rooms.length > 200) throw new HttpError(400, 'Enter up to 200 rooms or units.');
    const numbers = new Set(), ids = new Set();
    result.rooms = body.rooms.map(room => {
      if (!room || Object.keys(room).some(k => !ROOM_FIELDS.includes(k))) throw new HttpError(403, 'Room rates, operational state and property assignments cannot be edited.');
      const r = {};
      if (room._id) { if (!validId(room._id) || ids.has(room._id)) throw new HttpError(400, 'Invalid or duplicate room ID.'); ids.add(room._id); r._id = room._id; }
      for (const [key, max] of Object.entries({ name: 80, number: 30, type: 60, bedType: 60, view: 80 })) r[key] = text(room[key] || '', max, key);
      if (r.number && numbers.has(r.number)) throw new HttpError(400, 'Room numbers must be unique.');
      numbers.add(r.number);
      for (const [key, max] of [['capacity', 50], ['sizeSqFt', 50000]]) { const n = room[key] === '' || room[key] == null ? null : Number(room[key]); if (n !== null && (!Number.isFinite(n) || n < (key === 'capacity' ? 1 : 0) || n > max || (key === 'capacity' && !Number.isInteger(n)))) throw new HttpError(400, `Invalid room ${key}.`); r[key] = n; }
      r.photos = media(room.photos || []); r.amenities = list(room.amenities || [], 30, 100, 'room amenities');
      return r;
    });
  }
  if (JSON.stringify(result).length > 8000000) throw new HttpError(400, 'Listing media is too large. Upload fewer or smaller images.');
  return result;
}
const roomContent = r => Object.fromEntries(ROOM_FIELDS.filter(k => r[k] !== undefined).map(k => [k, k === '_id' ? String(r[k]) : r[k]]));
function currentDraft(property, rooms) {
  if (property.listingDraft) return property.listingDraft;
  return { name: property.name, type: property.type, location: property.location, mapLink: property.mapLink || '', amenities: property.amenities || [], facilities: property.facilities || [], photos: property.photos || [], videos: property.videos || [], photoCategories: property.listingData?.photoCategories || [], details: { ...(property.listingData?.details || {}), checkInTime: property.listingData?.details?.checkInTime || property.stayInfo?.checkInTime || '', checkOutTime: property.listingData?.details?.checkOutTime || property.stayInfo?.checkOutTime || '' }, rooms: rooms.map(roomContent) };
}
function completion(draft, price) {
  const d = draft.details || {};
  const rooms = draft.rooms || [];
  const roomValid = r => Boolean(r.name && r.number && r.type && Number.isInteger(r.capacity) && r.capacity > 0);
  const checks = [
    { key: 'basic', label: 'Basic information', valid: Boolean(draft.name && draft.type && d.shortDescription && d.description) },
    { key: 'location', label: 'Address & location', valid: Boolean(draft.location && d.address && d.city && d.state && /^\d{6}$/.test(d.pincode || '') && draft.mapLink) },
    { key: 'details', label: 'Capacity & property details', valid: Boolean(d.guestCapacity > 0 && d.bathrooms > 0 && (['Villa', 'Homestay', 'Apartment', 'Cottage'].includes(draft.type) ? d.bedrooms > 0 : d.totalRooms > 0)) },
    { key: 'amenities', label: 'Amenities', valid: Boolean(draft.amenities?.length) },
    { key: 'media', label: 'Property photos', valid: Boolean(draft.photos?.length) },
    { key: 'rooms', label: 'Rooms / units', valid: rooms.length > 0 && rooms.every(roomValid) },
    { key: 'policies', label: 'Property policies', valid: Boolean(d.checkInTime && d.checkOutTime && d.petPolicy && d.smokingPolicy && d.partyPolicy && d.childPolicy) },
    { key: 'pricing', label: 'Authorized listing rate', valid: Number(price) > 0 }
  ];
  const count = checks.filter(c => c.valid).length;
  return { percent: Math.round(count / checks.length * 100), complete: count === checks.length, checks };
}
function statusOf(p) { return p.dataEntryStatus || (p.status === 'under_review' ? 'CHANGES_REQUIRED' : 'ASSIGNED'); }
async function assigned(user, id) {
  await requirePropertyAccess(user, id, 'listing');
  const p = await Property.findOne({ _id: id, assignedDataEntryUser: user.id }).select(SELECT).populate('owner', 'name');
  if (!p) throw new HttpError(404, 'Assignment removed or property not found.');
  return p;
}
async function view(p) {
  const rooms = await Room.find({ property: p._id }).lean();
  const draft = currentDraft(p, rooms);
  return { _id: p._id, owner: p.owner ? { _id: p.owner._id || p.owner, name: p.owner.name || 'Property owner' } : null, managementMode: p.managementMode || 'SELF_MANAGED', status: p.status, dataStatus: statusOf(p), reviewReason: p.dataEntryReviewReason || '', revision: p.dataEntryRevision || 0, updatedAt: p.dataEntryUpdatedAt || p.createdAt, draft, completion: completion(draft, p.price), pricing: { baseRate: p.price, editable: false }, permissions: { edit: !['READY_FOR_REVIEW', 'COMPLETED'].includes(statusOf(p)), pricing: false }, roomRates: Object.fromEntries(rooms.map(r => [String(r._id), r.baseRate])) };
}
async function saveDraft(user, id, body, revision) {
  const p = await assigned(user, id);
  if (['READY_FOR_REVIEW', 'COMPLETED'].includes(statusOf(p))) throw new HttpError(409, 'This listing is with Admin or completed. Ask Admin to request changes before editing.');
  if (revision !== undefined && revision !== (p.dataEntryRevision || 0)) throw new HttpError(409, 'This draft changed in another session. Reload before saving.');
  const rooms = await Room.find({ property: p._id }).lean();
  const draft = normalizedDraft(body, currentDraft(p, rooms));
  const existingIds = new Set(rooms.map(r => String(r._id)));
  if (draft.rooms.some(r => r._id && !existingIds.has(r._id)) || rooms.some(r => !draft.rooms.some(d => d._id === String(r._id)))) throw new HttpError(403, 'Existing rooms must remain linked to this property. Room deletion is an operational action.');
  const state = statusOf(p) === 'CHANGES_REQUIRED' ? 'CHANGES_REQUIRED' : completion(draft, p.price).complete ? 'IN_PROGRESS' : 'INCOMPLETE';
  const saved = await Property.findOneAndUpdate({ _id: p._id, assignedDataEntryUser: user.id, ...revisionFilter(p) }, { $set: { listingDraft: draft, dataEntryStatus: state, dataEntryCompletion: completion(draft, p.price).percent, dataEntryUpdatedAt: new Date() }, $inc: { dataEntryRevision: 1 } }, { new: true }).select(SELECT).populate('owner', 'name');
  if (!saved) throw new HttpError(409, 'Assignment or draft changed. Reload before saving.');
  return view(saved);
}

function revisionFilter(p) { return p.dataEntryRevision ? { dataEntryRevision: p.dataEntryRevision } : { $or: [{ dataEntryRevision: 0 }, { dataEntryRevision: { $exists: false } }] }; }
module.exports = { STATES, SELECT, AMENITIES, TYPES, CATEGORIES, FIELDS, assigned, view, currentDraft, completion, statusOf, saveDraft, roomContent, revisionFilter };
