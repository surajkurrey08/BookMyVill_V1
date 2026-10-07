const config = require('./config');

// notification-service composition: owned database, admin API, event consumers.
module.exports = {
  name: config.name,
  port: config.port,
  database: config.database,
  mounts: () => {
    const routes = require('./routes/notificationRoutes');
    return [['/api/notifications', routes], ['/api/v1/notifications', routes]];
  },
  onReady: () => require('./events/consumers').startConsumers()
};
