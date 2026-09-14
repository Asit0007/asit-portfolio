// ── The road network ──────────────────────────────────────────────────────
// Single source of truth for where tarmac is, the same way src/data/track.js
// owns the circuit. Two things read this and they must not disagree:
//
//   World.jsx        draws it
//   Trees.jsx,       keep their scatter off it
//   EnvironmentModels.jsx
//
// Before this existed each of those carried its own hardcoded idea of where
// the road was — `Math.abs(x) < 6` in one file and `< 8` in another, both
// describing the same two trunk roads — so a prop could clear one check and
// fail the other, and neither knew about any road added later. Anything that
// spawns in the world should ask isOnRoad() rather than re-deriving it.
//
// LAYOUT. Four trunk spokes from the crossroads, four diagonals through the
// jump ramps, a spur to the bowling alley and a connector to the circuit's
// start/finish. Everything in the world is now reachable on tarmac; the open
// desert between the spokes is still there for anyone who would rather cut
// the corner, which is most of the point of a car.
export const ROAD_WIDTH = 8
export const ROAD_HALF = ROAD_WIDTH / 2

// Roads already crossed the circuit before any of these were added — the
// N-S trunk meets it near z=108 and the E-W trunk near x=110 — so the
// bowling spur crossing it too is consistent rather than novel.
export const ROADS = [
  // Trunks, as they have always been.
  { id: 'ns',   from: [0, -110], to: [0, 110],  trunk: true },
  { id: 'ew',   from: [-110, 0], to: [110, 0],  trunk: true },

  // Two north-south spurs at x = ±35, each running through a PAIR of the
  // jump ramps at (±35, ±35), so all four are somewhere you drive to rather
  // than somewhere you stumble on.
  //
  // These were 45-degree diagonals out of the crossroads first, which is the
  // prettier layout and the wrong one: the (0,0)->(-62,-62) leg ran straight
  // through the first two letters of the name, whose whole job is to stay
  // clean (NameTitle.jsx even exports a keep-out for it). Straight spurs
  // clear the name by 13 units at the nearest point, cross the E-W trunk at
  // a proper junction, and cost two segments instead of four.
  { id: 'spurE', from: [ 35, -48], to: [ 35, 48] },
  { id: 'spurW', from: [-35, -48], to: [-35, 48] },

  // To the bowling alley. Routed to the lane's APPROACH end at (-58, 90),
  // not to the alley's centre — a spur up x=-90 arrives side-on and puts a
  // bumper rail across your nose. Coming up x=-58 you meet the run-up
  // pointing down it, which is the end you are meant to bowl from.
  { id: 'bowl', from: [-58, 0], to: [-58, 88] },

  // Short connectors to the two outer ramps, each meeting its FOOT from the
  // direction it climbs — heading 0 climbs toward -Z, heading PI/2 toward
  // -X (Ramps.jsx). These ramps were deliberately moved off the tarmac
  // earlier so nobody meets their high end at road level; connecting them
  // means driving TO them, not through them.
  { id: 'rampS', from: [0, -88],  to: [14, -88] },
  { id: 'rampE', from: [103, 0],  to: [103, 14] },

  // To the circuit's START/FINISH at (45.2, -109): leaves the N-S trunk at
  // its southern end and runs east along the line.
  { id: 'circuit', from: [0, -109], to: [48, -109] },
]

// Squared distance from a point to a segment, in the XZ plane.
function distSqToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az
  const wx = px - ax, wz = pz - az
  const len2 = vx * vx + vz * vz
  let t = len2 > 0 ? (wx * vx + wz * vz) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = px - (ax + t * vx)
  const dz = pz - (az + t * vz)
  return dx * dx + dz * dz
}

// Is (x, z) on the tarmac, or within `margin` of its edge? Margin is what
// callers use to keep an object's own radius clear of the road, not just its
// centre — a tree whose trunk misses the kerb by nothing still hangs over it.
export function isOnRoad(x, z, margin = 0) {
  const r = ROAD_HALF + margin
  const r2 = r * r
  for (const { from, to } of ROADS) {
    if (distSqToSegment(x, z, from[0], from[1], to[0], to[1]) < r2) return true
  }
  return false
}

// Geometry each road segment needs to be drawn: centre, length and heading.
// Derived rather than authored so the drawing can never drift from the
// collision-free zone above.
export const ROAD_SEGMENTS = ROADS.map(({ id, from, to, trunk }) => {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  return {
    id,
    trunk: !!trunk,
    center: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    length: Math.hypot(dx, dz),
    // Rotation about Y for a plane already laid flat. atan2(dx, dz) puts the
    // plane's local +Y (its length) along the segment.
    heading: Math.atan2(dx, dz),
  }
})
