import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { CHECKPOINTS } from '../data/track'

// Folio-inspired additions layered onto the shared track geometry — a ramp
// on the longest straight (checkpoints 1→2) and a slalom of swinging bars
// on another long straight (checkpoints 8→0). Positions/headings are
// derived from the real checkpoint coordinates, not hand-eyeballed, so
// they stay flush with the road even if the checkpoint array is retuned.

const RAMP_FROM_ID = 1
const RAMP_TO_ID = 2
const RAMP_LENGTH = 14
const RAMP_WIDTH = 9
const RAMP_RISE = 3.2
const RAMP_THICKNESS = 0.6

const SLALOM_FROM_ID = 8
const SLALOM_TO_ID = 0
const SLALOM_COUNT = 5
const SLALOM_SPACING = 8
const SLALOM_AMPLITUDE = 5
const SLALOM_SPEED = 1.25 // rad/s — folio's exact CircuitArea.js oscillation speed

function checkpointPos(id) {
  return CHECKPOINTS.find((c) => c.id === id).position
}

// heading = atan2(dx,dz): the Y rotation that points a mesh's local +Z axis
// (its "forward") at world direction (dx,dz) — standard Three.js yaw-facing
// formula, verified against Circuit.jsx's own (differently-axed) convention.
function segmentGeometry(fromId, toId) {
  const a = checkpointPos(fromId)
  const b = checkpointPos(toId)
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const length = Math.hypot(dx, dz)
  const heading = Math.atan2(dx, dz)
  return {
    mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    heading,
    length,
    fwd:  [dx / length, dz / length],
    perp: [dz / length, -dx / length],
  }
}

// A single fixed incline — no custom wedge mesh needed, a plain tilted box
// collider is enough for raycast-vehicle wheels to climb smoothly. The car
// drives up in the direction of travel and launches off the raised end.
function Ramp() {
  const { position, quaternion } = useMemo(() => {
    const { mid, heading } = segmentGeometry(RAMP_FROM_ID, RAMP_TO_ID)
    const pitch = -Math.atan2(RAMP_RISE, RAMP_LENGTH)
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, heading, 0, 'YXZ')
    )
    return { position: [mid[0], RAMP_RISE / 2, mid[1]], quaternion: quat }
  }, [])

  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} quaternion={quaternion}>
      <mesh>
        <boxGeometry args={[RAMP_WIDTH, RAMP_THICKNESS, RAMP_LENGTH]} />
        <meshStandardMaterial color="#e8c060" roughness={0.7} metalness={0.1} />
      </mesh>
    </RigidBody>
  )
}

// Ports folio's exact CircuitArea.js obstacle mechanic 1:1: a kinematic
// body whose position each frame is `base + sin(t*speed + phase) * amplitude`
// along the perpendicular-to-travel axis.
function SwingingObstacle({ basePosition, perpDir, phase }) {
  const bodyRef = useRef()

  useFrame((state) => {
    if (!bodyRef.current) return
    const offset = Math.sin(state.clock.elapsedTime * SLALOM_SPEED + phase) * SLALOM_AMPLITUDE
    bodyRef.current.setNextKinematicTranslation({
      x: basePosition[0] + perpDir[0] * offset,
      y: basePosition[1],
      z: basePosition[2] + perpDir[1] * offset,
    })
  })

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders="cuboid" position={basePosition}>
      <mesh>
        <boxGeometry args={[0.6, 2.2, 0.6]} />
        <meshStandardMaterial color="#f0c060" emissive="#f0c060" emissiveIntensity={0.35} />
      </mesh>
    </RigidBody>
  )
}

// 5 bars, 8 units apart, spanning the middle third of the 8→0 straight
// (101.9 units long — plenty of clearance from both checkpoints either
// side), each phase-offset by -i*1 so they swing out of sync, matching
// folio's own `osciliationOffset = -i * 1` spacing exactly.
function SlalomSection() {
  const bars = useMemo(() => {
    const { mid, fwd, perp } = segmentGeometry(SLALOM_FROM_ID, SLALOM_TO_ID)
    return Array.from({ length: SLALOM_COUNT }, (_, i) => {
      const along = (i - (SLALOM_COUNT - 1) / 2) * SLALOM_SPACING
      return {
        basePosition: [mid[0] + fwd[0] * along, 1.1, mid[1] + fwd[1] * along],
        perpDir: perp,
        phase: -i * 1,
      }
    })
  }, [])

  return bars.map((bar, i) => <SwingingObstacle key={i} {...bar} />)
}

export default function TrackObstacles() {
  return (
    <group>
      <Ramp />
      <SlalomSection />
    </group>
  )
}
