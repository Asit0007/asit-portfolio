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
const ASPHALT = '#413a3e' // warm dark asphalt (DESIGN.md: never neutral gray)

const _vPos = new THREE.Vector3()
const _cPos = new THREE.Vector3()

// ── Continuous-ribbon track geometry ────────────────────────────────────
// The road/kerbs/centerline used to be straight boxes laid end to end —
// on every curve the joints left wedge-shaped gaps with ground showing
// through (the "patchy" look). Everything below instead extrudes a lateral
// cross-section along the sampled curve, with all pieces offsetting from
// the same per-sample perpendiculars, so shared edges are watertight by
// construction. Still exactly 2 draw calls: asphalt + merged details.

const LOOP = TRACK_SAMPLES.slice(0, -1) // drop the duplicated closing sample
const N = LOOP.length

// Per-sample unit perpendicular (central difference) — every ribbon
// offsets from these same vectors, so pieces sharing a sample line up.
const PERPS = LOOP.map((_, i) => {
  const prev = LOOP[(i - 1 + N) % N]
  const next = LOOP[(i + 1) % N]
  const px = next.z - prev.z
  const pz = -(next.x - prev.x)
  const l = Math.hypot(px, pz) || 1
  return { x: px / l, z: pz / l }
})

// rows: [{ x, z, nx, nz, shade }] along the curve; profile: [{ o, y, shade }]
// lateral cross-section ordered by increasing o (the quad winding assumes
// this — it's what keeps faces pointing up).
function ribbonGeometry(rows, profile, colorHex) {
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

const sampleRow = (i, shade = 1) => ({
  x: LOOP[i % N].x, z: LOOP[i % N].z,
  nx: PERPS[i % N].x, nz: PERPS[i % N].z,
  shade,
})

// Row partway between samples i and i+1 — lets the centerline dashes
// start/end mid-segment instead of snapping to sample boundaries.
function lerpRow(i, t) {
  const a = LOOP[i % N], b = LOOP[(i + 1) % N]
  const na = PERPS[i % N], nb = PERPS[(i + 1) % N]
  const nx = na.x + (nb.x - na.x) * t
  const nz = na.z + (nb.z - na.z) * t
  const l = Math.hypot(nx, nz) || 1
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    nx: nx / l, nz: nz / l,
  }
}

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

// Ground track connecting the checkpoints — smooth continuous ribbons
// (see the module comment above ribbonGeometry), same visual language as
// folio-2025's actual circuit but built procedurally (folio's is a
// hand-modeled Blender mesh). 2 draw calls total: the asphalt ribbon and
// one merged vertex-colored geometry holding kerbs + centerline dashes.
function TrackPath() {
  const { roadGeometry, detailGeometry } = useMemo(() => {
    // Asphalt: one closed ribbon (the final row lands back on row 0's
    // exact positions). Darker band across the middle fakes the worn
    // racing line; a slow sine drift along the length breaks up the
    // flat fill so it reads as surface, not vector art.
    const roadProfile = [
      { o: -PATH_WIDTH / 2, y: 0.03, shade: 1.04 },
      { o: -PATH_WIDTH * 0.2, y: 0.03, shade: 0.85 },
      { o:  PATH_WIDTH * 0.2, y: 0.03, shade: 0.85 },
      { o:  PATH_WIDTH / 2, y: 0.03, shade: 1.04 },
    ]
    const roadRows = []
    for (let i = 0; i <= N; i++) {
      // Integer wave counts around the loop, so row N's shade matches
      // row 0 exactly — no color seam where the ribbon closes.
      const t = (i / N) * Math.PI * 2
      const drift = 1 + 0.05 * Math.sin(t * 11) + 0.04 * Math.sin(t * 5 + 1.7)
      roadRows.push(sampleRow(i, drift))
    }
    const roadGeometry = ribbonGeometry(roadRows, roadProfile, ASPHALT)

    const details = []

    // Kerbs: a low triangular prism hugging each road edge, one 2-row run
    // per stripe so the red/white alternation stays crisp (no vertex-color
    // bleeding), with shared boundary samples keeping consecutive stripes
    // watertight. Inner edge tucks slightly under the asphalt so no crack
    // can show. Visual only, no collider — the car glides over them.
    for (const side of [-1, 1]) {
      const pts = [
        { o: PATH_WIDTH / 2 - 0.1, y: 0.026 },
        { o: PATH_WIDTH / 2 + BORDER_WIDTH * 0.5, y: 0.088 },
        { o: PATH_WIDTH / 2 + BORDER_WIDTH + 0.1, y: 0.026 },
      ].map((p) => ({ ...p, o: side * p.o }))
      if (side < 0) pts.reverse() // keep profile ordered by increasing o
      for (let i = 0; i < N; i++) {
        details.push(ribbonGeometry(
          [sampleRow(i), sampleRow(i + 1)],
          pts,
          BORDER_COLORS[i % 2]
        ))
      }
    }

    // White dashed centerline — skipped near the start/finish line so it
    // doesn't z-fight the checkered strip.
    const cp0 = CHECKPOINTS[0].position
    const dashProfile = [{ o: -0.14, y: 0.048 }, { o: 0.14, y: 0.048 }]
    for (let i = 0; i < N; i += 2) {
      const mid = lerpRow(i, 0.5)
      if (Math.hypot(mid.x - cp0[0], mid.z - cp0[1]) < 4) continue
      details.push(ribbonGeometry(
        [lerpRow(i, 0.2), lerpRow(i, 0.8)],
        dashProfile,
        '#f5f0e8'
      ))
    }

    const detailGeometry = mergeGeometries(details)
    details.forEach((g) => g.dispose())
    return { roadGeometry, detailGeometry }
  }, [])

  return (
    <group>
      <mesh geometry={roadGeometry}>
        <meshStandardMaterial vertexColors roughness={0.96} />
      </mesh>
      <mesh geometry={detailGeometry}>
        <meshStandardMaterial vertexColors roughness={0.8} />
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
        <mesh key={z} position={[0, 2.75, z]}>
          <cylinderGeometry args={[0.14, 0.14, 5.5, 8]} />
          <meshStandardMaterial color="#2a2a30" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 5.6, 0]}>
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
