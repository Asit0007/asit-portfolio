import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { triggerShake } from '../utils/cameraShake'
import { playExplosion } from '../audio'

// ── Explosive crates ──────────────────────────────────────────────────────
// Straight from folio-2025's ExplosiveCrates.js, with two deliberate
// departures.
//
// FIXED, not dynamic. folio's crates are dynamic bodies that start asleep,
// which costs nothing until touched and lets you shove them around. Ours
// don't need shoving — this world already has sixteen dynamic crates for
// that (World.jsx ScatterProps) — and staying fixed means the visual can be
// one InstancedMesh with no per-frame matrix sync at all. A barrel you
// detonate rather than a box you nudge.
//
// They COME BACK. folio has a global "reset objects" control; we have none,
// so a crate blown up would be gone for the rest of the visit and the toy
// would be single-use. They re-arm after a few seconds instead.
//
// The hide-by-moving trick is folio's: rather than rebuilding the instanced
// mesh, a spent crate's instance is pushed far under the ground, which
// costs one matrix write.
//
// Cost: one instanced draw call for every crate, eight static cuboid
// colliders on one shared fixed body, and at most a couple of transient
// meshes while something is actually exploding.

const CRATE_SIZE   = 1.5
const RESPAWN_MS   = 7000
const BURIED_Y     = -50    // where a spent crate's instance parks
// Below this the car is parked or crawling, and nudging a crate at walking
// pace should not set it off — same reasoning as the boulder jolt's speed
// gate in EnvironmentModels.
const ARM_SPEED    = 4

// On the shoulders of the four road spokes, where they're seen at speed and
// hitting one is a small deliberate swerve, plus one out in the open desert.
// Every position is checked against the zone plazas, the name letters, the
// ramps and the racing circuit.
const CRATES = [
  { x:  -7, z: -80 },
  { x:  -7, z:  30 },
  { x:   7, z:  80 },
  { x:  30, z:  -7 },
  { x:  80, z:   7 },
  { x: -30, z:   7 },
  { x: -80, z:  -7 },
  { x:  50, z: -50 },
]

// ── The blast ─────────────────────────────────────────────────────────────
// folio's fireball is a TSL node material on the WebGPU renderer — three
// layers of procedural noise, discarded through a moving threshold. None of
// that ports to our WebGL/MeshStandard scene without writing the shader
// from scratch, so this is the honest cheap version of the same idea: a
// low-poly sphere that punches outward and fades, lit by nothing (emissive
// + toneMapped false) so it blows out against the sand exactly like the
// headlamp lenses do.
const BLAST_LIFE  = 0.62   // seconds
const BLAST_MAX_R = 4.2

function Blast({ position, onDone }) {
  const ref   = useRef()
  // Stamped on the first frame rather than at render: reading the clock
  // during render is impure, and a re-render would restart the animation.
  const start = useRef(0)

  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (!start.current) start.current = performance.now()
    const t = (performance.now() - start.current) / (BLAST_LIFE * 1000)
    if (t >= 1) { onDone(); return }
    // Fast out, slow settle — an explosion's edge decelerates hard.
    const r = BLAST_MAX_R * (1 - Math.pow(1 - t, 3))
    m.scale.setScalar(Math.max(r, 0.001))
    m.material.opacity = (1 - t) * 0.9
    // Orange core cooling to deep red as it expands.
    m.material.color.setRGB(1, 0.55 - t * 0.35, 0.12 - t * 0.1)
  })

  return (
    <mesh ref={ref} position={position} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} depthWrite={false} flatShading />
    </mesh>
  )
}

export default function ExplosiveCrates() {
  const meshRef = useRef()
  // Which crates are currently blown. In state because the colliders read it
  // during render, and mirrored into a ref because the collision handler runs
  // outside React and a stale closure would let one crate detonate twice.
  const [spent, setSpent] = useState(() => CRATES.map(() => false))
  const spentRef = useRef(spent)
  const [blasts, setBlasts] = useState([])
  const nextId  = useRef(0)

  const dummy = useMemo(() => new THREE.Object3D(), [])

  const place = useCallback((i, buried) => {
    const mesh = meshRef.current
    if (!mesh) return
    const c = CRATES[i]
    dummy.position.set(c.x, buried ? BURIED_Y : CRATE_SIZE / 2, c.z)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }, [dummy])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    CRATES.forEach((_, i) => place(i, false))
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [place])

  const setSpentAt = useCallback((i, v) => {
    setSpent((prev) => {
      const next = prev.slice()
      next[i] = v
      spentRef.current = next
      return next
    })
  }, [])

  const detonate = useCallback((i) => {
    if (spentRef.current[i]) return
    const body = useGameStore.getState().vehicleBody
    if (body) {
      const lv = body.linvel()
      if (Math.hypot(lv.x, lv.z) < ARM_SPEED) return
    }
    setSpentAt(i, true)
    place(i, true)

    const c = CRATES[i]
    playExplosion()
    // A discrete hit, which is exactly what the camera's impulse channel is
    // for (cameraShake.js) — unlike gravel, this should kick the frame.
    triggerShake(0.3, 320)
    setBlasts((b) => [...b, { id: nextId.current++, position: [c.x, CRATE_SIZE / 2, c.z] }])

    setTimeout(() => {
      setSpentAt(i, false)
      place(i, false)
    }, RESPAWN_MS)
  }, [place, setSpentAt])

  const clearBlast = useCallback((id) => {
    setBlasts((b) => b.filter((x) => x.id !== id))
  }, [])

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, CRATES.length]} frustumCulled={false}>
        <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
        {/* Hot orange against the sand's amber — close enough to belong in
            the palette (DESIGN.md §2), bright enough to read as "don't". */}
        <meshStandardMaterial color="#e0622a" roughness={0.6} metalness={0.1} flatShading />
      </instancedMesh>

      {/* One fixed body for all of them — no rigid body per crate, nothing
          to sync (same rule as the boulders and the gravel). A spent crate's
          collider is disabled rather than removed, so the set never has to
          be rebuilt. */}
      <RigidBody type="fixed" colliders={false}>
        {CRATES.map((c, i) => (
          <CuboidCollider
            key={i}
            args={[CRATE_SIZE / 2, CRATE_SIZE / 2, CRATE_SIZE / 2]}
            position={[c.x, CRATE_SIZE / 2, c.z]}
            sensor={spent[i]}
            onCollisionEnter={() => detonate(i)}
          />
        ))}
      </RigidBody>

      {blasts.map((b) => (
        <Blast key={b.id} position={b.position} onDone={() => clearBlast(b.id)} />
      ))}
    </group>
  )
}
