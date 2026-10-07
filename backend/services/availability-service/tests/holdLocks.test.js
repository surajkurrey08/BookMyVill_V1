// availability-service: temporary checkout holds (services/holdLocks).
// Runs against the in-process store that mirrors the Redis Lua scripts.
process.env.REDIS_URL = '';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const holdLocks = require('../../../services/holdLocks');
const { closeCache } = require('../../../shared/cache');

const dates = ['2030-01-01', '2030-01-02', '2030-01-03'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
after(() => closeCache());

test('acquire is all-or-nothing: an overlapping hold by another token takes nothing', async () => {
  assert.equal(await holdLocks.acquire({ scope: 'villa-a', dates, token: 'hold-1', ttlMs: 60000 }), true);
  assert.equal(await holdLocks.acquire({ scope: 'villa-a', dates: ['2030-01-03', '2030-01-04'], token: 'hold-2', ttlMs: 60000 }), false);
  const held = await holdLocks.heldDates(['villa-a'], ['2030-01-03', '2030-01-04']);
  assert.deepEqual([...held.get('villa-a')], ['2030-01-03'], 'the free night was not partially taken');
  assert.equal(await holdLocks.acquire({ scope: 'villa-a', dates, token: 'hold-1', ttlMs: 60000 }), true, 'the owner can re-acquire its own nights');
  await holdLocks.release('hold-1');
});

test('only one of many concurrent holds for the same nights wins', async () => {
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) => holdLocks.acquire({ scope: 'villa-race', dates, token: `racer-${i}`, ttlMs: 60000 })));
  assert.equal(results.filter(Boolean).length, 1);
  const winner = `racer-${results.indexOf(true)}`;
  assert.equal(await holdLocks.isHeld(winner), true);
  await holdLocks.release(winner);
});

test('release and extend only touch nights still owned by the token', async () => {
  assert.equal(await holdLocks.acquire({ scope: 'villa-b', dates, token: 'owner', ttlMs: 60000 }), true);
  assert.equal(await holdLocks.release('stranger'), 0, 'an unknown token frees nothing');
  assert.equal(await holdLocks.isHeld('owner'), true);
  assert.equal(await holdLocks.extend('owner', 120000), true);
  assert.equal(await holdLocks.release('owner'), dates.length);
  assert.equal(await holdLocks.isHeld('owner'), false);
  assert.equal(await holdLocks.extend('owner', 120000), false, 'a released hold cannot be extended');
});

test('holds expire by TTL and an expired hold never frees the next guest\'s nights', async () => {
  assert.equal(await holdLocks.acquire({ scope: 'villa-c', dates, token: 'slow', ttlMs: 1000 }), true);
  await sleep(1100);
  assert.equal(await holdLocks.isHeld('slow'), false, 'expired automatically');
  assert.equal(await holdLocks.acquire({ scope: 'villa-c', dates, token: 'next', ttlMs: 60000 }), true);
  assert.equal(await holdLocks.release('slow'), 0);
  assert.equal(await holdLocks.isHeld('next'), true, 'the previous holder did not release the new hold');
  await holdLocks.release('next');
});

test('heldDates ignores the caller\'s own token (used when converting a hold to a booking)', async () => {
  await holdLocks.acquire({ scope: 'villa-d', dates, token: 'mine', ttlMs: 60000 });
  assert.equal((await holdLocks.heldDates(['villa-d'], dates, 'mine')).size, 0);
  assert.equal((await holdLocks.heldDates(['villa-d'], dates, 'other')).get('villa-d').size, dates.length);
  await holdLocks.release('mine');
});

test('fails safe: with REDIS_URL set but Redis unreachable, new holds are refused (503)', async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
  try {
    await assert.rejects(holdLocks.acquire({ scope: 'villa-e', dates, token: 'x', ttlMs: 60000 }), error => error.status === 503);
  } finally {
    process.env.REDIS_URL = '';
    await closeCache();
  }
});
