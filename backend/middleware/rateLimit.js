// Fixed-window, per-IP rate limiter for unauthenticated endpoints. State is
// in memory, which matches the single backend container this app runs as; a
// multi-instance deployment would need a shared store instead.
module.exports = function rateLimit({ windowMs = 60000, max = 30, keyPrefix = 'rl', message = 'Too many requests. Please wait a minute and try again.' } = {}) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ msg: message });
    }
    next();
  };
};
