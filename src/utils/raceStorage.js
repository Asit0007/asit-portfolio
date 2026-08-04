const KEY = 'circuitBestLapMs'

// localStorage can throw in private-browsing/disabled-storage contexts —
// same defensive try/catch style already used around fallible calls in
// Zones.jsx and MapOverlay.jsx.
export function getBestTime() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

export function setBestTime(ms) {
  try {
    localStorage.setItem(KEY, String(ms))
  } catch {
    // ignore — best time just won't persist this session
  }
}
