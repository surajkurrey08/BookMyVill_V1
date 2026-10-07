#!/usr/bin/env node
// Runs the API Gateway (2001) and all 12 microservices locally without Docker.
//   npm run dev:all
// Each process gets PORT from the catalog and the gateway reaches them on
// localhost. Ctrl+C stops everything. Logs are prefixed with the service name.
// Options (env): DEV_PORT_OFFSET=1000 shifts every port (e.g. gateway 3001).
const path = require('path');
const { spawn } = require('child_process');
const { SERVICES } = require('../shared/serviceCatalog');

const offset = Number(process.env.DEV_PORT_OFFSET) || 0;
const backend = path.join(__dirname, '..');
const urls = Object.fromEntries(Object.entries(SERVICES).map(([name, def]) => [`${name.replace(/-/g, '_').toUpperCase()}_URL`, `http://127.0.0.1:${def.port + offset}`]));
const children = [];

function run(name, script, port) {
  const child = spawn(process.execPath, [script], { cwd: backend, env: { ...process.env, ...urls, PORT: String(port), SERVICE_NAME: name }, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}]`.padEnd(24);
  const pipe = stream => stream.on('data', chunk => String(chunk).split('\n').filter(Boolean).forEach(line => process.stdout.write(`${prefix} ${line}\n`)));
  pipe(child.stdout); pipe(child.stderr);
  child.on('exit', code => { if (!stopping) process.stdout.write(`${prefix} exited with code ${code}\n`); });
  children.push(child);
}

let stopping = false;
for (const [name, def] of Object.entries(SERVICES)) run(name, `services/${name}/src/server.js`, def.port + offset);
run('api-gateway', 'api-gateway/src/server.js', 2001 + offset);
const stop = () => { stopping = true; children.forEach(child => child.kill('SIGTERM')); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
