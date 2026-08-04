const VISITED_KEY  = 'visitedZones'
const ACHIEVED_KEY = 'achievedIds'

// Same localStorage try/catch wrapper pattern as raceStorage.js.
export function getVisitedZones() {
  try {
    const raw = localStorage.getItem(VISITED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setVisitedZones(ids) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(ids))
  } catch {
    // ignore — just won't persist this session
  }
}

// Which achievement ids have already toasted, so returning visitors don't
// get re-notified for things they already unlocked.
export function getAchieved() {
  try {
    const raw = localStorage.getItem(ACHIEVED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setAchieved(ids) {
  try {
    localStorage.setItem(ACHIEVED_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}
