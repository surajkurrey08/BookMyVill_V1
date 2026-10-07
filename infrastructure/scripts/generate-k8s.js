#!/usr/bin/env node
// Generates the Kubernetes (Kustomize) manifests in infrastructure/kubernetes/
// from backend/shared/serviceCatalog.js.   node infrastructure/scripts/generate-k8s.js
// Output is plain YAML committed to the repo; review the diff after changes.
const fs = require('fs');
const path = require('path');
const { SERVICES } = require('../../backend/shared/serviceCatalog');

const OUT = path.join(__dirname, '..', 'kubernetes');
const files = [];
const write = (rel, docs) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${(Array.isArray(docs) ? docs : [docs]).map(toYaml).join('---\n')}`);
  files.push(rel);
};

// Small YAML emitter (objects, arrays, scalars) — enough for manifests.
function scalar(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null) return 'null';
  const s = String(v);
  return /^[A-Za-z0-9_./-][A-Za-z0-9_./ -]*$/.test(s) && !/^(true|false|null|yes|no|on|off|\d+(\.\d+)?)$/i.test(s) && !s.endsWith(' ') ? s : JSON.stringify(s);
}
function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return '[]\n';
    return value.map(item => {
      if (item && typeof item === 'object') {
        const body = toYaml(item, indent + 2).replace(/^\s+/, '');
        return `${pad}- ${body}`;
      }
      return `${pad}- ${scalar(item)}\n`;
    }).join('');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}\n';
    return entries.map(([k, v]) => {
      if (v && typeof v === 'object' && (Array.isArray(v) ? v.length : Object.keys(v).length)) return `${pad}${k}:\n${toYaml(v, indent + 2)}`;
      if (v && typeof v === 'object') return `${pad}${k}: ${Array.isArray(v) ? '[]' : '{}'}\n`;
      return `${pad}${k}: ${scalar(v)}\n`;
    }).join('');
  }
  return `${pad}${scalar(value)}\n`;
}

const PART = 'bookmyvilla';
const labels = (name, component) => ({ 'app.kubernetes.io/name': name, 'app.kubernetes.io/part-of': PART, 'app.kubernetes.io/component': component });
const probe = (pathName, port, extra) => ({ httpGet: { path: pathName, port }, ...extra });
const UPLOAD_WRITERS = new Set(['villa-service', 'media-service', 'user-service']);

function backendDeployment(name, port, { command, replicas = 2, resources, uploads, database }) {
  return {
    apiVersion: 'apps/v1', kind: 'Deployment',
    metadata: { name, labels: labels(name, 'backend') },
    spec: {
      replicas, revisionHistoryLimit: 5,
      strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
      selector: { matchLabels: { 'app.kubernetes.io/name': name } },
      template: {
        metadata: { labels: labels(name, 'backend'), annotations: { 'prometheus.io/scrape': 'true', 'prometheus.io/port': String(port), 'prometheus.io/path': '/metrics' } },
        spec: {
          terminationGracePeriodSeconds: 30,
          securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000 },
          containers: [{
            name, image: 'bookmyvilla/backend:latest', imagePullPolicy: 'IfNotPresent', command,
            ports: [{ name: 'http', containerPort: port }],
            env: [{ name: 'SERVICE_NAME', value: name }, { name: 'PORT', value: String(port) },
              // Independent services: own database (optional keys; unset = shared MONGODB_URI database).
              ...(database ? [
                { name: `${database.key}_MONGODB_URI`, valueFrom: { secretKeyRef: { name: 'bookmyvilla-backend-secrets', key: `${database.key}_MONGODB_URI`, optional: true } } },
                { name: `${database.key}_DB_NAME`, valueFrom: { configMapKeyRef: { name: 'bookmyvilla-config', key: `${database.key}_DB_NAME`, optional: true } } }
              ] : [])],
            envFrom: [{ configMapRef: { name: 'bookmyvilla-config' } }, { secretRef: { name: 'bookmyvilla-backend-secrets' } }],
            resources,
            startupProbe: probe('/health', 'http', { periodSeconds: 5, failureThreshold: 30 }),
            readinessProbe: probe('/ready', 'http', { periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3 }),
            livenessProbe: probe('/health', 'http', { periodSeconds: 20, timeoutSeconds: 3, failureThreshold: 3 }),
            securityContext: { allowPrivilegeEscalation: false, capabilities: { drop: ['ALL'] } },
            ...(uploads && { volumeMounts: [{ name: 'uploads', mountPath: '/app/uploads' }] })
          }],
          ...(uploads && { volumes: [{ name: 'uploads', persistentVolumeClaim: { claimName: 'bookmyvilla-uploads' } }] })
        }
      }
    }
  };
}
const clusterService = (name, component, ports) => ({ apiVersion: 'v1', kind: 'Service', metadata: { name, labels: labels(name, component) }, spec: { type: 'ClusterIP', selector: { 'app.kubernetes.io/name': name }, ports } });
const kustomization = resources => ({ apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization', resources });

const baseResources = [];
const add = (rel, docs) => { write(`base/${rel}`, docs); baseResources.push(rel); };

add('namespace/namespace.yaml', { apiVersion: 'v1', kind: 'Namespace', metadata: { name: PART, labels: { 'app.kubernetes.io/part-of': PART } } });
add('storage/uploads-pvc.yaml', {
  apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: { name: 'bookmyvilla-uploads', labels: labels('uploads', 'storage') },
  // Shared by the services that write/read property media. Needs a ReadWriteMany
  // storage class (e.g. NFS, EFS, Filestore); set storageClassName per cluster.
  spec: { accessModes: ['ReadWriteMany'], resources: { requests: { storage: '20Gi' } } }
});

// API Gateway (public backend entry on 2001)
add('api-gateway/deployment.yaml', backendDeployment('api-gateway', 2001, { command: ['node', 'api-gateway/src/server.js'], replicas: 2, resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m', memory: '384Mi' } } }));
add('api-gateway/service.yaml', clusterService('api-gateway', 'backend', [{ name: 'http', port: 2001, targetPort: 'http' }]));

for (const [name, def] of Object.entries(SERVICES)) {
  const dir = `services/${name.replace(/-service$/, '')}`;
  const heavy = ['villa-service', 'booking-service', 'user-service'].includes(name);
  add(`${dir}/deployment.yaml`, backendDeployment(name, def.port, {
    command: ['node', `services/${name}/src/server.js`],
    replicas: name === 'notification-service' ? 1 : 2,
    uploads: UPLOAD_WRITERS.has(name),
    database: def.database,
    resources: { requests: { cpu: heavy ? '150m' : '75m', memory: heavy ? '256Mi' : '160Mi' }, limits: { cpu: heavy ? '1' : '500m', memory: heavy ? '768Mi' : '512Mi' } }
  }));
  add(`${dir}/service.yaml`, clusterService(name, 'backend', [{ name: 'http', port: def.port, targetPort: 'http' }]));
}

// Web apps: static builds served by nginx (Dockerfile.prod), port 8080.
const WEB = [['frontend', 'frontend'], ['admin', 'admin'], ['owner', 'owner'], ['data-entry', 'data-entry'], ['villa-manager', 'villa-manager'], ['caretaker', 'caretaker']];
for (const [name, dir] of WEB) {
  add(`${dir}/deployment.yaml`, {
    apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name, labels: labels(name, 'web') },
    spec: {
      replicas: name === 'frontend' ? 2 : 1, revisionHistoryLimit: 5,
      strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
      selector: { matchLabels: { 'app.kubernetes.io/name': name } },
      template: {
        metadata: { labels: labels(name, 'web') },
        spec: {
          containers: [{
            name, image: `bookmyvilla/${name}:latest`, imagePullPolicy: 'IfNotPresent',
            ports: [{ name: 'http', containerPort: 8080 }],
            resources: { requests: { cpu: '25m', memory: '32Mi' }, limits: { cpu: '200m', memory: '128Mi' } },
            readinessProbe: probe('/healthz', 'http', { periodSeconds: 10 }),
            livenessProbe: probe('/healthz', 'http', { periodSeconds: 30 }),
            securityContext: { allowPrivilegeEscalation: false }
          }]
        }
      }
    }
  });
  add(`${dir}/service.yaml`, clusterService(name, 'web', [{ name: 'http', port: 80, targetPort: 'http' }]));
}

// RabbitMQ (event bus) and Redis (rate limits, short-lived cache).
add('rabbitmq/statefulset.yaml', {
  apiVersion: 'apps/v1', kind: 'StatefulSet', metadata: { name: 'rabbitmq', labels: labels('rabbitmq', 'messaging') },
  spec: {
    serviceName: 'rabbitmq', replicas: 1, selector: { matchLabels: { 'app.kubernetes.io/name': 'rabbitmq' } },
    template: {
      metadata: { labels: labels('rabbitmq', 'messaging') },
      spec: {
        containers: [{
          name: 'rabbitmq', image: 'rabbitmq:3.13-management-alpine',
          ports: [{ name: 'amqp', containerPort: 5672 }, { name: 'management', containerPort: 15672 }],
          envFrom: [{ secretRef: { name: 'bookmyvilla-rabbitmq-secrets', optional: true } }],
          resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1', memory: '768Mi' } },
          readinessProbe: { exec: { command: ['rabbitmq-diagnostics', '-q', 'check_port_connectivity'] }, periodSeconds: 20, timeoutSeconds: 10 },
          livenessProbe: { exec: { command: ['rabbitmq-diagnostics', '-q', 'status'] }, initialDelaySeconds: 60, periodSeconds: 30, timeoutSeconds: 15 },
          volumeMounts: [{ name: 'data', mountPath: '/var/lib/rabbitmq' }]
        }]
      }
    },
    volumeClaimTemplates: [{ metadata: { name: 'data' }, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '5Gi' } } } }]
  }
});
add('rabbitmq/service.yaml', clusterService('rabbitmq', 'messaging', [{ name: 'amqp', port: 5672, targetPort: 'amqp' }, { name: 'management', port: 15672, targetPort: 'management' }]));
add('redis/deployment.yaml', {
  apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'redis', labels: labels('redis', 'cache') },
  spec: {
    replicas: 1, selector: { matchLabels: { 'app.kubernetes.io/name': 'redis' } },
    template: {
      metadata: { labels: labels('redis', 'cache') },
      spec: {
        containers: [{
          name: 'redis', image: 'redis:7-alpine',
          args: ['redis-server', '--save', '', '--appendonly', 'no', '--maxmemory', '200mb', '--maxmemory-policy', 'allkeys-lru'],
          ports: [{ name: 'redis', containerPort: 6379 }],
          resources: { requests: { cpu: '50m', memory: '64Mi' }, limits: { cpu: '500m', memory: '256Mi' } },
          readinessProbe: { exec: { command: ['redis-cli', 'ping'] }, periodSeconds: 10 },
          livenessProbe: { tcpSocket: { port: 'redis' }, periodSeconds: 20 }
        }]
      }
    }
  }
});
add('redis/service.yaml', clusterService('redis', 'cache', [{ name: 'redis', port: 6379, targetPort: 'redis' }]));
write('base/kustomization.yaml', { ...kustomization(baseResources), labels: [{ pairs: { 'app.kubernetes.io/part-of': PART }, includeSelectors: false }] });

// Non-secret configuration shared by backend pods.
write('config/configmap.yaml', {
  apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'bookmyvilla-config', labels: { 'app.kubernetes.io/part-of': PART } },
  data: { NODE_ENV: 'production', RABBITMQ_URL: 'amqp://rabbitmq:5672', REDIS_URL: 'redis://redis:6379', PROPERTY_MEDIA_DIR: '/app/uploads/properties', HERO_UPLOAD_DIR: '/app/uploads/site-heroes', PUBLIC_API_URL: 'https://api.bookmyvilla.online', GATEWAY_CRITICAL_SERVICES: 'auth-service,user-service,villa-service,booking-service,payment-service', LOG_LEVEL: 'info' }
});
// Secrets are created out of band (never committed). This file documents the keys only.
fs.writeFileSync(path.join(OUT, 'config', 'secret.example.yaml'), [
  '# NOT applied by kustomize. Create the real secret from your values, e.g.:',
  '#   kubectl -n bookmyvilla create secret generic bookmyvilla-backend-secrets --from-env-file=backend/.env',
  '# Required keys: MONGODB_URI, JWT_SECRET, INTERNAL_SERVICE_TOKEN (shared secret for /internal calls).',
  '# Optional: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET; per-service databases <KEY>_MONGODB_URI for',
  `#   ${Object.values(SERVICES).filter(d => d.database).map(d => d.database.key).join(', ')} (their <KEY>_DB_NAME go in the ConfigMap);`,
  '# ALLOW_DEMO_OTP (testing only), CORS_ORIGINS, SMTP_*/SMS_* when providers are added.',
  'apiVersion: v1', 'kind: Secret', 'metadata:', '  name: bookmyvilla-backend-secrets', '  namespace: bookmyvilla', 'type: Opaque', 'stringData:',
  '  MONGODB_URI: "<mongodb+srv://...>"', '  JWT_SECRET: "<long random string>"', '  INTERNAL_SERVICE_TOKEN: "<long random string>"', '  RAZORPAY_KEY_ID: ""', '  RAZORPAY_KEY_SECRET: ""', ''
].join('\n'));
write('config/kustomization.yaml', kustomization(['configmap.yaml']));

// Ingress — the real production hosts (see nginx/*.conf).
const HOSTS = [['bookmyvilla.online', 'frontend', 80], ['www.bookmyvilla.online', 'frontend', 80], ['api.bookmyvilla.online', 'api-gateway', 2001], ['admin.bookmyvilla.online', 'admin', 80], ['owner.bookmyvilla.online', 'owner', 80], ['dataentry.bookmyvilla.online', 'data-entry', 80], ['villamanage.bookmyvilla.online', 'villa-manager', 80]];
write('ingress/ingress.yaml', {
  apiVersion: 'networking.k8s.io/v1', kind: 'Ingress',
  metadata: { name: 'bookmyvilla', labels: { 'app.kubernetes.io/part-of': PART }, annotations: { 'nginx.ingress.kubernetes.io/proxy-body-size': '55m', 'nginx.ingress.kubernetes.io/proxy-read-timeout': '75', 'nginx.ingress.kubernetes.io/ssl-redirect': 'true', 'cert-manager.io/cluster-issuer': 'letsencrypt-prod' } },
  spec: {
    ingressClassName: 'nginx',
    tls: [{ hosts: HOSTS.map(([host]) => host), secretName: 'bookmyvilla-tls' }],
    rules: HOSTS.map(([host, service, port]) => ({ host, http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: service, port: { number: port } } } }] } }))
  }
});
write('ingress/kustomization.yaml', kustomization(['ingress.yaml']));

// Horizontal autoscaling on CPU for the busiest deployments.
const HPA = [['api-gateway', 2, 8], ['villa-service', 2, 6], ['booking-service', 2, 6], ['search-service', 2, 6], ['payment-service', 2, 4], ['auth-service', 2, 4], ['frontend', 2, 6]];
write('autoscaling/hpa.yaml', HPA.map(([name, min, max]) => ({
  apiVersion: 'autoscaling/v2', kind: 'HorizontalPodAutoscaler', metadata: { name, labels: { 'app.kubernetes.io/part-of': PART } },
  spec: { scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name }, minReplicas: min, maxReplicas: max,
    metrics: [{ type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } }],
    behavior: { scaleDown: { stabilizationWindowSeconds: 300 } } }
})));
write('autoscaling/pdb.yaml', ['api-gateway', 'villa-service', 'booking-service', 'payment-service', 'auth-service'].map(name => ({
  apiVersion: 'policy/v1', kind: 'PodDisruptionBudget', metadata: { name, labels: { 'app.kubernetes.io/part-of': PART } },
  spec: { minAvailable: 1, selector: { matchLabels: { 'app.kubernetes.io/name': name } } }
})));
write('autoscaling/kustomization.yaml', kustomization(['hpa.yaml', 'pdb.yaml']));

// Overlays
const images = tag => ['backend', 'frontend', 'admin', 'owner', 'data-entry', 'villa-manager', 'caretaker'].map(name => ({ name: `bookmyvilla/${name}`, newName: `REGISTRY/bookmyvilla/${name}`, newTag: tag }));
const backendNames = ['api-gateway', ...Object.keys(SERVICES)];
write('overlays/production/kustomization.yaml', {
  apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization', namespace: PART,
  resources: ['../../base', '../../config', '../../ingress', '../../autoscaling'],
  images: images('IMAGE_TAG')
});
write('overlays/development/kustomization.yaml', {
  apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization', namespace: `${PART}-dev`,
  resources: ['../../base', '../../config'],
  patches: [{ target: { kind: 'Namespace', name: PART }, patch: `- op: replace\n  path: /metadata/name\n  value: ${PART}-dev\n` }],
  replicas: [...backendNames, 'frontend'].map(name => ({ name, count: 1 })),
  configMapGenerator: [{ name: 'bookmyvilla-config', behavior: 'merge', literals: ['NODE_ENV=development', 'PUBLIC_API_URL=http://localhost:2001', 'LOG_LEVEL=debug'] }],
  images: images('dev')
});

console.log(`Wrote ${files.length} manifest files to ${OUT}`);
