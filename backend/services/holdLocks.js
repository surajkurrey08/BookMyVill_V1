const { redisClient } = require('../shared/cache');

// Temporary checkout holds (availability domain), stored in Redis — MongoDB
// keeps only permanent nights (bookings, blocks, quotation holds).
//
//   booking:hold:<scope>:<date>   value = hold token (the CustomerHold id), PX TTL
//   booking:holdref:<token>       "scope|date,date,..." so the hold can be released/extended
//
// <scope> is the villa id for whole-villa listings (one guest holds the whole
// villa) and "<villaId>:<roomId>" for room-by-room listings.
//
// acquire() is one Lua script: either every night is free (or already ours) and
// all are set with the TTL, or nothing is written. release()/extend() only touch
// keys whose value is still our token, so an expired-then-retaken night is never
// freed by its previous holder. Expiry is automatic (no permanent locks).
// Without Redis (local runs/tests) an in-process store gives the same semantics.

const NIGHT = (scope, date) => `booking:hold:${scope}:${date}`;
const REF = token => `booking:holdref:${token}`;

const ACQUIRE = `
for i = 1, #KEYS - 1 do
  local v = redis.call('GET', KEYS[i])
  if v and v ~= ARGV[1] then return 0 end
end
for i = 1, #KEYS - 1 do redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2]) end
redis.call('SET', KEYS[#KEYS], ARGV[3], 'PX', ARGV[2])
return 1`;
const RELEASE = `
local n = 0
for i = 1, #KEYS - 1 do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]); n = n + 1 end
end
redis.call('DEL', KEYS[#KEYS])
return n`;
const EXTEND = `
local n = 0
for i = 1, #KEYS - 1 do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('PEXPIRE', KEYS[i], ARGV[2]); n = n + 1 end
end
if n == #KEYS - 1 then redis.call('PEXPIRE', KEYS[#KEYS], ARGV[2]) end
return n`;

// ---- in-process fallback ----
const memory = new Map(); // key -> { value, expiresAt }
const mget = key => { const e = memory.get(key); if (!e) return null; if (e.expiresAt <= Date.now()) { memory.delete(key); return null; } return e.value; };
const mset = (key, value, ttl) => memory.set(key, { value, expiresAt: Date.now() + Number(ttl) });
const memoryScripts = {
  acquire(keys, [token, ttl, ref]) {
    const nights = keys.slice(0, -1);
    if (nights.some(k => { const v = mget(k); return v && v !== token; })) return 0;
    nights.forEach(k => mset(k, token, ttl)); mset(keys.at(-1), ref, ttl); return 1;
  },
  release(keys, [token]) { let n = 0; for (const k of keys.slice(0, -1)) if (mget(k) === token) { memory.delete(k); n++; } memory.delete(keys.at(-1)); return n; },
  extend(keys, [token, ttl]) {
    let n = 0; const nights = keys.slice(0, -1);
    for (const k of nights) if (mget(k) === token) { memory.get(k).expiresAt = Date.now() + Number(ttl); n++; }
    if (n === nights.length && memory.has(keys.at(-1))) memory.get(keys.at(-1)).expiresAt = Date.now() + Number(ttl);
    return n;
  }
};
setInterval(() => { const now = Date.now(); for (const [k, e] of memory) if (e.expiresAt <= now) memory.delete(k); }, 60000).unref();

// Fail safe: if Redis is configured but unreachable, refuse new holds instead
// of silently using per-process memory (replicas would not see each other).
function client() {
  const live = redisClient();
  if (!live && process.env.REDIS_URL) throw Object.assign(new Error('Booking holds are temporarily unavailable. Please try again in a minute.'), { status: 503 });
  return live;
}

async function run(script, keys, args) {
  const client = redisClient();
  if (!client && process.env.REDIS_URL) throw Object.assign(new Error('Booking holds are temporarily unavailable. Please try again in a minute.'), { status: 503 });
  if (client) return Number(await client.eval({ acquire: ACQUIRE, release: RELEASE, extend: EXTEND }[script], keys.length, ...keys, ...args.map(String)));
  return memoryScripts[script](keys, args.map(String));
}
async function getMany(keys) {
  if (!keys.length) return [];
  const client = module.exports._client();
  return client ? client.mget(keys) : keys.map(mget);
}
async function refOf(token) {
  const client = module.exports._client();
  const raw = client ? await client.get(REF(token)) : mget(REF(token));
  if (!raw) return null;
  const [scope, dates] = raw.split('|');
  return { scope, dates: dates ? dates.split(',') : [] };
}

// Scope for a unit: whole-villa listings lock the villa, others the room.
const scopeFor = (propertyId, roomId, wholeVilla) => (wholeVilla ? String(propertyId) : `${propertyId}:${roomId}`);

async function acquire({ scope, dates, token, ttlMs }) {
  const keys = [...dates.map(d => NIGHT(scope, d)), REF(token)];
  return (await run('acquire', keys, [String(token), Math.max(1000, ttlMs), `${scope}|${dates.join(',')}`])) === 1;
}

async function release(token) {
  const ref = await refOf(String(token));
  if (!ref) return 0;
  return run('release', [...ref.dates.map(d => NIGHT(ref.scope, d)), REF(token)], [String(token)]);
}

// Extends every night of the hold; false if any night is no longer ours.
async function extend(token, ttlMs) {
  const ref = await refOf(String(token));
  if (!ref) return false;
  return (await run('extend', [...ref.dates.map(d => NIGHT(ref.scope, d)), REF(token)], [String(token), Math.max(1000, ttlMs)])) === ref.dates.length;
}

// True when the hold still owns all of its nights.
async function isHeld(token) {
  const ref = await refOf(String(token));
  if (!ref || !ref.dates.length) return false;
  const values = await getMany(ref.dates.map(d => NIGHT(ref.scope, d)));
  return values.every(v => v === String(token));
}

// Dates in `dates` held by someone other than `ignoreToken`, per scope.
async function heldDates(scopes, dates, ignoreToken = null) {
  const pairs = scopes.flatMap(scope => dates.map(date => ({ scope, date, key: NIGHT(scope, date) })));
  const values = await getMany(pairs.map(p => p.key));
  const held = new Map();
  pairs.forEach((p, i) => { if (values[i] && values[i] !== String(ignoreToken)) { if (!held.has(p.scope)) held.set(p.scope, new Set()); held.get(p.scope).add(p.date); } });
  return held;
}

const releaseForHold = token => release(token).catch(() => 0);

module.exports = { scopeFor, acquire, release, releaseForHold, extend, isHeld, heldDates, _memory: memory, _client: client };
