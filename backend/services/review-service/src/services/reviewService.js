const repo = require('../repositories/feedbackRepository');
const clients = require('../clients');
const { HttpError } = require('../../../../utils/validate');

// Review business rules (owned by review-service).
const notFoundAsNull = err => { if (err.status === 404) return null; throw err; };

async function forOwner(user, requestId) {
  const villas = await clients.ownerVillas(user.id, requestId);
  return repo.forProperties(villas.map(v => v._id));
}

async function publishedForProperty(propertyId, requestId) {
  const villa = await clients.villaSummary(propertyId, requestId).catch(notFoundAsNull);
  if (!villa || villa.status !== 'approved') throw new HttpError(404, 'Published property not found.');
  return repo.publishedForProperty(propertyId);
}

// Guests may review only a completed, paid stay at that property.
async function create(user, input, requestId) {
  const stay = await clients.completedStay(user.id, input.propertyId, requestId).catch(notFoundAsNull);
  if (!stay) throw new HttpError(403, 'Only your completed paid stay can be reviewed.');
  const villa = await clients.villaSummary(input.propertyId, requestId);
  const fb = await repo.create({
    propertyId: input.propertyId, propertyName: villa.name, ownerId: villa.owner,
    guestName: stay.guestName || user.name, guestPhone: stay.guestPhone || user.phone,
    rating: input.rating, reviewText: input.reviewText, facilitiesUsed: input.facilitiesUsed, selectedForHotelPage: false
  });
  return { _id: fb._id, rating: fb.rating, reviewText: fb.reviewText };
}

// Owners curate reviews only for properties they operate (self-managed).
async function ownedFeedback(user, id, requestId) {
  const fb = await repo.findById(id);
  if (!fb) throw new HttpError(404, 'Record not found in your account.');
  const access = await clients.villaAccess(fb.propertyId, user, requestId);
  if (access.allowed || (!access.exists && String(fb.ownerId) === String(user.id))) return fb;
  if (access.owned) throw new HttpError(403, 'This property is managed by BookMyVilla. Operational changes require its assigned Villa Manager.');
  throw new HttpError(404, 'Record not found in your account.');
}

async function toggleSelected(user, id, requestId) {
  const fb = await ownedFeedback(user, id, requestId);
  fb.selectedForHotelPage = !fb.selectedForHotelPage;
  await fb.save();
  return fb;
}

async function remove(user, id, requestId) {
  await ownedFeedback(user, id, requestId);
  await repo.remove(id);
}

module.exports = { forOwner, all: repo.all, publishedForProperty, create, toggleSelected, remove };
