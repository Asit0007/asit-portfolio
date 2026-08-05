import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import useGameStore from '../store/useGameStore'
import { setBestTime } from '../utils/raceStorage'
import TrackObstacles from './TrackObstacles'
import {
  CHECKPOINTS, TRACK_SAMPLES, PATH_WIDTH, BORDER_WIDTH, CHECK_RADIUS,
} from '../data/track'

const BORDER_COLORS = ['#f5f0e8', '#32ffc1'] // alternates for the checker look; teal matches the checkpoint gates' active color

const _vPos = new THREE.Vector3()
const _cPos = new THREE.Vector3()

// Bakes a solid-color BoxGeometry with a per-vertex 'color' attribute, so
// many of these can be merged into one buffer while keeping each piece's
// own color (used for the alternating checkered border).
function coloredBoxGeometry(width, height, depth, colorHex) {
  const geo = new THREE.BoxGeometry(width, height, depth)
  const count = geo.attributes.position.count
  const c = new THREE.Color(colorHex)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Ground track connecting the checkpoints — a smooth closed curve (not the
// straight hexagon segments this used to be) with a checkered border, same
// visual language as folio-2025's actual circuit but built procedurally
// (folio's is a hand-modeled Blender mesh — see Circuit.jsx's module
// comment/the plan this came from for why that's not portable here).
// Every small per-segment piece is baked (position/rotation applied
// directly to its vertices) and merged into exactly 2 draw calls total —
// despite ~6x more segments than the old straight-line version, this is
// fewer draw calls than before (2 vs 18), not more.
function TrackPath() {
  const { roadGeometry, borderGeometry } = useMemo(() => {
    const samples = TRACK_SAMPLES

    const roadPieces = []
    const borderPieces = []

    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]
      const b = samples[(i + 1) % samples.length]
      const dx = b.x - a.x, dz = b.z - a.z
      const length = Math.hypot(dx, dz)
      if (length < 0.001) continue

      // Y-axis rotation: local +X maps to world (cos θ, -sin θ) — solve for
      // θ so that direction lands on (dx, dz). Local +Z (the box's
      // width/depth axis) then maps to world (sin θ, cos θ) — the
      // perpendicular direction used below to offset the border pieces.
      const angle = -Math.atan2(dz, dx)
      const midX = (a.x + b.x) / 2
      const midZ = (a.z + b.z) / 2

      const road = new THREE.BoxGeometry(length, 0.02, PATH_WIDTH)
      road.rotateY(angle)
      road.translate(midX, 0.03, midZ)
      roadPieces.push(road)

      const color = BORDER_COLORS[i % 2]
      const edgeOffset = PATH_WIDTH / 2 + BORDER_WIDTH / 2
      for (const offset of [-edgeOffset, edgeOffset]) {
        const border = coloredBoxGeometry(length, 0.03, BORDER_WIDTH, color)
        border.rotateY(angle)
        border.translate(
          midX + offset * Math.sin(angle),
          0.035,
          midZ + offset * Math.cos(angle)
        )
        borderPieces.push(border)
      }
    }

    const roadGeometry   = mergeGeometries(roadPieces)
    const borderGeometry = mergeGeometries(borderPieces)
    roadPieces.forEach((g) => g.dispose())
    borderPieces.forEach((g) => g.dispose())
    return { roadGeometry, borderGeometry }
  }, [])

  return (
    <group>
      <mesh geometry={roadGeometry}>
        <meshStandardMaterial color="#1a3a34" transparent opacity={0.55} />
      </mesh>
      <mesh geometry={borderGeometry}>
        <meshStandardMaterial vertexColors />
      </mesh>
    </group>
  )
}

function CheckpointGate({ position, label, isTarget, isPassed }) {
  const ringRef = useRef()
  const color = isTarget ? '#32ffc1' : isPassed ? '#4a6b60' : '#3a4a48'

  useFrame((state) => {
    if (!ringRef.current) return
    const t = state.clock.elapsedTime
    ringRef.current.material.opacity = isTarget
      ? 0.5 + Math.sin(t * 4) * 0.25
      : 0.12
  })

  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[CHECK_RADIUS - 1.2, CHECK_RADIUS, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.16}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {isTarget && (
        <group position={[0, 2.5, 0]}>
          <Text fontSize={1} color={color} anchorX="center" anchorY="middle"
            outlineWidth={0.06} outlineColor="#000">
            {label}
          </Text>
        </group>
      )}
    </group>
  )
}

export default function Circuit({ vehicleRef }) {
  const currentCheckpoint = useGameStore((s) => s.currentCheckpoint)
  const raceState         = useGameStore((s) => s.raceState)
  const wasInsideRef      = useRef(false)
  const startTimeRef      = useRef(0)
  const idleTimeoutRef    = useRef(null)

  useFrame(() => {
    if (!vehicleRef?.current) return
    try {
      const t = vehicleRef.current.translation()
      _vPos.set(t.x, 0, t.z)

      // Reads via getState() rather than the reactive values above — this
      // runs every frame, same reasoning Vehicle.jsx uses .getState() for
      // one-off reads inside its physics loop instead of subscribing.
      const state  = useGameStore.getState()
      const target = CHECKPOINTS[state.currentCheckpoint]
      _cPos.set(target.position[0], 0, target.position[1])
      const inside = _vPos.distanceTo(_cPos) < CHECK_RADIUS

      // Edge-triggered (entering this frame, wasn't inside last frame) —
      // same pattern as Zones.jsx's lastZone-change check, adapted to a
      // boolean so lingering at a gate doesn't refire every frame.
      if (inside && !wasInsideRef.current) {
        if (target.id === 0 && state.raceState !== 'racing') {
          // Crossing the start/finish gate while idle or after a previous
          // finish starts a new lap attempt.
          startTimeRef.current = performance.now()
          state.setRaceState('racing')
          state.setCurrentCheckpoint(1)
        } else if (target.id === 0 && state.raceState === 'racing') {
          const elapsed = performance.now() - startTimeRef.current
          state.setLastLapTime(elapsed)
          state.setRaceState('finished')
          state.setCurrentCheckpoint(0)
          if (state.bestLapTime === null || elapsed < state.bestLapTime) {
            state.setBestLapTime(elapsed)
            setBestTime(elapsed)
            // LapTimerHUD watches this to prompt for a name + submit to the
            // global leaderboard — kept out of this physics-loop component
            // since it involves a text input, not just a store write.
            useGameStore.setState({ pendingLeaderboardSubmit: elapsed })
          }
          // raceState has no other path back to 'idle' — without this, the
          // HUD would keep showing "FINISHED" and the last lap time
          // indefinitely, even long after driving away from the circuit.
          clearTimeout(idleTimeoutRef.current)
          idleTimeoutRef.current = setTimeout(() => {
            if (useGameStore.getState().raceState === 'finished') {
              useGameStore.getState().setRaceState('idle')
            }
          }, 6000)
        } else {
          // Wrap modulo checkpoint count — without this, passing the last
          // checkpoint (id CHECKPOINT_COUNT-1) set currentCheckpoint to an
          // out-of-range index, and CHECKPOINTS[thatIndex] being undefined
          // next frame threw inside the try/catch below, silently freezing
          // checkpoint detection for the rest of the session.
          state.setCurrentCheckpoint((target.id + 1) % CHECKPOINTS.length)
        }
      }
      wasInsideRef.current = inside
    } catch (_) {}

    if (typeof window !== 'undefined') {
      window.__raceElapsedMs = useGameStore.getState().raceState === 'racing'
        ? performance.now() - startTimeRef.current
        : null
    }
  })

  return (
    <group>
      <TrackPath />
      <TrackObstacles />
      {CHECKPOINTS.map((cp) => (
        <CheckpointGate
          key={cp.id}
          position={cp.position}
          label={cp.label}
          isTarget={cp.id === currentCheckpoint}
          isPassed={raceState === 'racing' && cp.id !== 0 && cp.id < currentCheckpoint}
        />
      ))}
    </group>
  )
}
