// Versioned: bumped when the track's actual shape/length changes, so a
// returning visitor's old best time (no longer comparable to the new
// track) doesn't linger and silently block the "new best" flow forever.
const KEY = 'circuitBestLapMsV2'

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
