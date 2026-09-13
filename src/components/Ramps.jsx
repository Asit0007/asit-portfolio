import { useMemo, useEffect, useRef } from 'react'
import { RigidBody, ConvexHullCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ASPHALT, KERB_COLORS, LINE_PAINT,
  ASPHALT_EDGE_SHADE, ASPHALT_WORN_SHADE,
} from '../data/track'

// ── Ramps in the open world ───────────────────────────────────────────────
// There was already one ramp, but it lives on the racing circuit
// (TrackObstacles.jsx) where you only meet it mid-lap. These are the ones
// you find while exploring, which is what most visitors actually do.
//
// A real WEDGE, not a tilted box. The circuit ramp is a box rotated about
// its centre, which leaves its leading edge standing proud of the sand —
// the wheels have to climb a step before they can climb the slope, and at
// speed that reads as a clatter rather than a launch. A wedge meets the
// ground at exactly zero, so the approach is seamless, and its vertical
// back face is honest about the fact that you cannot take it from behind.
//
// Painted as road, not as furniture: the deck is the circuit's own asphalt
// carrying the same worn-centre shading, edged with the circuit's red/white
// kerbs and capped with a paint line at the lip. They used to be a warm
// amber, which put a mid-value orange object on mid-value orange sand — the
// one pairing in this palette with almost no contrast, so at distance a ramp
// dissolved into the ground it stands on. Track colours fix the legibility
// and say what the thing is in the same breath: dark deck reads as a
// surface built to be driven, and red/white edges mean the same here as
// they do on the circuit.
//
// Cost: still ONE instanced draw call for every ramp in the world (the
// kerbs are merged into the same geometry and carried as vertex colours,
// not as extra meshes or extra materials), and one static convex hull each
// on a single shared fixed body — no rigid bodies to sync, nothing per
// frame (DESIGN.md §8.6).

const RAMP_LENGTH = 16
const RAMP_WIDTH  = 10
// 14 degrees. The circuit's is 12.9 and lands well, so this is a touch
// steeper for real air without pitching the car far enough to matter
// against PITCH_INERTIA. At the 20 u/s cruise it throws the car about 5
// units up and 24 along; on boost, roughly double.
const RAMP_RISE   = 4.0

// Where the ramp centre sits and which way it climbs (radians, 0 = toward
// -Z, matching the car's own forward convention).
//
// Four sit on the open diagonals, which is the empty desert between the
// zone plazas and the only large area with nothing else in it. Two more sit
// squarely ON the far ends of the north and east roads: those roads run to
// ±110 and dead-end, so a ramp out there is a destination rather than an
// obstruction, and it is the one place a visitor is already at full speed.
// Every position is checked against the zone plazas, the name letters and
// the racing circuit.
export const RAMPS = [
  { x:  35, z: -35, heading:  Math.PI * 0.75 },
  { x:  35, z:  35, heading:  Math.PI * 0.25 },
  { x: -35, z:  35, heading: -Math.PI * 0.25 },
  { x: -35, z: -35, heading: -Math.PI * 0.75 },
  { x:   0, z: -95, heading:  0 },
  { x:  95, z:   0, heading:  Math.PI * 0.5 },
]

// Conservative circle round the footprint: half the wedge's diagonal, so a
// keep-out holds at any heading without doing the rotated-rectangle maths.
const RAMP_RADIUS = Math.hypot(RAMP_LENGTH / 2, RAMP_WIDTH / 2)

// Shared with Trees.jsx and EnvironmentModels.jsx the same way isOnName and
// isNearTrack are — nothing should spawn inside a ramp, least of all a tree
// growing through the middle of one.
export function isOnRamp(x, z, margin = 0) {
  const r = RAMP_RADIUS + margin
  return RAMPS.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < r * r)
}

// ── The wedge ─────────────────────────────────────────────────────────────
// Built from a Shape rather than by hand: extruding a right triangle gets
// the face winding and the normals right for free, where writing out six
// corners and their triangles is an easy place to leave one face inside out.
// Shape space is (along-ramp, height); the extrusion becomes the width, and
// the rotation swings the length onto +Z so heading 0 climbs toward -Z.
function wedgeGeometry() {
  const hl = RAMP_LENGTH / 2
  const shape = new THREE.Shape()
  shape.moveTo(-hl, 0)
  shape.lineTo(hl, 0)
  shape.lineTo(hl, RAMP_RISE)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, { depth: RAMP_WIDTH, bevelEnabled: false })
  geo.translate(0, 0, -RAMP_WIDTH / 2)
  geo.rotateY(-Math.PI / 2)
  // Heading 0 should climb AWAY from the camera, matching the car's -Z
  // forward, so flip the ramp end for end.
  geo.rotateY(Math.PI)
  return geo
}

// After those two rotations the local frame is:
//   +X  across the ramp, ±RAMP_WIDTH/2
//   -Z  up-slope: the deck runs from (z = +L/2, y = 0) to (z = -L/2, y = RISE)
//   the vertical launch face is the one at z = -L/2
// so a point on the deck is y = (L/2 - z) * RISE / L. Everything below is
// written against that frame; the two rotateY calls above are the only place
// the shape-space convention exists.
const PITCH     = Math.atan2(RAMP_RISE, RAMP_LENGTH)      // 14.04°
const SLOPE_LEN = Math.hypot(RAMP_LENGTH, RAMP_RISE)      // 16.49
const deckY = (z) => (RAMP_LENGTH / 2 - z) * RAMP_RISE / RAMP_LENGTH

// Kerb stripes are paint, not a raised kerb. The circuit's kerbs stand a few
// centimetres proud because the car is meant to feel them when it runs wide;
// a lip down the edge of a jump would be something to catch a wheel on at the
// exact moment the car is about to leave the ground, so these lie flat.
const KERB_STRIPES = 10
const KERB_WIDTH   = 0.7
const KERB_THICK   = 0.05

// Face-normal thresholds. The wedge only has axis-ish faces, so 0.5 is a wide
// margin rather than a tuned number.
const FACE = 0.5

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3()
const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _n = new THREE.Vector3()
const _col = new THREE.Color()

// The deck, painted with the road's own across-the-width shading. The other
// faces are stepped down from the same asphalt rather than given colours of
// their own, so the wedge reads as one material catching light at different
// angles — which under a fixed sun with no shadow maps is the only cue the
// shape has (DESIGN.md §6).
function paintWedge(src) {
  const geo = src.toNonIndexed()
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const base = new THREE.Color(ASPHALT)

  for (let f = 0; f < pos.count; f += 3) {
    _a.fromBufferAttribute(pos, f)
    _b.fromBufferAttribute(pos, f + 1)
    _c.fromBufferAttribute(pos, f + 2)
    _ab.subVectors(_b, _a)
    _ac.subVectors(_c, _a)
    _n.crossVectors(_ab, _ac).normalize()

    for (let k = 0; k < 3; k++) {
      const i = f + k
      let shade
      if (_n.y > FACE) {
        // The deck. smoothstep(0.4, 1) over the half-width reproduces the
        // road profile exactly: flat worn band out to 0.2 x width, then
        // brightening to the edges.
        const u = Math.min(Math.abs(pos.getX(i)) / (RAMP_WIDTH / 2), 1)
        shade = THREE.MathUtils.lerp(
          ASPHALT_WORN_SHADE, ASPHALT_EDGE_SHADE, THREE.MathUtils.smoothstep(u, 0.4, 1),
        )
      } else if (_n.z < -FACE) {
        shade = 0.55            // the launch face — a drop, and it should look like one
      } else if (_n.y < -FACE) {
        shade = 0.5             // underside, never seen
      } else {
        shade = 0.72            // the two triangular side walls
      }
      _col.copy(base).multiplyScalar(shade)
      colors[i * 3]     = _col.r
      colors[i * 3 + 1] = _col.g
      colors[i * 3 + 2] = _col.b
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// A flat painted patch lying on the deck, positioned by how far up the slope
// it sits (0 = foot, 1 = lip). Offset along the deck NORMAL rather than
// straight up, so a stripe sits the same distance proud at every point on
// the slope instead of sinking into it toward the top.
function deckPatch(width, alongLength, s, x, colorHex) {
  const geo = new THREE.BoxGeometry(width, KERB_THICK, alongLength).toNonIndexed()
  const z = RAMP_LENGTH / 2 - s * RAMP_LENGTH
  const lift = KERB_THICK / 2 + 0.006
  const m = new THREE.Matrix4().makeRotationX(PITCH)
  m.setPosition(
    x,
    deckY(z) + Math.cos(PITCH) * lift,
    z + Math.sin(PITCH) * lift,
  )
  geo.applyMatrix4(m)

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  _col.set(colorHex)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3]     = _col.r
    colors[i * 3 + 1] = _col.g
    colors[i * 3 + 2] = _col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function rampGeometry(wedge) {
  const parts = [paintWedge(wedge)]

  // Red/white down both edges, alternating along the climb.
  const stripe = SLOPE_LEN / KERB_STRIPES
  const edgeX  = RAMP_WIDTH / 2 - KERB_WIDTH / 2
  for (const side of [-1, 1]) {
    for (let i = 0; i < KERB_STRIPES; i++) {
      parts.push(deckPatch(
        KERB_WIDTH, stripe * 0.94,          // a hair short, so stripes read as separate
        (i + 0.5) / KERB_STRIPES,
        side * edgeX,
        KERB_COLORS[i % 2],
      ))
    }
  }

  // A paint line across the lip. The launch edge is the one piece of
  // information the driver actually needs from a distance — where the ramp
  // stops — and the deck's own dark asphalt against a bright sky gives them
  // nothing. Same white as the circuit's centreline.
  parts.push(deckPatch(RAMP_WIDTH - KERB_WIDTH * 2 - 0.5, 0.42, 0.972, 0, LINE_PAINT))

  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

export default function Ramps() {
  // The wedge is kept as its own geometry and handed to the colliders: the
  // hull must be the DRIVEN surface, so it can never include the kerb paint
  // sitting on top of it. Merging them would lift the collision surface a
  // few centimetres above the deck the eye sees, and the wheels would ride
  // on nothing.
  const { hull, visual } = useMemo(() => {
    const hull = wedgeGeometry()
    return { hull, visual: rampGeometry(hull) }
  }, [])
  useEffect(() => () => { hull.dispose(); visual.dispose() }, [hull, visual])
  const ref = useRef()

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    RAMPS.forEach(({ x, z, heading }, i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, heading, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    // Same reasoning as Trees: ramps are spread across the whole world, so a
    // tight bounding sphere would only cull when every one is off-screen.
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [visual])

  return (
    <group>
      <instancedMesh ref={ref} args={[visual, undefined, RAMPS.length]} frustumCulled={false}>
        {/* Deck, kerbs and lip line all ride in one geometry's vertex
            colours, so the whole thing is still a single material and a
            single draw call. Flat shading so the wedge's slope reads from
            any angle under the static sun (DESIGN.md §6). */}
        <meshLambertMaterial vertexColors flatShading />
      </instancedMesh>

      {/* Physics. The hull is taken straight off the wedge, so the surface
          the wheels find can never drift from the one drawn. */}
      <RigidBody type="fixed" colliders={false}>
        {RAMPS.map(({ x, z, heading }, i) => (
          <ConvexHullCollider
            key={i}
            args={[hull.attributes.position.array]}
            position={[x, 0, z]}
            rotation={[0, heading, 0]}
            friction={1.0}
          />
        ))}
      </RigidBody>
    </group>
  )
}
