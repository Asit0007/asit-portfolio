import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SUN_POSITION } from './Lights'
import { TREES } from './Trees'
import { SCATTER_DATA } from './World'
import { SIGN_POSITIONS } from './SignPosts'

// ── Contact shadows without shadow maps ───────────────────────────────────
// Dynamic shadows were removed in 2026-08 because the depth-map pass cost
// more than the look was worth, and that decision stands (DESIGN.md §6).
// But the scene had NO grounding at all afterwards: the car and every prop
// met the sand with zero contact darkening, which reads as stickers pasted
// on the ground rather than objects resting on it.
//
// This is the cheap half of the trade — soft blobs on the ground, one
// InstancedMesh for every static object in the world (1 draw call), plus a
// single blob under the car (Vehicle.jsx). No depth pass, no render target,
// no per-frame CPU for the static set: instance matrices are written once.
//
// Blending is deliberately NORMAL, not multiply. Multiply darkens more
// convincingly up close, but three applies fog to the fragment BEFORE
// blending, so a distant multiply-blended blob has its source colour pushed
// to the fog orange and ends up *darkening and tinting* the haze — distant
// shadows got stronger, which is backwards. With normal blending the same
// fog mix fades the blob into the haze exactly like every other surface.

// Warm, never gray: the shadow colour is a deep sand-brown, so shading stays
// inside the desert amber band instead of introducing a neutral (DESIGN.md §6).
const SHADOW_RGB = '74, 36, 16'
const CORE_ALPHA = 0.42

// One 128px radial gradient shared by every blob in the world — the static
// instances here and the car's blob in Vehicle.jsx both pull this, so the
// contact shading matches and there is only ever one texture on the GPU.
let _sharedTex = null
export function shadowTexture() {
  if (_sharedTex) return _sharedTex
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  // Eased falloff — a plain 2-stop gradient has a hard-looking core and a
  // visible outer ring where it hits zero.
  g.addColorStop(0.00, `rgba(${SHADOW_RGB}, ${CORE_ALPHA})`)
  g.addColorStop(0.45, `rgba(${SHADOW_RGB}, ${CORE_ALPHA * 0.62})`)
  g.addColorStop(0.75, `rgba(${SHADOW_RGB}, ${CORE_ALPHA * 0.20})`)
  g.addColorStop(1.00, `rgba(${SHADOW_RGB}, 0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  _sharedTex = new THREE.CanvasTexture(canvas)
  _sharedTex.colorSpace = THREE.SRGBColorSpace
  return _sharedTex
}

// Where a shadow lands, per unit of object height. The sun is a fixed
// direction (Lights.jsx) aimed at the origin, so light travels along
// -SUN_POSITION; descending `h` costs h/sun.y, which displaces the ground
// hit by this much in x/z. Derived rather than hardcoded so that moving the
// sun in Lights.jsx moves every shadow with it.
export const DROP_X = -SUN_POSITION[0] / SUN_POSITION[1]
export const DROP_Z = -SUN_POSITION[2] / SUN_POSITION[1]

// Full geometric displacement detaches the blob from the trunk it belongs
// to, which looks worse than no shadow. Anchoring it at ~45% keeps the
// contact point covered while still leaning the right way.
export const LEAN = 0.45

// Ground decals in this world stack at fixed heights, and a blob has to
// clear ALL of them or it either z-fights or is quietly drawn underneath:
//
//   0.000  sand            World.jsx GradientFloor
//   0.020  centre platform World.jsx ZonePad top face (-0.58 + 1.2/2)
//   0.030  circuit asphalt Circuit.jsx TrackPath
//   0.040  tile paths      World.jsx TilePaths
//   0.043  start/finish    Circuit.jsx
//   0.048  circuit dashes  Circuit.jsx
//   0.060  road surface    World.jsx Roads
//   0.065  lane lines      World.jsx Roads
//   0.070  centre dashes   World.jsx Roads
//   0.088  circuit kerbs   Circuit.jsx (raised geometry, not a decal)
//
// This was 0.02 — EXACTLY the centre platform's top face. That was
// invisible while the signposts stood out on sand, but the moment they
// moved onto the slab their blobs became coplanar with it and z-fought,
// which is the flicker. 0.075 clears every decal above; it stays under the
// circuit kerbs, which are raised geometry a blob has no business sitting
// on anyway.
export const SHADOW_Y = 0.075

// [x, z, radius, height] for every static caster in the world.
function staticCasters(maxTrees) {
  const out = []

  // Trees dominate the count and the payoff — 100 of them currently hover.
  // Sliced to the same tier cap Trees.jsx renders with, or low tiers would
  // draw shadows for trees that were never added to the scene.
  for (const t of TREES.slice(0, maxTrees)) {
    // Canopy centre sits ~2.6 up and spans ~3 wide at scale 1 (Trees.jsx).
    out.push([t.x, t.z, 1.7 * t.scale, 2.6 * t.scale])
  }

  // The loose boxes the car shoves around. Static blobs are wrong for a body
  // that can be pushed, but they are heavy, damped and effectively never
  // leave their spot unless the visitor deliberately rams them; a blob that
  // lags a shoved crate reads far better than 16 more bodies to track.
  for (const r of SCATTER_DATA) {
    out.push([r.x, r.z, Math.max(r.sx, r.sz) * 0.85, r.sy * 0.5])
  }

  // Signposts: a narrow post, so a small tight blob at the plinth.
  for (const [x, , z] of SIGN_POSITIONS) out.push([x, z, 0.9, 2.0])

  return out
}

export default function GroundShadows({ maxTrees = 100 }) {
  const tex = useMemo(() => shadowTexture(), [])
  const casters = useMemo(() => staticCasters(maxTrees), [maxTrees])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(() => () => geo.dispose(), [geo])

  // Same ref+effect shape as Trees.jsx, deliberately not a ref callback: a
  // callback ref is re-invoked on every render, and Scene re-renders on every
  // joystick change, so on mobile this would rewrite every instance matrix on
  // each touch move. The effect only fires when the tier cap actually changes.
  const ref = useRef()
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    casters.forEach(([x, z, radius, height], i) => {
      dummy.position.set(
        x + DROP_X * height * LEAN,
        SHADOW_Y,
        z + DROP_Z * height * LEAN,
      )
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      // Taller casters throw a longer, softer, weaker shadow — scaling the
      // blob up with height is what keeps a 4m tree from looking like it
      // casts the same mark as a 1m crate.
      dummy.scale.setScalar(radius * 2 * (1 + height * 0.10))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    // Same reasoning as Trees.jsx: casters are scattered to r~94, so a real
    // bounding sphere would only ever cull when all of them are off-screen.
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [casters, geo])

  if (casters.length === 0) return null

  return (
    <instancedMesh
      key={casters.length}
      ref={ref}
      args={[geo, undefined, casters.length]}
      frustumCulled={false}
      renderOrder={-1}
    >
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
