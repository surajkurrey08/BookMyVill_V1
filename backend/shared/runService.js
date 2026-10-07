const path = require('path');
const { SERVICES } = require('./serviceCatalog');
const { createService } = require('./createService');

const BACKEND_ROOT = path.join(__dirname, '..');
const load = modulePath => require(path.join(BACKEND_ROOT, modulePath));

// Independent service: owns its app definition
// ({ name, port, database, mounts(), onReady? }) under services/<name>/src/app.js.
function buildIndependentService(appDef) {
  return createService({
    name: appDef.name,
    port: appDef.port,
    database: appDef.database,
    mounts: appDef.mounts().map(([mountPath, router]) => [mountPath, () => router]),
    onReady: appDef.onReady
  });
}

// Legacy-shared service: routers from backend/routes on the shared connection.
function buildLegacyService(name, def) {
  return createService({
    name,
    port: def.port,
    mounts: def.mounts.map(([mountPath, modulePath]) => [mountPath, () => load(modulePath)]),
    onReady: async ({ logger }) => {
      if (def.seedsDefaultAccounts) await load('services/defaultAccounts').seedDefaultAccounts(logger); // auth domain, dev only
      for (const consumer of [].concat(def.consumers || [])) await load(consumer).startConsumers();
    }
  });
}

function buildCatalogService(name) {
  const def = SERVICES[name];
  if (!def) throw new Error(`Unknown service "${name}".`);
  return def.app ? buildIndependentService(load(def.app)) : buildLegacyService(name, def);
}

const runCatalogService = name => { const service = buildCatalogService(name); service.start(); return service; };
const runIndependentService = appDef => { const service = buildIndependentService(appDef); service.start(); return service; };

// Mounts every service into one Express app (legacy all-in-one server and the
// test harness). Independent services first: they own specific paths that
// would otherwise fall through to a broader legacy router.
// Returns the independent app definitions so the caller can connect their databases.
function mountAll(app) {
  const independent = [];
  for (const def of Object.values(SERVICES).filter(d => d.app)) {
    const appDef = load(def.app);
    independent.push(appDef);
    for (const [mountPath, router] of appDef.mounts()) app.use(mountPath, router);
  }
  const seen = new Set();
  for (const def of Object.values(SERVICES).filter(d => !d.app)) {
    for (const [mountPath, modulePath] of def.mounts) {
      if (seen.has(mountPath + modulePath)) continue;
      seen.add(mountPath + modulePath);
      app.use(mountPath, load(modulePath));
    }
  }
  return independent;
}

// Consumers to start in single-process mode (in-process event bus).
async function startAllConsumers(logger) {
  for (const def of Object.values(SERVICES)) {
    if (def.app) { const appDef = load(def.app); if (appDef.onReady) await appDef.onReady({ logger }); }
    else for (const consumer of [].concat(def.consumers || [])) await load(consumer).startConsumers();
  }
}

module.exports = { buildCatalogService, buildIndependentService, runCatalogService, runIndependentService, mountAll, startAllConsumers };
