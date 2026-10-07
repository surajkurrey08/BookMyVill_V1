const { createServiceDatabase } = require('../../../../shared/database');

// payment-service configuration. Database: PAYMENT_MONGODB_URI / PAYMENT_DB_NAME
// (target logical database: bookmyvilla_payments).
module.exports = {
  name: 'payment-service',
  port: 2107,
  database: createServiceDatabase('PAYMENT'),
  // How long /verify waits for booking-service to confirm after payment.success.
  confirmWaitMs: Number(process.env.PAYMENT_CONFIRM_WAIT_MS) || 8000,
  confirmPollMs: 150
};
