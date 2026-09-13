import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  CHECKPOINTS, ASPHALT, KERB_COLORS, LINE_PAINT,
  ASPHALT_EDGE_SHADE, ASPHALT_WORN_SHADE,
} from '../data/track'

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

const KERB_STRIPES = 8
const KERB_WIDTH   = 0.7
const PAINT_THICK  = 0.05

const _col = new THREE.Color()

function solidColor(geo, colorHex) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  _col.set(colorHex)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = _col.r; colors[i * 3 + 1] = _col.g; colors[i * 3 + 2] = _col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// The deck slab, carrying the road's across-the-width shading: worn darker
// down the middle where the tyres run, brighter at the edges. Only the top
// face gets the gradient — the sides and underside step down from the same
// asphalt so the slab reads as one material at different angles.
function rampBody() {
  const geo = new THREE.BoxGeometry(RAMP_WIDTH, RAMP_THICKNESS, RAMP_LENGTH).toNonIndexed()
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const base = new THREE.Color(ASPHALT)
  const top = RAMP_THICKNESS / 2 - 1e-4
  for (let i = 0; i < pos.count; i++) {
    const onDeck = pos.getY(i) > top
    let shade = 0.68
    if (onDeck) {
      const u = Math.min(Math.abs(pos.getX(i)) / (RAMP_WIDTH / 2), 1)
      shade = THREE.MathUtils.lerp(
        ASPHALT_WORN_SHADE, ASPHALT_EDGE_SHADE, THREE.MathUtils.smoothstep(u, 0.4, 1),
      )
    }
    _col.copy(base).multiplyScalar(shade)
    colors[i * 3] = _col.r; colors[i * 3 + 1] = _col.g; colors[i * 3 + 2] = _col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// A flat painted patch on the deck. Everything here is in the slab's own
// local space, so the body quaternion below tilts the paint with the ramp
// and none of this has to know about the pitch.
function deckPatch(width, alongLength, x, z, colorHex) {
  const geo = new THREE.BoxGeometry(width, PAINT_THICK, alongLength).toNonIndexed()
  geo.translate(x, RAMP_THICKNESS / 2 + PAINT_THICK / 2 - 0.004, z)
  return solidColor(geo, colorHex)
}

// A single fixed incline — no custom wedge mesh needed, a plain tilted box
// collider is enough for raycast-vehicle wheels to climb smoothly. The car
// drives up in the direction of travel and launches off the raised end.
//
// Painted as road, in the circuit's own asphalt and red/white kerbs. It used
// to be a bright amber slab, which was the one object on the track wearing a
// colour the track itself never uses — it read as scenery dropped onto the
// road rather than as part of it. Deck, kerbs and lip line all ride in one
// geometry's vertex colours: one material, one draw call, same as before.
function Ramp() {
  const { position, quaternion } = useMemo(() => {
    const { mid, heading } = segmentGeometry(RAMP_FROM_ID, RAMP_TO_ID)
    const pitch = -Math.atan2(RAMP_RISE, RAMP_LENGTH)
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, heading, 0, 'YXZ')
    )
    return { position: [mid[0], RAMP_RISE / 2, mid[1]], quaternion: quat }
  }, [])

  const geometry = useMemo(() => {
    const parts = [rampBody()]
    const stripe = RAMP_LENGTH / KERB_STRIPES
    const edgeX  = RAMP_WIDTH / 2 - KERB_WIDTH / 2
    for (const side of [-1, 1]) {
      for (let i = 0; i < KERB_STRIPES; i++) {
        const z = -RAMP_LENGTH / 2 + (i + 0.5) * stripe
        parts.push(deckPatch(KERB_WIDTH, stripe * 0.94, side * edgeX, z, KERB_COLORS[i % 2]))
      }
    }
    // Paint line at the launch edge. The car meets this one at racing speed
    // mid-lap, so where the deck ends is worth stating outright.
    parts.push(deckPatch(
      RAMP_WIDTH - KERB_WIDTH * 2 - 0.5, 0.38,
      0, -RAMP_LENGTH / 2 + 0.45, LINE_PAINT,
    ))
    const merged = mergeGeometries(parts)
    parts.forEach((g) => g.dispose())
    return merged
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <RigidBody type="fixed" colliders={false} position={position} quaternion={quaternion}>
      {/* Collider from the slab's dimensions, not from the merged geometry —
          the paint sits on top of the deck and must not become part of the
          surface the wheels ride on. */}
      <CuboidCollider args={[RAMP_WIDTH / 2, RAMP_THICKNESS / 2, RAMP_LENGTH / 2]} />
      <mesh geometry={geometry}>
        <meshLambertMaterial vertexColors flatShading />
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
