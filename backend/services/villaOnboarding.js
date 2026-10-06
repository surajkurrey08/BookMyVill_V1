const Property = require('../models/Property');
const Room = require('../models/Room');
const { storePropertyMedia } = require('./propertyMedia');
const { HttpError, validEmail, validPhone, cleanText, intInRange } = require('../utils/validate');

// Shared by the Villa Manager and Data Entry panels: validates owner + villa
// forms and creates a villa as ONE bookable "Entire villa" unit (guests always
// book the whole villa, never room by room). New villas wait for Admin's first approval.

const ENTIRE_TYPES = ['Villa', 'Cottage', 'Homestay', 'Apartment'];
const MAX_PHOTOS = 20;
const MANAGEMENT_MODES = ['SELF_MANAGED', 'BOOKMYVILLA_MANAGED'];

function field(value, max, label, required = false) {
  const result = cleanText(value, max);
  if (result === null) throw new HttpError(400, `${label} must be under ${max} characters.`);
  if (required && !result) throw new HttpError(400, `${label} is required.`);
  return result;
}
function longText(value, max, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, `${label} must be under ${max} characters.`);
  return value.trim();
}
function phone(value, label, required = false) {
  const result = field(value, 20, label, required);
  if (result && !validPhone(result)) throw new HttpError(400, `Enter a valid ${label.toLowerCase()}.`);
  return result;
}
function number(value, min, max, label, required = false) {
  if (!required && (value === '' || value === null || value === undefined)) return null;
  const result = intInRange(value, min, max);
  if (result === null) throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  return result;
}
// Pasted URLs and device uploads (data URLs); storePropertyMedia validates each.
function photoList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_PHOTOS) throw new HttpError(400, `Add up to ${MAX_PHOTOS} photos.`);
  return value;
}
function list(value, maxItems, maxLength, label) {
  if (value === undefined || value === null || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(/[\n,]/);
  const clean = items.map(item => cleanText(item, maxLength)).filter(item => item !== '');
  if (clean.some(item => item === null) || clean.length > maxItems) throw new HttpError(400, `Add up to ${maxItems} ${label}, each under ${maxLength} characters.`);
  return [...new Set(clean)];
}

function ownerInput(body = {}, { emailRequired = false } = {}) {
  const email = field(body.email, 120, 'Email').toLowerCase();
  if (emailRequired && !email) throw new HttpError(400, 'Email is required — the owner signs in to the Owner panel with it.');
  if (email && !validEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  return {
    name: field(body.name, 100, 'Owner name', true),
    phone: phone(body.phone, 'Mobile number', true),
    email,
    ownerProfile: {
      whatsapp: phone(body.whatsapp, 'WhatsApp number'),
      address: field(body.address, 300, 'Address'),
      alternateName: field(body.alternateName, 100, 'Alternate contact name'),
      alternatePhone: phone(body.alternatePhone, 'Alternate contact number'),
      notes: field(body.notes, 1000, 'Notes')
    }
  };
}

function villaInput(body = {}) {
  const type = body.type || 'Villa';
  if (!ENTIRE_TYPES.includes(type)) throw new HttpError(400, `Choose a property type: ${ENTIRE_TYPES.join(', ')}.`);
  const mapLink = field(body.mapLink, 500, 'Google Maps link');
  if (mapLink && !/^https?:\/\//i.test(mapLink)) throw new HttpError(400, 'Google Maps link must start with http:// or https://.');
  return {
    name: field(body.name, 120, 'Villa name', true),
    type,
    location: field(body.location, 120, 'Location', true),
    address: field(body.address, 300, 'Villa address'),
    mapLink,
    description: longText(body.description, 3000, 'Description'),
    amenities: list(body.amenities, 40, 60, 'amenities'),
    maxGuests: number(body.maxGuests, 1, 50, 'Maximum guests', true),
    bedrooms: number(body.bedrooms, 0, 50, 'Bedrooms'),
    bathrooms: number(body.bathrooms, 0, 50, 'Bathrooms'),
    price: number(body.price, 1, 10000000, 'Price per night', true),
    extraGuestRate: number(body.extraGuestRate, 0, 1000000, 'Extra guest charge'),
    photos: photoList(body.photos),
    checkInTime: field(body.checkInTime, 40, 'Check-in time'),
    checkOutTime: field(body.checkOutTime, 40, 'Check-out time'),
    wifiName: field(body.wifiName, 60, 'Wi-Fi name'),
    wifiPassword: field(body.wifiPassword, 60, 'Wi-Fi password'),
    handover: {
      keyLocation: field(body.keyLocation, 200, 'Key location'),
      caretakerName: field(body.caretakerName, 100, 'Caretaker name'),
      caretakerPhone: phone(body.caretakerPhone, 'Caretaker phone'),
      notes: field(body.handoverNotes, 1000, 'Handover notes')
    }
  };
}

// Creates the villa (photos saved as files) and its single "Entire villa" unit.
async function createVilla({ origin, ownerId, villa: v, managementMode = 'BOOKMYVILLA_MANAGED', assignedVillaManager = null, assignedDataEntryUser = null }) {
  if (!MANAGEMENT_MODES.includes(managementMode)) throw new HttpError(400, 'Choose who manages this villa.');
  const media = await storePropertyMedia(v.photos, undefined, origin);
  const details = {
    guestCapacity: v.maxGuests,
    ...(v.bedrooms !== null && { bedrooms: v.bedrooms }), ...(v.bathrooms !== null && { bathrooms: v.bathrooms }),
    ...(v.address && { address: v.address }), ...(v.description && { description: v.description }),
    checkInTime: v.checkInTime, checkOutTime: v.checkOutTime
  };
  const property = await Property.create({
    owner: ownerId, name: v.name, type: v.type, location: v.location, mapLink: v.mapLink, price: v.price,
    photos: media.photos, amenities: v.amenities,
    managementMode, assignedVillaManager: managementMode === 'BOOKMYVILLA_MANAGED' ? assignedVillaManager : null, assignedDataEntryUser,
    bookingMode: 'ENTIRE', websiteVisible: true,
    status: 'pending', // Admin approves the first publication
    stayInfo: { checkInTime: v.checkInTime, checkOutTime: v.checkOutTime, wifiName: v.wifiName, wifiPassword: v.wifiPassword },
    handover: v.handover,
    listingData: { details }
  }).catch(async err => { await media.cleanup(); throw err; });
  try {
    await Room.create({ property: property._id, name: 'Entire villa', number: 'ENTIRE', type: 'Entire villa', capacity: v.maxGuests, baseRate: v.price, extraGuestRate: v.extraGuestRate });
  } catch (err) {
    await Property.deleteOne({ _id: property._id });
    await media.cleanup();
    throw err;
  }
  return property;
}

module.exports = { ENTIRE_TYPES, MAX_PHOTOS, field, phone, number, photoList, ownerInput, villaInput, createVilla };
