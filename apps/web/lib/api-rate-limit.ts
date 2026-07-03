/**
 * Simple in-memory rate limiter.
 * Limits: 60 requests/min per API key (sliding window).
 * In production with multiple instances, use Redis instead.
 */

interface RateWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateWindow>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

// Cleanup stale windows every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of store.entries()) {
      if (w.resetAt < now) store.delete(key);
    }
  }, 5 * 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(keyId: string): RateLimitResult {
  const now = Date.now();
  let w = store.get(keyId) as RateWindow | undefined;

  if (!w || w.resetAt < now) {
    w = { count: 0, resetAt: now + WINDOW_MS };
    store.set(keyId, w);
  }

  w.count++;
  const allowed = w.count <= MAX_REQUESTS;
  return { allowed, remaining: Math.max(0, MAX_REQUESTS - w.count), resetAt: w.resetAt };
}
