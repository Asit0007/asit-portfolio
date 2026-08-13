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

const BORDER_COLORS = ['#f5f0e8', '#e03131'] // classic red/white racing kerb alternation

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
        // Slightly raised so the kerbs read as kerbs, not paint — visual
        // only, no collider, so the car glides over them unaffected.
        const border = coloredBoxGeometry(length, 0.06, BORDER_WIDTH, color)
        border.rotateY(angle)
        border.translate(
          midX + offset * Math.sin(angle),
          0.045,
          midZ + offset * Math.cos(angle)
        )
        borderPieces.push(border)
      }

      // White dashed centerline — every other segment gets a dash, merged
      // into the same vertex-colored draw call as the kerbs. Skipped near
      // the start/finish line so it doesn't z-fight the checkered strip.
      const cp0 = CHECKPOINTS[0].position
      const nearStart = Math.hypot(midX - cp0[0], midZ - cp0[1]) < 4
      if (i % 2 === 0 && !nearStart) {
        const dash = coloredBoxGeometry(length * 0.55, 0.02, 0.28, '#f5f0e8')
        dash.rotateY(angle)
        dash.translate(midX, 0.045, midZ)
        borderPieces.push(dash)
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
        <meshStandardMaterial color="#33343b" roughness={0.95} />
      </mesh>
      <mesh geometry={borderGeometry}>
        <meshStandardMaterial vertexColors />
      </mesh>
    </group>
  )
}

// Checkered start/finish strip across the road plus an overhead gantry —
// the strip is baked/merged like everything else (1 draw call), the gantry
// is a handful of one-off meshes. Aligned to the track's tangent at the
// start/finish checkpoint, same local-frame convention as TrackPath
// (local +X = direction of travel, local Z = across the road).
function StartFinish() {
  const { stripGeometry, angle, pos } = useMemo(() => {
    const cp = CHECKPOINTS[0].position
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < TRACK_SAMPLES.length; i++) {
      const dx = TRACK_SAMPLES[i].x - cp[0]
      const dz = TRACK_SAMPLES[i].z - cp[1]
      const d = dx * dx + dz * dz
      if (d < bestD) { bestD = d; best = i }
    }
    const n = TRACK_SAMPLES.length
    const prev = TRACK_SAMPLES[(best - 1 + n) % n]
    const next = TRACK_SAMPLES[(best + 1) % n]
    const angle = -Math.atan2(next.z - prev.z, next.x - prev.x)

    const pieces = []
    const cell = PATH_WIDTH / 8
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        const g = coloredBoxGeometry(cell, 0.022, cell, (r + c) % 2 ? '#15151a' : '#f5f0e8')
        g.translate((r - 0.5) * cell, 0, (c - 3.5) * cell)
        pieces.push(g)
      }
    }
    const stripGeometry = mergeGeometries(pieces)
    pieces.forEach((g) => g.dispose())
    return { stripGeometry, angle, pos: [cp[0], 0.043, cp[1]] }
  }, [])

  return (
    <group position={pos} rotation={[0, angle, 0]}>
      <mesh geometry={stripGeometry}>
        <meshStandardMaterial vertexColors />
      </mesh>
      {[-6.2, 6.2].map((z) => (
        <mesh key={z} position={[0, 2.75, z]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 5.5, 8]} />
          <meshStandardMaterial color="#2a2a30" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 5.6, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 13.4]} />
        <meshStandardMaterial color="#c4154a" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <Text key={side} position={[side * 0.28, 5.6, 0]}
          rotation={[0, side * Math.PI / 2, 0]}
          fontSize={0.55} color="#f5f0e8" anchorX="center" anchorY="middle"
          outlineWidth={0.03} outlineColor="#000">
          START · FINISH
        </Text>
      ))}
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
      <StartFinish />
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
