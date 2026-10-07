const { validId, cleanText, HttpError } = require('../../../../utils/validate');

function newReview(body = {}) {
  if (!validId(body.propertyId)) throw new HttpError(400, 'Choose a property.');
  const rating = Number(body.rating);
  const reviewText = cleanText(body.reviewText, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !reviewText) throw new HttpError(400, 'Enter a rating and review.');
  const facilitiesUsed = Array.isArray(body.facilitiesUsed) ? body.facilitiesUsed.filter(s => typeof s === 'string').map(s => s.slice(0, 100)).slice(0, 20) : [];
  return { propertyId: body.propertyId, rating, reviewText, facilitiesUsed };
}

function feedbackId(id) {
  if (!validId(id)) throw new HttpError(400, 'Invalid record ID.');
  return id;
}

module.exports = { newReview, feedbackId };
