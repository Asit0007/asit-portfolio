import { useMemo, useEffect, useRef } from 'react'
import { RigidBody, ConvexHullCollider } from '@react-three/rapier'
import * as THREE from 'three'

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
// Cost: ONE instanced draw call for every ramp in the world, and one static
// convex hull each on a single shared fixed body — no rigid bodies to sync,
// nothing per frame (DESIGN.md §8.6).

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

export default function Ramps() {
  const geo = useMemo(() => wedgeGeometry(), [])
  useEffect(() => () => geo.dispose(), [geo])
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
  }, [geo])

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, undefined, RAMPS.length]} frustumCulled={false}>
        {/* Warm amber, matching the circuit ramp — a built object, clearly
            not sand. Flat shading so the wedge's slope reads from any angle
            under the static sun (DESIGN.md §6). */}
        <meshLambertMaterial color="#d8a850" flatShading />
      </instancedMesh>

      {/* Physics. The hull is taken straight off the rendered geometry, so
          the surface the wheels find can never drift from the one drawn. */}
      <RigidBody type="fixed" colliders={false}>
        {RAMPS.map(({ x, z, heading }, i) => (
          <ConvexHullCollider
            key={i}
            args={[geo.attributes.position.array]}
            position={[x, 0, z]}
            rotation={[0, heading, 0]}
            friction={1.0}
          />
        ))}
      </RigidBody>
    </group>
  )
}
