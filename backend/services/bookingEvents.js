const { subscribe } = require('../messaging');
const { confirmFromPayment } = require('./bookingConfirmation');

// booking-service event consumers.
// payment.success -> confirm the booking (idempotent; failures are retried and
// finally parked in booking-service.payments.dlq).
function startConsumers() {
  return subscribe('booking-service.payments', ['payment.success'], confirmFromPayment);
}

module.exports = { startConsumers };
