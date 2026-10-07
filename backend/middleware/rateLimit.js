const { hit } = require('../shared/cache');

// Fixed-window, per-IP rate limiter for unauthenticated endpoints. Counters
// live in Redis when REDIS_URL is set (shared by every replica of a service)
// and fall back to process memory otherwise.
module.exports = function rateLimit({ windowMs = 60000, max = 30, keyPrefix = 'rl', message = 'Too many requests. Please wait a minute and try again.' } = {}) {
  return async function rateLimiter(req, res, next) {
    try {
      const { count, resetMs } = await hit(`${keyPrefix}:${req.ip}`, windowMs);
      if (count > max) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(resetMs / 1000))));
        return res.status(429).json({ msg: message });
      }
    } catch { /* a limiter outage must not block guests */ }
    next();
  };
};
