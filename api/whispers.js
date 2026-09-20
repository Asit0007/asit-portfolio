import { Redis } from '@upstash/redis'
import { rateLimit, tooManyRequests, clientKey, WORLD_LIMIT } from './_ratelimit'

// Same shape as api/leaderboard.js — see that file for the Redis.fromEnv()
// env-var-fallback reasoning.
const WHISPERS_KEY = 'whispers'
const MAX_ACTIVE = 30 // folio-2025's own cap on active whisper messages
const MAX_MESSAGE_LEN = 30 // folio-2025's own per-message character limit

function normalizeEntry(raw) {
  // The base @upstash/redis Command deserializer auto-JSON-parses list
  // elements, so `raw` is normally already an object — this just also
  // tolerates a raw string, defensively, in case that ever isn't true.
  const entry = typeof raw === 'string' ? JSON.parse(raw) : raw
  return {
    id: entry.id,
    message: entry.message,
    x: entry.x,
    z: entry.z,
  }
}

export default async function handler(req, res) {
  let redis
  try {
    redis = Redis.fromEnv()
  } catch {
    return res.status(503).json({ error: 'whispers not configured' })
  }

  try {
    if (req.method === 'GET') {
      const raw = await redis.lrange(WHISPERS_KEY, 0, MAX_ACTIVE - 1)
      return res.status(200).json({ entries: raw.map(normalizeEntry) })
    }

    if (req.method === 'POST') {
      // 3 an hour per address. A visitor leaves one comment, and the client
      // already limits itself to one per browser (whisperStorage.js) -- this is
      // only here for callers that skip the client, for whom 30 posts is a full
      // wipe of the board.
      const limit = await rateLimit(redis, { key: `w:${clientKey(req)}`, limit: 3, windowSec: 3600 })
      if (!limit.ok) return tooManyRequests(res, limit.retryAfter)

      const { message, x, z } = req.body || {}
      const cleanMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : ''
      const cleanX = Number(x)
      const cleanZ = Number(z)
      if (!cleanMessage || !Number.isFinite(cleanX) || !Number.isFinite(cleanZ)) {
        return res.status(400).json({ error: 'invalid submission' })
      }
      // isFinite accepts 1e308, which is a marker parked at the edge of float
      // precision rather than anywhere a car has been.
      if (Math.abs(cleanX) > WORLD_LIMIT || Math.abs(cleanZ) > WORLD_LIMIT) {
        return res.status(400).json({ error: 'position out of bounds' })
      }
      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message: cleanMessage, x: cleanX, z: cleanZ }
      await redis.lpush(WHISPERS_KEY, JSON.stringify(entry))
      // Keep only the most recent MAX_ACTIVE — oldest evicted automatically
      // (lpush prepends, so index 0 is newest; trimming to [0, MAX_ACTIVE-1]
      // drops anything older than that).
      await redis.ltrim(WHISPERS_KEY, 0, MAX_ACTIVE - 1)
      const raw = await redis.lrange(WHISPERS_KEY, 0, MAX_ACTIVE - 1)
      return res.status(200).json({ entries: raw.map(normalizeEntry) })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'server error' })
  }
}
