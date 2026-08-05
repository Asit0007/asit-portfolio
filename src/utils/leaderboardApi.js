// Talks to /api/leaderboard.js. Resolves to null on any failure (not just
// network errors — also a 503 when the Redis env vars aren't configured,
// which is expected in local dev unless `vercel env pull` was run) so the
// UI can show an "OFFLINE" state exactly like folio's own leaderboard does
// when its server is unreachable, rather than breaking anything.

export async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard')
    if (!res.ok) return null
    const { entries } = await res.json()
    return entries
  } catch {
    return null
  }
}

export async function submitScore(name, timeMs) {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, timeMs }),
    })
    if (!res.ok) return null
    const { entries } = await res.json()
    return entries
  } catch {
    return null
  }
}
