const { createServiceDatabase } = require('../../../../shared/database');

// notification-service configuration. Database: NOTIFICATION_MONGODB_URI /
// NOTIFICATION_DB_NAME (target logical database: bookmyvilla_notifications).
module.exports = { name: 'notification-service', port: 2108, database: createServiceDatabase('NOTIFICATION'), queue: 'notification-service.events' };
