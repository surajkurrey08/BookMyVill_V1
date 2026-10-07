const config = require('./config');

// payment-service composition: owned payments database, checkout verification,
// internal order/config/quote APIs. It publishes payment.success and never
// writes booking data.
module.exports = {
  name: config.name,
  port: config.port,
  database: config.database,
  mounts: () => {
    const { publicRoutes, internalRoutes } = require('./routes/paymentRoutes');
    return [['/api/customer-booking', publicRoutes], ['/api/v1/bookings', publicRoutes], ['/api/v1/payments', publicRoutes], ['/internal/payments', internalRoutes]];
  }
};
