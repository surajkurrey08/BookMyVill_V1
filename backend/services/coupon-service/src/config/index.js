const { createServiceDatabase } = require('../../../../shared/database');

// coupon-service configuration. Database: COUPON_MONGODB_URI / COUPON_DB_NAME
// (target logical database: bookmyvilla_coupons; see shared/database.js).
module.exports = {
  name: 'coupon-service',
  port: 2111,
  database: createServiceDatabase('COUPON'),
  // booking.confirmed -> count the promotion use once per booking.
  queue: 'coupon-service.bookings'
};
