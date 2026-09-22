// functions/_lib/ratelimit.js — best-effort in-memory rate limiter (per isolate)
//
// Cloudflare Workers keep module state alive between requests on the same isolate,
// so this reliably slows down a single client hammering one edge location. It is not
// a global guarantee (multiple isolates/colos each keep their own counters). For a
// strict global limit, bind a KV namespace or use Cloudflare's WAF rate-limiting rules.

const buckets = new Map(); // key -> { count, resetAt }
const MAX_KEYS = 10_000;

function sweep(now) {
    if (buckets.size < MAX_KEYS) return;
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
    const now = Date.now();
    sweep(now);
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
    }
    b.count += 1;
    const allowed = b.count <= limit;
    return {
        allowed,
        remaining: Math.max(0, limit - b.count),
        retryAfterSec: allowed ? 0 : Math.ceil((b.resetAt - now) / 1000),
    };
}

/** Forget a key (e.g. after a successful login so a legit user is not penalised). */
export function resetRateLimit(key) {
    buckets.delete(key);
}
