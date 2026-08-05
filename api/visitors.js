import { Redis } from '@upstash/redis'

// Same shape as api/leaderboard.js / api/whispers.js.
const VISITORS_KEY = 'total-visitors'

export default async function handler(req, res) {
  let redis
  try {
    redis = Redis.fromEnv()
  } catch {
    return res.status(503).json({ error: 'visitor counter not configured' })
  }

  try {
    if (req.method === 'GET') {
      const count = (await redis.get(VISITORS_KEY)) ?? 0
      return res.status(200).json({ count: Number(count) })
    }

    if (req.method === 'POST') {
      // Called once per unique visitor (client dedupes via localStorage —
      // see visitorStorage.js) — no per-request validation needed beyond
      // the method check itself.
      const count = await redis.incr(VISITORS_KEY)
      return res.status(200).json({ count })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'server error' })
  }
}
