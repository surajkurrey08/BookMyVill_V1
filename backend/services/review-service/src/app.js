const config = require('./config');

// review-service composition: owned database + public routes.
module.exports = {
  name: config.name,
  port: config.port,
  database: config.database,
  mounts: () => {
    const routes = require('./routes/reviewRoutes');
    return [['/api/feedback', routes], ['/api/v1/reviews', routes]];
  }
};
