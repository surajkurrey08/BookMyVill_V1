// notification-service: records notifications from domain events (independent: own code and database).
require('../../../shared/runService').runIndependentService(require('./app'));
