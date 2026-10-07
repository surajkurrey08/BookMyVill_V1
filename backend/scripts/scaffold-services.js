#!/usr/bin/env node
// Generates the per-service boilerplate (package.json, Dockerfile,
// .dockerignore, .env.example, README, and the server entry of legacy-shared
// services) from shared/serviceCatalog. Independent services keep their own
// hand-written src/ (server.js is never overwritten for them).
// Re-run after adding a service to the catalog: node scripts/scaffold-services.js
const fs = require('fs');
const path = require('path');
const { SERVICES, publicPaths } = require('../shared/serviceCatalog');

const root = path.join(__dirname, '..', 'services');
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };

for (const [name, def] of Object.entries(SERVICES)) {
  const dir = path.join(root, name);
  const independent = Boolean(def.app);
  const routes = independent
    ? publicPaths(def).map(mount => `| \`${mount}\` | \`backend/services/${name}/src\` |`).join('\n')
    : def.mounts.map(([mount, mod]) => `| \`${mount}\` | \`backend/${mod}.js\` |`).join('\n');
  if (!independent) write(path.join(dir, 'src', 'server.js'), `// ${name}: ${def.purpose}.\n// Routes and port come from backend/shared/serviceCatalog.js.\nrequire('../../../shared/runService').runCatalogService('${name}');\n`);
  write(path.join(dir, 'package.json'), `${JSON.stringify({ name: `@bookmyvilla/${name}`, private: true, description: def.purpose, main: 'src/server.js', scripts: { start: 'node src/server.js', test: `node --test "tests/*.test.js"` }, engines: { node: '>=22' } }, null, 2)}\n`);
  write(path.join(dir, 'Dockerfile'), `# Build from backend/: docker build -f services/${name}/Dockerfile -t bookmyvilla/${name} .\nFROM node:22-alpine\nENV NODE_ENV=production\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev --no-audit --no-fund\nCOPY . .\nRUN mkdir -p /app/uploads && chown -R node:node /app/uploads\nUSER node\nENV PORT=${def.port} SERVICE_NAME=${name}\nEXPOSE ${def.port}\nHEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"\nCMD ["node", "services/${name}/src/server.js"]\n`);
  write(path.join(dir, '.dockerignore'), 'node_modules\nnpm-debug.log\n.env\ntest\ntests\nuploads\n');
  const db = def.database;
  write(path.join(dir, '.env.example'), [
    `SERVICE_NAME=${name}`, `PORT=${def.port}`, 'NODE_ENV=production',
    '# Shared database (legacy-shared services, and the default for every service)', 'MONGODB_URI=',
    ...(db ? [`# Own database of ${name}. Empty = use MONGODB_URI's database (current data).`, `# Target after copying data (scripts/copy-service-data.js): ${db.target}`, `${db.key}_MONGODB_URI=`, `${db.key}_DB_NAME=`] : []),
    'JWT_SECRET=', '# Shared secret for /internal service-to-service calls (same value in every service)', 'INTERNAL_SERVICE_TOKEN=',
    'RABBITMQ_URL=amqp://rabbitmq:5672', 'REDIS_URL=redis://redis:6379', ''
  ].join('\n'));
  write(path.join(dir, 'README.md'), [
    `# ${name}`, '', `${def.purpose}.`, '',
    `- Type: ${independent ? `**independent** — own code in \`src/\`${db ? `, own database (\`${db.key}_MONGODB_URI\` / \`${db.key}_DB_NAME\`, target \`${db.target}\`)` : ''}` : '**legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)'}`,
    `- Port: \`${def.port}\` (internal; clients reach it only through the API Gateway on 2001)`,
    '- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`',
    `- Start locally: \`cd backend && node services/${name}/src/server.js\``,
    ...(fs.existsSync(path.join(dir, 'tests')) ? [`- Tests: \`cd backend && node --test "services/${name}/tests/*.test.js"\``] : []),
    '', '| Public path | Code |', '|---|---|', routes, ''
  ].join('\n'));
}
console.log(`Scaffolded ${Object.keys(SERVICES).length} services in ${root}`);
