// ── The road network ──────────────────────────────────────────────────────
// Single source of truth for where tarmac is, the same way src/data/track.js
// owns the circuit. Three things read this and they must not disagree:
//
//   World.jsx              draws it
//   MapOverlay.jsx         draws it again, on the map
//   Trees.jsx,             keep their scatter off it via isOnRoad()
//   EnvironmentModels.jsx
//
// Before this existed each of those carried its own hardcoded idea of where
// the road was — `Math.abs(x) < 6` in one file and `< 8` in another — so a
// prop could clear one check and fail the other, and nothing knew about a
// road added later. Anything that spawns should ask isOnRoad().
//
// ── Layout: "Roundabout & Radials" ───────────────────────────────────────
// A paved CIRCUS at the crossroads, four radials out through the résumé
// zones, and a CRESCENT in each quadrant that leaves an east/west radial,
// takes in that quadrant's jump ramp and rejoins a north/south radial.
// Plus a sweeping branch to the bowling alley, one to the circuit's
// start/finish, and short connectors to the two outer ramps.
//
// Roads are POLYLINES, not segments, so a curve is just a finely sampled
// one — isOnRoad() walks consecutive pairs and the renderer builds one
// merged ribbon. A straight road is a two-point polyline.
//
// Roads deliberately cross the circuit; the trunks always did, near z=108
// and x=110.
export const ROAD_WIDTH = 8
export const ROAD_HALF = ROAD_WIDTH / 2

// The paved disc at the crossroads. The car spawns in the middle of it and
// the road instructions are painted on it (they reach x≈15.4, inside this),
// which is the whole reason it is paved rather than a planted island: a
// roundabout you spawn inside and cannot drive off would be a trap, and a
// ring of sand between the start pad and the rim would read as unfinished.
export const CIRCUS_R = 20

const RADIAL_END = 112

// Quadratic bezier — enough for every curve here, and cheap to sample.
function bez(p0, p1, p2, steps = 20) {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ])
  }
  return out
}


// One crescent per quadrant: leaves the east/west radial at ±24, bows out
// through that quadrant's ramp at (±35, ±35), and rejoins the north/south
// radial inside the zone plaza.
//
// The obvious shape — a straight 45° diagonal from the circus rim to the
// ramp — was drawn first and does not survive contact with the world: in
// the north-west quadrant it runs through the first two letters of the
// name, which is the one thing that has to stay clean. Leaving from the
// SIDE instead bows the curve clear of the name's box entirely.
// ── The ring ─────────────────────────────────────────────────────────────
// A circular ring road threading all four jump ramps and crossing all four
// radials. Radius is 35*sqrt(2) exactly, so the ring passes THROUGH the
// ramps where they already stand, and it meets each radial square on.
//
// Two shapes were tried and thrown away first, both for the same reason:
// they crossed a ramp sideways. A 45-degree diagonal from the circus rim
// also ran through the first two letters of the name. A quadrant crescent
// bowed to miss the ramp came no closer than 8 units to its centre when 13
// were needed, because a quadratic bezier sags inside its control point.
// The ring solves it by construction — the road's TANGENT at each ramp is
// the ramp's own climb axis, so you drive up it rather than into its side
// (the four headings in Ramps.jsx are set from this; see the note there).
const RING_R = 35 * Math.SQRT2

function ring(steps = 96) {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    out.push([Math.cos(a) * RING_R, Math.sin(a) * RING_R])
  }
  return out
}

export const ROADS = [
  // Radials. `trunk` earns the centre dashes — what makes a road read as a
  // road rather than a path, and not worth the geometry on every branch.
  { id: 'radN', trunk: true, points: [[0, -CIRCUS_R], [0, -RADIAL_END]] },
  { id: 'radS', trunk: true, points: [[0,  CIRCUS_R], [0,  RADIAL_END]] },
  { id: 'radW', trunk: true, points: [[-CIRCUS_R, 0], [-RADIAL_END, 0]] },
  { id: 'radE', trunk: true, points: [[ CIRCUS_R, 0], [ RADIAL_END, 0]] },

  { id: 'ring', points: ring() },

  // To the bowling alley's APPROACH end at (-58, 90) — not to the alley's
  // centre. Arriving at the centre puts a bumper rail across your nose;
  // this meets the run-up pointing down it.
  { id: 'bowl', points: bez([-72, 0], [-86, 52], [-58, 90], 26) },

  // To the circuit's START/FINISH, sweeping off the north radial.
  { id: 'circuit', points: bez([0, -86], [18, -108], [45.2, -109], 24) },

  // The two outer ramps, each met at its FOOT from the direction it climbs
  // (heading 0 climbs toward -Z, PI/2 toward -X — see Ramps.jsx). They were
  // deliberately moved off the tarmac earlier so nobody meets their high
  // end at road level; connecting them should not undo that.
  { id: 'rampS', points: bez([0, -70], [14, -74], [14, -87], 14) },
  { id: 'rampE', points: bez([90, 0], [103, 3], [103, 14], 14) },
]

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

// Per-road bounding box, so the common case — a prop nowhere near a given
// road — rejects in four comparisons instead of walking every segment of a
// sampled curve. This runs a few thousand times while the scatter places
// itself, and the curves turned 8 segments into several hundred.
const BOUNDS = ROADS.map(({ points }) => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, maxX, minZ, maxZ }
})

// Is (x, z) on the tarmac, or within `margin` of its edge? Margin is what
// callers use to keep an object's own radius clear of the road, not just
// its centre — a tree whose trunk misses the kerb by nothing still hangs
// over it.
export function isOnRoad(x, z, margin = 0) {
  // The circus is a filled disc, not a ribbon, so it gets its own test.
  const cr = CIRCUS_R + margin
  if (x * x + z * z < cr * cr) return true
  const r = ROAD_HALF + margin
  const r2 = r * r
  for (let i = 0; i < ROADS.length; i++) {
    const b = BOUNDS[i]
    if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue
    const pts = ROADS[i].points
    for (let j = 0; j < pts.length - 1; j++) {
      if (distSqToSegment(x, z, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]) < r2) {
        return true
      }
    }
  }
  return false
}

// Ribbon rows for one polyline: each point carries the lateral normal the
// ribbon builder offsets along. The normal at a joint is taken from the
// average of the two adjacent segment directions, which is what keeps a
// curve watertight instead of showing a wedge at every sample.
export function roadRows(points) {
  const n = points.length
  const rows = []
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(n - 1, i + 1)]
    let tx = next[0] - prev[0]
    let tz = next[1] - prev[1]
    const len = Math.hypot(tx, tz) || 1
    tx /= len; tz /= len
    // (tz, -tx), matching Circuit.jsx's PERPS. The opposite handedness
    // builds the ribbon with its triangles wound the other way, so the
    // whole road renders facing DOWN and is backface-culled — visible only
    // from underneath, which looks exactly like the asphalt failing to
    // render at all while the edge lines still draw.
    rows.push({ x: points[i][0], z: points[i][1], nx: tz, nz: -tx })
  }
  return rows
}
