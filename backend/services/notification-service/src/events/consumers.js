const { subscribe } = require('../../../../messaging');
const { queue } = require('../config');
const { handleEvent } = require('../services/notificationService');

// Booking/payment/villa events -> notification records (idempotent).
function startConsumers() {
  return subscribe(queue, ['booking.*', 'payment.*', 'villa.created'], handleEvent);
}

module.exports = { startConsumers };
