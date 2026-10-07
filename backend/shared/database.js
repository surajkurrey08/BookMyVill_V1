const mongoose = require('mongoose');
const { resolveMongoUri } = require('../services/databaseConfig');

// Generic MongoDB connectors (no domain models here).
//
// connectDatabase(): the default mongoose connection, used by services that
//   still run legacy-shared domain code.
// createServiceDatabase(KEY): a service-owned connection. Each independent
//   service registers its own models on it and reads its own settings:
//     <KEY>_MONGODB_URI  (default: the platform MONGODB_URI cluster)
//     <KEY>_DB_NAME      (default: the database in that URI, i.e. where the
//                         live data is today — so existing data stays usable
//                         until it is copied with scripts/copy-service-data.js
//                         and <KEY>_DB_NAME is switched to e.g. bookmyvilla_reviews)

mongoose.set('bufferCommands', false);
const OPTIONS = { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 45000, bufferCommands: false };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const attemptsDefault = () => Number(process.env.MONGODB_CONNECT_ATTEMPTS) || 30;
const retryDefault = () => Number(process.env.MONGODB_CONNECT_RETRY_MS) || 3000;

function dnsOverride() {
  if (process.env.MONGODB_DNS_SERVERS) require('node:dns').setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean));
}

async function buildIndexes(models, logger) {
  const { ensureModelIndexes } = require('../utils/modelIndexes');
  await Promise.all(models.map(model => ensureModelIndexes(model).catch(error => logger.warn('index build notice', { model: model.modelName, error }))));
}

async function retry(logger, label, fn, attempts = attemptsDefault(), retryMs = retryDefault()) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn(); }
    catch (error) {
      logger.error(`${label} connection attempt failed`, { attempt, attempts, error });
      if (attempt < attempts) await sleep(retryMs);
    }
  }
  logger.error(`${label} unreachable; /ready stays 503 until it connects`);
  return null;
}

// ---- default (shared) connection ----
const databaseReady = () => mongoose.connection.readyState === 1;

async function connectDatabase(logger, { onConnected } = {}) {
  let uri;
  try { uri = resolveMongoUri(); } catch (error) { logger.error('MongoDB configuration error', { error }); return false; }
  dnsOverride();
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  const ok = await retry(logger, 'MongoDB', async () => {
    await mongoose.connect(uri, OPTIONS);
    logger.info('MongoDB connected', { database: mongoose.connection.name });
    return true;
  });
  if (!ok) return false;
  await buildIndexes(Object.values(mongoose.models), logger);
  if (onConnected) await onConnected();
  return true;
}

async function closeDatabase() { if (mongoose.connection.readyState !== 0) await mongoose.connection.close(); }

// ---- service-owned connection ----
function createServiceDatabase(key) {
  const connection = mongoose.createConnection();
  connection.set('bufferCommands', false);
  // Indexes are built explicitly after connecting (buildIndexes), not by mongoose at model compile time.
  connection.set('autoIndex', false);
  connection.set('autoCreate', false);
  return {
    key,
    connection,
    config(env = process.env) {
      return { uri: env[`${key}_MONGODB_URI`] || resolveMongoUri(env), dbName: env[`${key}_DB_NAME`] || undefined };
    },
    async connect(logger, { uri, dbName } = {}) {
      let target;
      try { target = uri ? { uri, dbName } : this.config(); } catch (error) { logger.error('MongoDB configuration error', { service: key, error }); return false; }
      dnsOverride();
      const ok = await retry(logger, `${key} MongoDB`, async () => {
        await connection.openUri(target.uri, { ...OPTIONS, ...(target.dbName && { dbName: target.dbName }) });
        logger.info('service database connected', { database: connection.name });
        return true;
      });
      if (ok) await buildIndexes(Object.values(connection.models), logger);
      return Boolean(ok);
    },
    ready: () => connection.readyState === 1,
    close: () => (connection.readyState !== 0 ? connection.close() : Promise.resolve())
  };
}

module.exports = { connectDatabase, closeDatabase, databaseReady, createServiceDatabase };
