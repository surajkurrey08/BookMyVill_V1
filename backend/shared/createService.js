const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const { createLogger } = require('./logger');
const { createMetrics } = require('./metrics');
const { requestContext, securityHeaders, notFound, errorHandler, TRUST_PROXY } = require('./http');
const { connectDatabase, closeDatabase, databaseReady } = require('./database');
const { connectCache, cacheReady, closeCache } = require('./cache');
const { connectBroker, brokerReady, closeBroker } = require('../messaging');

// Builds one microservice process: the routers it owns, plus the same
// operational surface everywhere — /health (process up), /ready (MongoDB and,
// when configured, RabbitMQ/Redis reachable), /metrics, request IDs,
// structured logs, security headers, and graceful shutdown.
//
// mounts: [[path, () => router], ...] — loaded lazily so a service only loads
// the domain modules it serves.
// database: 'shared' (default mongoose connection, legacy-shared domain code),
//           a createServiceDatabase() instance (service-owned), or null.
function createService({ name, port, mounts = [], database = 'shared', onReady, setup }) {
  process.env.SERVICE_NAME = process.env.SERVICE_NAME || name;
  const logger = createLogger(name);
  const metrics = createMetrics(name);
  const app = express();
  app.set('trust proxy', TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestContext(logger, metrics));
  app.get('/health', (req, res) => res.json({ status: 'ok', service: name, uptime: Math.round(process.uptime()) }));
  const readiness = () => {
    const checks = { database: database === 'shared' ? databaseReady() : database ? database.ready() : null, rabbitmq: brokerReady(), redis: cacheReady() };
    // Only MongoDB gates readiness. RabbitMQ/Redis outages degrade gracefully
    // (events are logged, caches fall back to memory) instead of taking every
    // pod out of the load balancer; their state is still reported.
    const ok = checks.database !== false;
    return { ok, checks };
  };
  app.get('/ready', (req, res) => { const { ok, checks } = readiness(); res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', service: name, checks }); });
  // Kept for the existing deploy health check and old monitors.
  app.get('/api/health', (req, res) => { const { ok, checks } = readiness(); res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'database_unavailable', database: checks.database === false ? 'disconnected' : 'connected', service: name }); });
  app.get('/metrics', (req, res) => res.type('text/plain; version=0.0.4').send(metrics.render()));

  app.use(securityHeaders());
  app.use(require('../services/cors'));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  if (setup) setup(app, { logger, metrics });
  for (const [mountPath, load] of mounts) app.use(mountPath, load());
  app.use(notFound);
  app.use(errorHandler(logger));

  async function start() {
    const listenPort = Number(process.env.PORT) || port;
    const server = app.listen(listenPort, '0.0.0.0', () => logger.info('service listening', { port: listenPort }));
    server.keepAliveTimeout = 65000; // longer than the gateway's upstream keep-alive
    connectCache();
    connectBroker().catch(() => {});
    const ready = onReady ? () => onReady({ logger, metrics }) : null;
    if (database === 'shared') connectDatabase(logger, { onConnected: ready }).catch(error => logger.error('database start failed', { error }));
    else if (database) database.connect(logger).then(ok => ok && ready && ready()).catch(error => logger.error('database start failed', { error }));
    else if (ready) Promise.resolve(ready()).catch(error => logger.error('startup task failed', { error }));
    let stopping = false;
    const shutdown = async signal => {
      if (stopping) return; stopping = true;
      logger.info('shutting down', { signal });
      server.close();
      await Promise.allSettled([closeBroker(), closeCache(), database === 'shared' ? closeDatabase() : database?.close()]);
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    return server;
  }

  return { app, start, logger, metrics };
}

module.exports = { createService };
