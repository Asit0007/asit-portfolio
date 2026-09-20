import { Redis } from '@upstash/redis'
import { clientKey } from './_ratelimit.js'

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
      // The client dedupes via localStorage (visitorStorage.js), but that is the
      // honour system: this used to be a bare INCR, so `while true; do curl -XPOST
      // ...; done` set the number on the page to whatever it liked. A counter
      // anyone can dictate is worse than no counter, because it still looks like
      // a measurement.
      //
      // SET NX is the dedupe: the first POST from an address claims the key and
      // increments, every later one finds it taken and just reads the total back.
      // 30 days, so a genuine return visit months later still counts. The key is
      // a hash of the address, never the address (see clientKey).
      //
      // This does undercount: an office or a campus behind one NAT now counts
      // once. That is the right side to err on for a number displayed as a fact
      // on the page -- an undercount is still a measurement, an unbounded INCR
      // is just a text field with extra steps.
      const seenKey = `visitor:${clientKey(req)}`
      const isNew = await redis.set(seenKey, 1, { nx: true, ex: 60 * 60 * 24 * 30 })
      if (!isNew) {
        const current = (await redis.get(VISITORS_KEY)) ?? 0
        return res.status(200).json({ count: Number(current) })
      }
      const count = await redis.incr(VISITORS_KEY)
      return res.status(200).json({ count })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'server error' })
  }
}
