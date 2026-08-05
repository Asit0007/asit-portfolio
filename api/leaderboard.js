import { Redis } from '@upstash/redis'

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
      const { name, timeMs } = req.body || {}
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 12) : ''
      const cleanTime = Number(timeMs)
      // Minimal sanity validation, matching folio's own light-touch approach
      // (a 3-letter tag requirement) rather than real anti-cheat.
      if (!cleanName || !Number.isFinite(cleanTime) || cleanTime <= 0 || cleanTime > 3600000) {
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
