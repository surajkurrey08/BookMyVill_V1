const { createGateway } = require('./app');
const { connectCache, closeCache } = require('../../shared/cache');

// Public backend entry point. Port 2001 is fixed: the websites, panels, host
// nginx (api.bookmyvilla.online) and the deploy health check all use it.
const PORT = Number(process.env.GATEWAY_PORT || process.env.PORT) || 2001;
const { app, logger, targets } = createGateway();
connectCache();
const server = app.listen(PORT, '0.0.0.0', () => logger.info('api gateway listening', { port: PORT, services: Object.keys(targets).length }));
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0; // long uploads are bounded by the upstream timeout instead

const shutdown = signal => { logger.info('shutting down', { signal }); server.close(() => closeCache().finally(() => process.exit(0))); setTimeout(() => process.exit(0), 10000).unref(); };
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
