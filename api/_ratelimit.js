import { createHash } from 'node:crypto'

// Shared abuse limits for the three write endpoints. Vercel does not route files
// under api/ whose name starts with `_`, so this is a module, not an endpoint.
//
// Why this exists: all three routes are unauthenticated by design — a visitor
// should be able to leave a comment or a lap time without an account — and until
// now they were also unmetered. That combination is not "light-touch", it is a
// public write primitive:
//
//   * 30 POSTs to /api/whispers replace every comment in the world, because the
//     list is LTRIMmed to the 30 newest. The replacement renders in 3D on the
//     site I send to recruiters.
//   * 100 POSTs to /api/leaderboard at timeMs=1..100 take all 100 slots the
//     sorted set keeps, flushing every real lap time out of it.
//   * /api/visitors is a bare INCR, so the counter on the page is whatever the
//     last person with curl decided it should be.
//
// None of that needs a bug — it is the documented behaviour of the endpoints,
// reachable with one shell loop. And every one of those requests is a billed
// Upstash command, so the same loop drains the free tier and takes the other two
// features offline with it.
//
// A per-IP fixed window does not make the endpoints authenticated; it makes the
// attack cost real and keeps the blast radius inside one window.

/**
 * Vercel terminates TLS in front of the function, so the client address arrives
 * in x-forwarded-for (client first, then proxies). Everything here is spoofable
 * by a determined caller — this is an abuse speed bump, not an access control.
 */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  const first = Array.isArray(xff) ? xff[0] : String(xff || '').split(',')[0]
  return first.trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

/**
 * Keys are a truncated SHA-256 of the address, never the address itself. The
 * counter only has to tell two callers apart; keeping a log of who visited a
 * personal site in a third-party database is a liability with no upside, and a
 * hash keeps this out of GDPR territory for what is a spam control.
 */
export function clientKey(req) {
  return createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16)
}

/**
 * Fixed-window counter. INCR is atomic, so concurrent callers cannot both see 1
 * and both skip the EXPIRE; the window is stamped into the key so a lost EXPIRE
 * can strand at most one window's key, which Upstash evicts on its own.
 *
 * Fails OPEN: if Redis is unreachable the endpoint keeps working unmetered. A
 * comment box that refuses everyone the moment the rate limiter has a bad day is
 * a worse outcome for this site than a window of unmetered writes.
 *
 * @returns {Promise<{ok: boolean, retryAfter: number}>}
 */
export async function rateLimit(redis, { key, limit, windowSec }) {
  const window = Math.floor(Date.now() / 1000 / windowSec)
  const redisKey = `rl:${key}:${window}`
  try {
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSec)
    if (count > limit) {
      const elapsed = Math.floor(Date.now() / 1000) % windowSec
      return { ok: false, retryAfter: Math.max(1, windowSec - elapsed) }
    }
    return { ok: true, retryAfter: 0 }
  } catch {
    return { ok: true, retryAfter: 0 }
  }
}

/** Sends the 429 in the shape the front end's `res.ok` checks already handle. */
export function tooManyRequests(res, retryAfter) {
  res.setHeader('Retry-After', String(retryAfter))
  return res.status(429).json({ error: 'rate limited', retryAfter })
}

/**
 * The world is roughly 450 units to the dismissible "lift home" panel, so a
 * coordinate past ±2000 is not a place anyone drove to. Number.isFinite alone
 * accepts 1e308, which renders as a marker at the edge of float precision.
 */
export const WORLD_LIMIT = 2000
