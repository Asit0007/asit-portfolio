// Same offline-safe pattern as leaderboardApi.js/whisperApi.js.

export async function fetchVisitorCount() {
  try {
    const res = await fetch('/api/visitors')
    if (!res.ok) return null
    const { count } = await res.json()
    return count
  } catch {
    return null
  }
}

export async function incrementVisitorCount() {
  try {
    const res = await fetch('/api/visitors', { method: 'POST' })
    if (!res.ok) return null
    const { count } = await res.json()
    return count
  } catch {
    return null
  }
}
