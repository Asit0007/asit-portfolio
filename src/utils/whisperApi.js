// Same offline-safe pattern as leaderboardApi.js — resolves to null on any
// failure (including local dev without the Redis env vars pulled) so the
// UI degrades gracefully instead of erroring.

export async function fetchWhispers() {
  try {
    const res = await fetch('/api/whispers')
    if (!res.ok) return null
    const { entries } = await res.json()
    return entries
  } catch {
    return null
  }
}

export async function submitWhisper(message, x, z) {
  try {
    const res = await fetch('/api/whispers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, x, z }),
    })
    if (!res.ok) return null
    const { entries } = await res.json()
    return entries
  } catch {
    return null
  }
}
