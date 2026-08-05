const KEY = 'hasCountedVisit'

// Same dedup pattern as raceStorage.js/achievementStorage.js — a repeat
// visit or page refresh shouldn't inflate the count.
export function hasCountedVisit() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markCountedVisit() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // ignore
  }
}
