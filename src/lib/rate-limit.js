// Simple in-memory fixed-window limiter. Adequate for a single-process pm2
// deployment; would need shared storage (e.g. Redis) if ever run multi-process.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const PRUNE_THRESHOLD = 5000;

const attempts = new Map(); // key -> { count, firstAt }

function prune(now) {
  for (const [key, rec] of attempts) {
    if (now - rec.firstAt >= WINDOW_MS) attempts.delete(key);
  }
}

// Returns { limited, retryAfter } without recording anything.
export function checkRateLimit(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec) return { limited: false };
  if (now - rec.firstAt >= WINDOW_MS) {
    attempts.delete(key);
    return { limited: false };
  }
  if (rec.count >= MAX_FAILURES) {
    return { limited: true, retryAfter: Math.ceil((rec.firstAt + WINDOW_MS - now) / 1000) };
  }
  return { limited: false };
}

export function recordFailure(key) {
  const now = Date.now();
  if (attempts.size > PRUNE_THRESHOLD) prune(now);
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt >= WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
  }
}

export function resetRateLimit(key) {
  attempts.delete(key);
}
