const { subscribe } = require('../../../../messaging');
const config = require('../config');
const indexer = require('../services/indexer');
const { createLogger } = require('../../../../shared/logger');

const logger = createLogger(config.name).child('indexer');

// villa.* events keep the index fresh; a periodic full resync heals anything
// missed while the service or the broker was down.
async function startConsumers() {
  await subscribe(config.queue, ['villa.*'], indexer.onVillaEvent);
  const resync = () => indexer.syncAll().then(count => logger.info('search index synced', { count })).catch(error => logger.warn('search index sync failed', { error }));
  resync();
  setInterval(resync, config.resyncMs).unref();
}

module.exports = { startConsumers };
