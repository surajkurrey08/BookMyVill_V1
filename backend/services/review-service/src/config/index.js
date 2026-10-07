const { createServiceDatabase } = require('../../../../shared/database');

// review-service configuration. Database: REVIEW_MONGODB_URI / REVIEW_DB_NAME
// (target logical database: bookmyvilla_reviews; see shared/database.js).
module.exports = { name: 'review-service', port: 2110, database: createServiceDatabase('REVIEW') };
