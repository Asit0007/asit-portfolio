import * as THREE from 'three'

// Single source of truth for the racing circuit's geometry — the big
// wraparound loop replacing the old small NE-corner ring. Verified via a
// throwaway Node script (CatmullRomCurve3 against every real hazard box:
// the 4 content zones, bowling, and the ±160 boundary walls) before these
// numbers were finalized — every clearance below is positive with margin,
// not eyeballed. See the plan doc for the full verification numbers.
//
// Checkpoint 5 is a deliberate anchor sitting exactly on bowling's bearing
// (135°) at a pulled-in radius: without it, the curve between checkpoints
// 4 and 6 bulges toward bowling and clips its clearance. Keep it even
// though it isn't visually interesting on its own — it's load-bearing for
// the curve shape.
export const PATH_WIDTH = 10
export const BORDER_WIDTH = 0.6
export const PATH_SEGMENTS_PER_GAP = 14
export const CHECK_RADIUS = 14

export const CHECKPOINTS = [
  { id: 0, position: [45.2, -109.0], label: 'START / FINISH' },
  { id: 1, position: [131.2, -54.3], label: 'CHECKPOINT 1' },
  { id: 2, position: [131.2, 54.3],  label: 'CHECKPOINT 2' },
  { id: 3, position: [45.2, 109.0],  label: 'CHECKPOINT 3' },
  { id: 4, position: [-29.0, 108.2], label: 'CHECKPOINT 4' },
  { id: 5, position: [-52.3, 52.3],  label: 'CHECKPOINT 5' },
  { id: 6, position: [-108.2, 29.0], label: 'CHECKPOINT 6' },
  { id: 7, position: [-109.0, -45.2],label: 'CHECKPOINT 7' },
  { id: 8, position: [-54.3, -131.2],label: 'CHECKPOINT 8' },
]

// Sampled once at module load — reused by TrackPath's mesh baking (Circuit.jsx)
// and by the prop-exclusion check below, instead of each computing its own copy.
export const TRACK_SAMPLES = (() => {
  const curvePoints = CHECKPOINTS.map(
    (cp) => new THREE.Vector3(cp.position[0], 0.03, cp.position[1])
  )
  const curve = new THREE.CatmullRomCurve3(curvePoints, true)
  return curve.getPoints(CHECKPOINTS.length * PATH_SEGMENTS_PER_GAP)
})()

const TRACK_HALF_WIDTH = PATH_WIDTH / 2 + BORDER_WIDTH

// Reusable exclusion check — previously missing entirely, which is why
// trees/rocks could spawn directly on the old track's surface. Trees.jsx
// and EnvironmentModels.jsx's RockScatter both call this alongside their
// existing zone-box checks.
export function isNearTrack(x, z, marginUnits = 0) {
  const threshold = TRACK_HALF_WIDTH + marginUnits
  for (let i = 0; i < TRACK_SAMPLES.length; i++) {
    const p = TRACK_SAMPLES[i]
    const dx = p.x - x
    const dz = p.z - z
    if (dx * dx + dz * dz < threshold * threshold) return true
  }
  return false
}
