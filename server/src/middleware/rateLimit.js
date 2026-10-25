// A bounded in-memory limiter is sufficient for this single-instance monolith.
export function rateLimit(max, windowMs = 60_000) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.reset <= now) buckets.delete(key);
    const key = req.userId || req.ip;
    let entry = buckets.get(key);
    if (!entry) {
      if (buckets.size >= 10_000) return res.status(429).json({ error: 'Server busy. Try again shortly.' });
      entry = { count: 0, reset: now + windowMs };
      buckets.set(key, entry);
    }
    if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
    }
    next();
  };
}
