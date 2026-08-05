import { Redis } from '@upstash/redis'

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
      const { message, x, z } = req.body || {}
      const cleanMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : ''
      const cleanX = Number(x)
      const cleanZ = Number(z)
      if (!cleanMessage || !Number.isFinite(cleanX) || !Number.isFinite(cleanZ)) {
        return res.status(400).json({ error: 'invalid submission' })
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
