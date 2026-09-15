import * as THREE from 'three'

// Builds a ribbon: a strip of quads swept along `rows` (each carrying a
// position and the lateral normal to offset along) and across `profile`
// (offsets and heights across the width, with optional per-stop shade).
// Vertex-coloured so a whole surface — asphalt, kerbs, paint — merges into
// one draw call, which is how the circuit, the ramps and the roads are all
// built (DESIGN.md §8.6).
//
// Lived in Circuit.jsx until the road network needed the same thing. Shared
// rather than copied: two ribbon builders would drift, and a road that
// shades differently from the track it joins is exactly the kind of seam
// this codebase keeps having to hunt down.
export function ribbonGeometry(rows, profile, colorHex) {
  const R = rows.length
  const P = profile.length
  const positions = new Float32Array(R * P * 3)
  const colors = new Float32Array(R * P * 3)
  const base = new THREE.Color(colorHex)
  for (let r = 0; r < R; r++) {
    const row = rows[r]
    for (let j = 0; j < P; j++) {
      const { o, y, shade = 1 } = profile[j]
      const k = (r * P + j) * 3
      const s = shade * (row.shade ?? 1)
      positions[k]     = row.x + row.nx * o
      positions[k + 1] = y
      positions[k + 2] = row.z + row.nz * o
      colors[k]     = base.r * s
      colors[k + 1] = base.g * s
      colors[k + 2] = base.b * s
    }
  }
  const indices = []
  for (let r = 0; r < R - 1; r++) {
    for (let j = 0; j < P - 1; j++) {
      const a = r * P + j
      const b = a + 1
      const c = a + P
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
