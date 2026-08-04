import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { setBestTime } from '../utils/raceStorage'

// Sized to match folio-2025's actual circuit — measured directly from its
// checkpoint scene data (static/areas/areas.glb): 8 checkpoints averaging
// ~60 units apart, spanning roughly 100x150 units. This track uses 6
// checkpoints at 50-unit spacing (2*radius*sin(30°) = radius for a
// hexagon) — same scale, fewer stops.
//
// Center [90,-90] with radius 50 reaches x/z ≈140, clear of every zone/
// rock/tree exclusion box (all centered on [[0,-55],[55,0],[-55,0],
// [0,55],[0,0]], excluded out to ~20-22 units — see
// EnvironmentModels.jsx/Trees.jsx) and within the ±160 boundary walls
// (World.jsx) — the boundary was pushed out from ±100 specifically to fit
// this.
const TRACK_CENTER = [90, -90]
const TRACK_RADIUS = 50
const CHECKPOINT_COUNT = 6
const CHECK_RADIUS = 12   // bigger track, a bit more forgiving to hit
const GATE_HALF_WIDTH = 5 // matches folio's actual gate width (10 units)
const PATH_WIDTH = 8

const CHECKPOINTS = Array.from({ length: CHECKPOINT_COUNT }, (_, i) => {
  const angle = (i / CHECKPOINT_COUNT) * Math.PI * 2
  return {
    id: i,
    position: [
      TRACK_CENTER[0] + Math.cos(angle) * TRACK_RADIUS,
      TRACK_CENTER[1] + Math.sin(angle) * TRACK_RADIUS,
    ],
    label: i === 0 ? 'START / FINISH' : `CHECKPOINT ${i}`,
  }
})

const _vPos = new THREE.Vector3()
const _cPos = new THREE.Vector3()

// Ground ribbon connecting each checkpoint to the next, so the loop reads
// as an actual track instead of floating gates in open ground.
function TrackPath() {
  const segments = useMemo(() => CHECKPOINTS.map((cp, i) => {
    const next = CHECKPOINTS[(i + 1) % CHECKPOINTS.length]
    const [ax, az] = cp.position
    const [bx, bz] = next.position
    const dx = bx - ax, dz = bz - az
    const length = Math.hypot(dx, dz)
    // Y-axis rotation: local +X maps to world (cos θ, -sin θ) — solve for
    // θ so that direction lands on (dx, dz) normalized.
    const rotationY = -Math.atan2(dz, dx)
    return {
      key: i,
      position: [(ax + bx) / 2, 0.03, (az + bz) / 2],
      rotationY,
      length,
    }
  }), [])

  return (
    <group>
      {segments.map((seg) => (
        <mesh key={seg.key} position={seg.position} rotation={[0, seg.rotationY, 0]}>
          <boxGeometry args={[seg.length, 0.02, PATH_WIDTH]} />
          <meshStandardMaterial color="#1a3a34" transparent opacity={0.55} />
        </mesh>
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

      {/* Gate pillars — purely visual, no collider, same as the resume
          zone markers (a wide-open ring, not something to physically hit) */}
      {[-GATE_HALF_WIDTH, GATE_HALF_WIDTH].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 3, 8]} />
          <meshStandardMaterial color={color} emissive={color}
            emissiveIntensity={isTarget ? 1.2 : 0.3} />
        </mesh>
      ))}

      {isTarget && (
        <group position={[0, 5, 0]}>
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
