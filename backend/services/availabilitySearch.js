const Property = require('../models/Property');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const { activeNightFilter } = require('./inventory');
const holdLocks = require('./holdLocks');
const { PUBLIC_LISTING } = require('./publicViews');
const { stayNights, indiaDate, HttpError } = require('../utils/validate');

// Date/guest availability across public listings, shared by the booking flow
// (/api/customer-booking/availability), the availability API and search.
// A whole villa is free only when its single unit is ready, big enough and has
// no booked, held or blocked night in the range.

function stayDates(checkIn, checkOut) {
  const dates = stayNights(checkIn, checkOut, 365);
  if (!dates || checkIn < indiaDate()) throw new HttpError(400, 'Choose future dates for a stay of 1–365 nights.');
  return dates;
}

function guestCount(value) {
  const guests = Number(value || 2);
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) throw new HttpError(400, 'Choose 1–50 guests.');
  return guests;
}

// Returns { unavailable: Set<propertyId> } — public listings that have units
// but none free. Listings with no units configured are never reported.
async function unavailableListings({ checkIn, checkOut, guests, propertyIds }) {
  const dates = stayDates(checkIn, checkOut);
  const filter = { ...PUBLIC_LISTING, ...(propertyIds && { _id: { $in: propertyIds } }) };
  const properties = await Property.find(filter).select('_id bookingMode').lean();
  const ids = properties.map(p => p._id);
  const entire = new Set(properties.filter(p => p.bookingMode === 'ENTIRE').map(p => String(p._id)));
  const [units, nights] = await Promise.all([
    Room.find({ property: { $in: ids }, active: true }).select('_id property capacity operationalStatus').lean(),
    RoomNight.find({ property: { $in: ids }, date: { $in: dates }, ...activeNightFilter() }).select('room property').lean()
  ]);
  // Checkout holds live in Redis: a whole villa is locked by its id, a room by "<villa>:<room>".
  const held = await holdLocks.heldDates([...ids.map(String), ...units.map(u => holdLocks.scopeFor(u.property, u._id, false))], dates);
  const taken = new Set([...nights.map(n => String(n.room)), ...units.filter(u => held.has(holdLocks.scopeFor(u.property, u._id, false))).map(u => String(u._id))]);
  const takenVillas = new Set([...nights.filter(n => entire.has(String(n.property))).map(n => String(n.property)), ...[...entire].filter(id => held.has(id))]);
  const withUnits = new Set(units.map(u => String(u.property)));
  const unitCounts = new Map();
  for (const unit of units) unitCounts.set(String(unit.property), (unitCounts.get(String(unit.property)) || 0) + 1);
  const free = new Set(units.filter(u => unitCounts.get(String(u.property)) === 1 && u.capacity >= guests && (u.operationalStatus || 'ready') === 'ready' && !taken.has(String(u._id)) && !takenVillas.has(String(u.property))).map(u => String(u.property)));
  return { dates, unavailable: new Set([...withUnits].filter(id => !free.has(id))), withUnits };
}

module.exports = { stayDates, guestCount, unavailableListings };
