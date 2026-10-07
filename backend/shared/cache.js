// Shared Redis client (optional). When REDIS_URL is set the gateway and
// services share rate-limit counters and short-lived caches across replicas;
// without it everything falls back to per-process memory, so local runs and
// tests keep working. MongoDB stays the only permanent store.

let client = null;
let connecting = false;
const memory = new Map(); // key -> { value, expiresAt }

function redis() {
  if (client || connecting || !process.env.REDIS_URL) return client;
  connecting = true;
  const Redis = require('ioredis');
  client = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 5000 });
  client.on('error', () => {}); // availability is reported through cacheReady()
  return client;
}

const usable = () => redis()?.status === 'ready';
const fromMemory = key => { const hit = memory.get(key); if (!hit) return null; if (hit.expiresAt <= Date.now()) { memory.delete(key); return null; } return hit.value; };

async function getJson(key) {
  if (usable()) { try { const raw = await client.get(key); return raw ? JSON.parse(raw) : null; } catch { /* fall through */ } }
  return fromMemory(key);
}

async function setJson(key, value, ttlSeconds) {
  if (usable()) { try { await client.set(key, JSON.stringify(value), 'EX', ttlSeconds); return; } catch { /* fall through */ } }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// Fixed-window counter for rate limiting: returns { count, resetMs }.
async function hit(key, windowMs) {
  if (usable()) {
    try {
      const results = await client.multi().incr(key).pexpire(key, windowMs, 'NX').pttl(key).exec();
      return { count: results[0][1], resetMs: Math.max(0, results[2][1]) };
    } catch { /* fall through to memory */ }
  }
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || entry.expiresAt <= now) { entry = { value: 0, expiresAt: now + windowMs }; memory.set(key, entry); }
  entry.value++;
  return { count: entry.value, resetMs: entry.expiresAt - now };
}

// null when Redis is not configured; true/false when it is.
function cacheReady() { return process.env.REDIS_URL ? usable() : null; }

async function closeCache() { if (client) { await client.quit().catch(() => client.disconnect()); client = null; connecting = false; } }

// Drop expired in-memory entries periodically.
setInterval(() => { const now = Date.now(); for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k); }, 60000).unref();

// The live Redis client when connected (for modules that need atomic scripts), else null.
const redisClient = () => (usable() ? client : null);

module.exports = { getJson, setJson, hit, cacheReady, closeCache, connectCache: redis, redisClient };
