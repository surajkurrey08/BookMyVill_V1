const { createServiceDatabase } = require('../../../../shared/database');

// search-service configuration. Owns only a derived index of public villas;
// villa-service stays the source of truth. Database: SEARCH_MONGODB_URI /
// SEARCH_DB_NAME (target logical database: bookmyvilla_search).
module.exports = {
  name: 'search-service',
  port: 2109,
  database: createServiceDatabase('SEARCH'),
  queue: 'search-service.villas',
  resyncMs: Number(process.env.SEARCH_RESYNC_MS) || 10 * 60 * 1000
};
