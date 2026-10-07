const { subscribe } = require('../../../../messaging');
const { queue } = require('../config');
const { redeemForBooking } = require('../services/catalogService');

// booking.confirmed (guest checkout with a promo code) -> count the use once.
function startConsumers() {
  return subscribe(queue, ['booking.confirmed'], redeemForBooking);
}

module.exports = { startConsumers };
