const config = require('./config');

// coupon-service composition: owned database (add-ons, promotions,
// redemptions), owner API, internal offer/redeem API, booking.confirmed consumer.
module.exports = {
  name: config.name,
  port: config.port,
  database: config.database,
  mounts: () => {
    const { ownerRoutes, internalRoutes } = require('./routes/couponRoutes');
    return [['/api/owner-catalog', ownerRoutes], ['/api/v1/coupons', ownerRoutes], ['/internal/coupons', internalRoutes]];
  },
  onReady: () => require('./events/consumers').startConsumers()
};
