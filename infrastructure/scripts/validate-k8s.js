#!/usr/bin/env node
// Offline validation of infrastructure/kubernetes and docker-compose.yaml
// (for machines without kubectl). Parses every YAML file and checks the
// cross-references kubectl/kustomize would otherwise catch at apply time.
//   cd infrastructure && npm run validate
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', 'kubernetes');
const problems = [];
const fail = msg => problems.push(msg);
const docs = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.ya?ml$/.test(entry.name)) {
      try { for (const doc of yaml.loadAll(fs.readFileSync(full, 'utf8'))) if (doc) docs.push({ file: path.relative(ROOT, full), doc }); }
      catch (error) { fail(`${path.relative(ROOT, full)}: YAML parse error — ${error.message}`); }
    }
  }
}
walk(ROOT);

// Every kustomization resource must exist.
for (const { file, doc } of docs.filter(d => d.doc.kind === 'Kustomization')) {
  for (const res of doc.resources || []) {
    const target = path.join(ROOT, path.dirname(file), res);
    if (!fs.existsSync(target)) fail(`${file}: resource "${res}" does not exist`);
    else if (fs.statSync(target).isDirectory() && !fs.existsSync(path.join(target, 'kustomization.yaml'))) fail(`${file}: directory "${res}" has no kustomization.yaml`);
  }
}

const objects = docs.filter(d => d.doc.kind && d.doc.kind !== 'Kustomization' && !d.file.endsWith('secret.example.yaml'));
const workloads = objects.filter(d => ['Deployment', 'StatefulSet'].includes(d.doc.kind));
const services = objects.filter(d => d.doc.kind === 'Service');
const byName = (kind, name) => objects.find(d => d.doc.kind === kind && d.doc.metadata?.name === name);

for (const { file, doc } of objects) {
  if (!doc.apiVersion || !doc.metadata?.name) fail(`${file}: missing apiVersion or metadata.name`);
}

for (const { file, doc } of workloads) {
  const name = doc.metadata.name;
  const selector = doc.spec?.selector?.matchLabels || {};
  const podLabels = doc.spec?.template?.metadata?.labels || {};
  for (const [k, v] of Object.entries(selector)) if (podLabels[k] !== v) fail(`${file}: selector ${k}=${v} does not match pod labels`);
  for (const c of doc.spec.template.spec.containers || []) {
    if (!c.image) fail(`${file}: container ${c.name} has no image`);
    if (!c.resources?.requests || !c.resources?.limits) fail(`${file}: container ${c.name} lacks resource requests/limits`);
    if (!c.readinessProbe || !c.livenessProbe) fail(`${file}: container ${c.name} lacks readiness/liveness probes`);
    const named = new Set((c.ports || []).map(p => p.name));
    for (const p of [c.readinessProbe, c.livenessProbe, c.startupProbe].filter(Boolean)) {
      const port = p.httpGet?.port ?? p.tcpSocket?.port;
      if (typeof port === 'string' && !named.has(port)) fail(`${file}: probe uses unknown port name "${port}"`);
    }
    for (const ref of c.envFrom || []) if (ref.configMapRef && !byName('ConfigMap', ref.configMapRef.name)) fail(`${file}: ConfigMap ${ref.configMapRef.name} not defined`);
    for (const m of c.volumeMounts || []) if (!(doc.spec.template.spec.volumes || []).some(v => v.name === m.name) && !(doc.spec.volumeClaimTemplates || []).some(v => v.metadata.name === m.name)) fail(`${file}: volumeMount ${m.name} has no volume`);
  }
  for (const v of doc.spec.template.spec.volumes || []) if (v.persistentVolumeClaim && !byName('PersistentVolumeClaim', v.persistentVolumeClaim.claimName)) fail(`${file}: PVC ${v.persistentVolumeClaim.claimName} not defined`);
  if (doc.kind === 'Deployment' && !services.some(s => s.doc.spec.selector['app.kubernetes.io/name'] === name)) fail(`${file}: no Service selects deployment ${name}`);
}

for (const { file, doc } of services) {
  const target = workloads.find(w => Object.entries(doc.spec.selector || {}).every(([k, v]) => w.doc.spec.template.metadata.labels[k] === v));
  if (!target) { fail(`${file}: Service ${doc.metadata.name} selects no workload`); continue; }
  const portNames = new Set(target.doc.spec.template.spec.containers.flatMap(c => (c.ports || []).map(p => p.name)));
  for (const p of doc.spec.ports) if (typeof p.targetPort === 'string' && !portNames.has(p.targetPort)) fail(`${file}: targetPort ${p.targetPort} not exposed by ${target.doc.metadata.name}`);
}

for (const { file, doc } of objects.filter(d => d.doc.kind === 'HorizontalPodAutoscaler')) {
  if (!byName(doc.spec.scaleTargetRef.kind, doc.spec.scaleTargetRef.name)) fail(`${file}: HPA target ${doc.spec.scaleTargetRef.name} not found`);
  if (doc.spec.minReplicas > doc.spec.maxReplicas) fail(`${file}: HPA ${doc.metadata.name} min > max`);
}
for (const { file, doc } of objects.filter(d => d.doc.kind === 'Ingress')) {
  for (const rule of doc.spec.rules) for (const p of rule.http.paths) {
    const svc = byName('Service', p.backend.service.name);
    if (!svc) fail(`${file}: ${rule.host} -> unknown Service ${p.backend.service.name}`);
    else if (!svc.doc.spec.ports.some(port => port.port === p.backend.service.port.number)) fail(`${file}: ${rule.host} -> ${p.backend.service.name} has no port ${p.backend.service.port.number}`);
  }
}

// Docker Compose: parse, and every command must point at an existing entry file.
const composeFile = path.join(__dirname, '..', '..', 'docker-compose.yaml');
try {
  const compose = yaml.load(fs.readFileSync(composeFile, 'utf8'));
  for (const [name, svc] of Object.entries(compose.services)) {
    if (Array.isArray(svc.command) && svc.command[0] === 'node' && !fs.existsSync(path.join(__dirname, '..', '..', 'backend', svc.command[1]))) fail(`docker-compose.yaml: ${name} runs missing file ${svc.command[1]}`);
  }
  const published = Object.entries(compose.services).filter(([, s]) => (s.ports || []).some(p => String(p).includes('2001')));
  if (published.length !== 1 || published[0][0] !== 'api-gateway') fail('docker-compose.yaml: only api-gateway may publish port 2001');
} catch (error) { fail(`docker-compose.yaml: ${error.message}`); }

const counts = objects.reduce((m, d) => ({ ...m, [d.doc.kind]: (m[d.doc.kind] || 0) + 1 }), {});
console.log(`Parsed ${docs.length} YAML documents:`, counts);
if (problems.length) { console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Kubernetes manifests and docker-compose.yaml: OK');
