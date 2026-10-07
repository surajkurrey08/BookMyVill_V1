const config = require('./config');

// search-service composition: owned index database, public search API,
// villa event consumers + periodic resync.
module.exports = {
  name: config.name,
  port: config.port,
  database: config.database,
  mounts: () => {
    const routes = require('./routes/searchRoutes');
    return [['/api/search', routes], ['/api/v1/search', routes]];
  },
  onReady: () => require('./events/consumers').startConsumers()
};
