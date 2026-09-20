import { Redis } from '@upstash/redis'
import { rateLimit, tooManyRequests, clientKey } from './_ratelimit.js'

// Redis.fromEnv() checks UPSTASH_REDIS_REST_URL/TOKEN first, falling back to
// KV_REST_API_URL/TOKEN — covers whichever naming the Vercel Marketplace
// Redis integration ends up using. Constructed lazily inside the handler
// (not at module scope) so a missing env var in local dev throws inside the
// try/catch below instead of crashing the function on cold start.
// Versioned: bumped alongside src/utils/raceStorage.js's KEY when the
// track's shape/length changes, so old entries from the previous (much
// smaller) track don't sit alongside times on the new one as if comparable.
const LEADERBOARD_KEY = 'circuit-leaderboard-v2'
const MAX_ENTRIES = 100
const TOP_N = 10
// A floor on the absurd, deliberately nowhere near a real lap. The standing
// record on this track is 23.3s, so 10s leaves better than a 2x margin for a
// faster driver, a tuned car or a shorter future circuit -- while still rejecting
// the timeMs=1 submission that used to be accepted and would sit at the top of
// the board forever. If the track ever gets meaningfully shorter, check this
// against the live board before trusting it.
//
// It is NOT anti-cheat: a plausible-but-fake 21s still gets in. Catching that
// needs the server to validate the drive, which is a different project.
const MIN_LAP_MS = 10000

function toEntries(flat) {
  const entries = []
  for (let i = 0; i < flat.length; i += 2) {
    const [name] = String(flat[i]).split('#')
    entries.push({ name, timeMs: Number(flat[i + 1]) })
  }
  return entries
}

export default async function handler(req, res) {
  let redis
  try {
    redis = Redis.fromEnv()
  } catch {
    return res.status(503).json({ error: 'leaderboard not configured' })
  }

  try {
    if (req.method === 'GET') {
      const flat = await redis.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, { withScores: true })
      return res.status(200).json({ entries: toEntries(flat) })
    }

    if (req.method === 'POST') {
      // 10 an hour. A lap takes ~25s at record pace, so a human would have to
      // drive four flawless personal bests in an hour to feel this; 100 scripted
      // submissions cannot, and 100 is exactly the number of slots the set keeps.
      const limit = await rateLimit(redis, { key: `lb:${clientKey(req)}`, limit: 10, windowSec: 3600 })
      if (!limit.ok) return tooManyRequests(res, limit.retryAfter)

      const { name, timeMs } = req.body || {}
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 12) : ''
      const cleanTime = Number(timeMs)
      // Minimal sanity validation, matching folio's own light-touch approach
      // (a 3-letter tag requirement) rather than real anti-cheat.
      if (!cleanName || !Number.isFinite(cleanTime) || cleanTime < MIN_LAP_MS || cleanTime > 3600000) {
        return res.status(400).json({ error: 'invalid submission' })
      }
      const member = `${cleanName}#${Date.now()}`
      await redis.zadd(LEADERBOARD_KEY, { score: cleanTime, member })
      // Keep only the fastest MAX_ENTRIES (ascending score = fastest first,
      // so trim everyone ranked at/after MAX_ENTRIES).
      await redis.zremrangebyrank(LEADERBOARD_KEY, MAX_ENTRIES, -1)
      const flat = await redis.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, { withScores: true })
      return res.status(200).json({ entries: toEntries(flat) })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'server error' })
  }
}
