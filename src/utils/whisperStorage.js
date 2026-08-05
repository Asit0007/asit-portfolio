const KEY = 'hasWhispered'

// Client-side-only one-per-visitor enforcement — same proportionate,
// non-strict validation philosophy already applied to the leaderboard
// (light-touch, not real anti-abuse; matches this project's actual risk
// level as a personal portfolio, not a philosophy gap).
export function hasWhispered() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markWhispered() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // ignore — just won't persist this session
  }
}
