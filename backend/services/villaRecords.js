const Property = require('../models/Property');
const Room = require('../models/Room');
const User = require('../models/User');
const { HttpError, escapeRegex } = require('../utils/validate');
const { ENTIRE_TYPES, ownerInput, villaInput } = require('./villaOnboarding');

// Edit and delete for owners and their villas, shared by the Admin console and
// the Villa Manager panel. Callers check who may act on which record first.
//
// Deleting never destroys history: a villa or owner with bookings, quotations,
// expenses or tourist-register entries can't be deleted (hide, suspend or
// restrict it instead). Operational leftovers (unit, calendar blocks, task
// lists) are removed together with the villa.

const model = name => require(`../models/${name}`);
const ROOM_TYPES = [...ENTIRE_TYPES, 'Hotel', 'Resort'];
const KEPT_RECORDS = 'bookings, quotations or other records that must be kept';

// ------------------------------------------------------------------ villas

// Edits a villa's details (photos and approval/website status are separate).
// Whole-villa listings keep their single bookable unit in step with capacity
// and rates; room-by-room listings keep their rooms as they are.
async function updateVilla(propertyId, body = {}) {
  const current = await Property.findById(propertyId).select('name type location price bookingMode listingData stayInfo').lean();
  if (!current) throw new HttpError(404, 'Villa not found.');
  const entire = current.bookingMode === 'ENTIRE';
  if (!entire && !ROOM_TYPES.includes(body.type)) throw new HttpError(400, `Choose a property type: ${ROOM_TYPES.join(', ')}.`);
  const v = villaInput({ ...body, type: entire ? body.type : 'Villa', photos: undefined });
  const type = entire ? v.type : body.type;

  const details = { ...current.listingData?.details, guestCapacity: v.maxGuests, address: v.address, description: v.description, checkInTime: v.checkInTime, checkOutTime: v.checkOutTime };
  for (const key of ['bedrooms', 'bathrooms']) { if (v[key] === null) delete details[key]; else details[key] = v[key]; }
  const set = {
    name: v.name, type, location: v.location, mapLink: v.mapLink, price: v.price,
    'listingData.details': details, handover: v.handover,
    ...(body.amenities !== undefined && { amenities: v.amenities }),
    ...(body.amenities !== undefined && { amenities: v.amenities }),
    'stayInfo.checkInTime': v.checkInTime, 'stayInfo.checkOutTime': v.checkOutTime, 'stayInfo.wifiName': v.wifiName, 'stayInfo.wifiPassword': v.wifiPassword,
    ...(v.coordinates && { coordinates: v.coordinates })
  };
  await Property.updateOne({ _id: current._id }, { $set: set, ...(!v.coordinates && { $unset: { coordinates: 1 } }) }, { runValidators: true });
  if (entire) await Room.updateOne({ property: current._id, active: { $ne: false } }, { $set: { capacity: v.maxGuests, baseRate: v.price, extraGuestRate: v.extraGuestRate ?? 0 } }, { runValidators: true });
  return {
    before: { name: current.name, type: current.type, location: current.location, price: current.price },
    after: { name: v.name, type, location: v.location, price: v.price }
  };
}

// Why these villas can't be deleted, or null when they can.
async function villaDeleteBlocker(ids) {
  const property = { $in: ids };
  const kept = await Promise.all(['Booking', 'Quotation', 'OwnerExpense', 'TouristRegister'].map(name => model(name).exists({ property })));
  if (kept.some(Boolean)) return KEPT_RECORDS;
  if (await model('CustomerHold').exists({ property, status: { $in: ['held', 'payment_pending', 'confirmed'] } })) return 'a guest checking out right now';
  return null;
}

// Removes villas and their operational leftovers. Call villaDeleteBlocker first.
async function removeVillas(ids) {
  const property = { $in: ids };
  await Promise.all([
    ...['Room', 'RoomNight', 'CustomerHold', 'HousekeepingTask', 'OperationalTask', 'GuestRequest', 'StaffMember'].map(name => model(name).deleteMany({ property })),
    model('Inventory').deleteMany({ propertyId: property }),
    model('Inquiry').updateMany({ property }, { $set: { property: null } }),
    model('CaretakerApplication').updateMany({ property }, { $unset: { property: 1 } })
  ]);
  await Property.deleteMany({ _id: property });
}

async function deleteVilla(propertyId) {
  const property = await Property.findById(propertyId).select('name owner').lean();
  if (!property) throw new HttpError(404, 'Villa not found.');
  const blocker = await villaDeleteBlocker([property._id]);
  if (blocker === KEPT_RECORDS) throw new HttpError(409, `This villa has ${KEPT_RECORDS}. Hide it from the website (or suspend it) instead of deleting it.`);
  if (blocker) throw new HttpError(409, 'A guest is checking out this villa right now. Try again after the hold expires.');
  await removeVillas([property._id]);
  return property;
}

// ------------------------------------------------------------------ owners

async function findOwner(ownerId) {
  const owner = await User.findOne({ _id: ownerId, role: 'owner' }).select('name email phone ownerProfile ownerManagementMode ownerPasswordSetAt').lean();
  if (!owner) throw new HttpError(404, 'Owner not found.');
  return owner;
}

// Edits an owner's contact details. An owner who already has an email keeps
// one (it is their sign-in); lockEmail stops the email changing at all.
async function updateOwner(ownerId, body = {}, { lockEmail = false } = {}) {
  const owner = await findOwner(ownerId);
  const input = ownerInput(lockEmail ? { ...body, email: owner.email || '' } : body, { emailRequired: Boolean(owner.email) });
  if (input.email && input.email !== (owner.email || '').toLowerCase()
      && await User.exists({ _id: { $ne: owner._id }, email: new RegExp(`^${escapeRegex(input.email)}$`, 'i') })) {
    throw new HttpError(409, 'This email is already used by another account.');
  }
  const set = { name: input.name, phone: input.phone, ownerProfile: { ...owner.ownerProfile, ...input.ownerProfile } };
  if (input.email) set.email = input.email;
  await User.updateOne({ _id: owner._id }, { $set: set, ...(!input.email && { $unset: { email: 1 } }) }, { runValidators: true });
  return {
    before: { name: owner.name, email: owner.email || '', phone: owner.phone || '' },
    after: { name: input.name, email: input.email, phone: input.phone }
  };
}

// Deletes an owner account together with all of their villas. Refused while
// any villa or the owner's own sales desk has records that must be kept.
async function deleteOwner(ownerId) {
  const owner = await findOwner(ownerId);
  const ids = await Property.find({ owner: owner._id }).distinct('_id');
  const blocker = ids.length ? await villaDeleteBlocker(ids) : null;
  if (blocker || await model('Quotation').exists({ owner: owner._id })) {
    throw new HttpError(409, blocker && blocker !== KEPT_RECORDS
      ? 'A guest is checking out one of this owner\'s villas right now. Try again after the hold expires.'
      : `This owner's villas have ${KEPT_RECORDS}. Suspend the owner and hide their villas instead of deleting.`);
  }
  if (ids.length) await removeVillas(ids);
  await Promise.all(['Inquiry', 'CrmActivity', 'FollowUp'].map(name => model(name).deleteMany({ owner: owner._id })));
  await User.deleteOne({ _id: owner._id });
  return { ...owner, villas: ids.length };
}

module.exports = { updateVilla, deleteVilla, updateOwner, deleteOwner, findOwner };
