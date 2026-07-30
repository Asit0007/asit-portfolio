import { useMemo, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { triggerShake } from '../utils/cameraShake'

// Preload only the models we actually render
;[
  '/models/streetlight-1.glb',
  '/models/fence.glb',
  '/models/water-tower.glb',
  '/models/treasure-chest.glb',
  '/models/snowman.glb',
  '/models/fantasy-tower.glb',
  '/models/wood-1.glb',
  '/models/snowy-rock-1.glb',
  '/models/snowy-rock-2.glb',
  '/models/snowy-rock-3.glb',
  '/models/snowy-rock-4.glb',
].forEach(p => useGLTF.preload(p))

function cloneModel(scene) {
  const clone = scene.clone(true)
  clone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow    = true
      child.receiveShadow = true
      child.matrixAutoUpdate = false
    }
  })
  return clone
}

function Model({ path, position, rotation = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF(path)
  const cloned = useMemo(() => cloneModel(scene), [scene])
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale
  return <primitive object={cloned} position={position} rotation={rotation} scale={s} />
}

// Approximate box-collider half-extents (at scale 1) + vertical center,
// measured from each model's actual bounding box via `gltf-transform
// inspect`. Without these, every environment prop was purely visual — the
// car drove straight through the water tower, fences, streetlights, etc.
const COLLIDER_SIZES = {
  '/models/water-tower.glb':    { half: [1.34, 4.21, 1.25], centerY: 4.14 },
  '/models/fence.glb':          { half: [0.6,  0.34, 0.15], centerY: 0.34 }, // Z padded up from
                                                                              // the model's ~0.04
                                                                              // actual depth — a
                                                                              // near-zero-thickness
                                                                              // collider risks the
                                                                              // same intermittent-
                                                                              // miss issue the
                                                                              // ground collider had
  '/models/wood-1.glb':         { half: [0.38, 0.43, 0.37], centerY: 0.43 },
  '/models/fantasy-tower.glb':  { half: [0.2,  0.56, 0.22], centerY: 0 },
  '/models/treasure-chest.glb': { half: [0.52, 0.25, 0.41], centerY: 0.25 },
  '/models/streetlight-1.glb':  { half: [0.07, 0.55, 0.16], centerY: 0.55 },
  // snowman.glb's real bbox reaches ~2.5 units out (thin stick arms) — a
  // collider that size would be an invisible wall far wider than the
  // visible body, so this is a smaller box sized to just the stacked-
  // sphere body instead.
  '/models/snowman.glb':        { half: [0.9,  2.05, 0.9],  centerY: 1.8 },
}

// Same visual as Model, plus a fixed physics collider sized from
// COLLIDER_SIZES so the car actually collides with it instead of driving
// through.
function SolidModel({ path, position, rotation = [0, 0, 0], scale = 1 }) {
  const size = COLLIDER_SIZES[path]
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders={false}>
      <Model path={path} position={[0, 0, 0]} scale={scale} />
      {size && (
        <CuboidCollider
          args={size.half.map((h) => h * scale)}
          position={[0, size.centerY * scale, 0]}
        />
      )}
    </RigidBody>
  )
}

// ── Seeded RNG for deterministic rock placement ───────────────────────────
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1)
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296
  }
}

function RockScatter({ count }) {
  const placements = useMemo(() => {
    const rng = makeRng(137)
    const ZONE_CENTERS = [[0, -55], [55, 0], [-55, 0], [0, 55], [0, 0]]
    const result = []
    let attempts = 0
    while (result.length < count && attempts < count * 20) {
      attempts++
      const angle  = rng() * Math.PI * 2
      const radius = 20 + rng() * 65
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.abs(x) < 8 || Math.abs(z) < 8) continue
      if (ZONE_CENTERS.some(([zx, zz]) => Math.abs(x - zx) < 22 && Math.abs(z - zz) < 22)) continue
      result.push({
        x, z,
        model: `/models/snowy-rock-${1 + Math.floor(rng() * 4)}.glb`,
        scale: 0.4 + rng() * 0.7,
        rotY:  rng() * Math.PI * 2,
      })
    }
    return result
  }, [count])

  return (
    <group>
      {placements.map(({ x, z, model, scale, rotY }, i) => (
        <Suspense key={i} fallback={null}>
          <Model path={model} position={[x, 0, z]} rotation={[0, rotY, 0]} scale={scale} />
        </Suspense>
      ))}

      {/* Physics bumps — one static collider per rock, all on a single
          fixed body (see Trees.jsx for why: no per-instance rigid body,
          no per-frame sync). Driving over one jolts the camera since the
          car's own pitch/roll rotation is locked and can't show a bump. */}
      <RigidBody type="fixed" colliders={false}>
        {placements.map(({ x, z, scale }, i) => (
          <CuboidCollider
            key={i}
            args={[0.35 * scale, 0.22 * scale, 0.35 * scale]}
            position={[x, 0.15 * scale, z]}
            onCollisionEnter={() => triggerShake(0.16 * scale)}
          />
        ))}
      </RigidBody>
    </group>
  )
}

// ── Street lights — every 40 units to keep draw calls low ────────────────
function StreetLights() {
  const positions = [-80, -40, 40, 80]
  return (
    <Suspense fallback={null}>
      <group>
        {/* streetlight-1.glb is only ~1.1 units tall at scale 1 — nearly
            invisible next to the car and road; scaled up to read as an
            actual street lamp */}
        {positions.map((z, i) => (
          <SolidModel key={`ns-${i}`} path="/models/streetlight-1.glb" position={[5, 0, z]} scale={3} />
        ))}
        {positions.map((x, i) => (
          <SolidModel key={`ew-${i}`} path="/models/streetlight-1.glb"
            position={[x, 0, 5]} rotation={[0, Math.PI / 2, 0]} scale={3} />
        ))}
      </group>
    </Suspense>
  )
}

// ── Zone-specific props ───────────────────────────────────────────────────
function CloudZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <SolidModel path="/models/water-tower.glb"    position={[0,   0.6, -68]} scale={1.2} />
        <SolidModel path="/models/fence.glb"           position={[-14, 0.6, -65]} scale={2.4} />
        <SolidModel path="/models/fence.glb"           position={[-11, 0.6, -65]} scale={2.4} />
        <SolidModel path="/models/fence.glb"           position={[ 11, 0.6, -65]} scale={2.4} />
        <SolidModel path="/models/fence.glb"           position={[ 14, 0.6, -65]} scale={2.4} />
      </group>
    </Suspense>
  )
}

function ProjectsZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <SolidModel path="/models/wood-1.glb"          position={[70, 0.6,  12]} scale={0.6}
          rotation={[0, 0.4, 0]} />
      </group>
    </Suspense>
  )
}

function HobbiesZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <SolidModel path="/models/treasure-chest.glb" position={[-68, 0.6,  6]}
          scale={0.9} rotation={[0, Math.PI / 2, 0]} />
        <SolidModel path="/models/snowman.glb"          position={[-46, 0.6,  12]} scale={0.9} />
        <SolidModel path="/models/snowman.glb"          position={[-46, 0.6, -12]} scale={0.7}
          rotation={[0, 1.2, 0]} />
        <SolidModel path="/models/fantasy-tower.glb"   position={[-70, 0.6,  0]}
          scale={0.8} rotation={[0, Math.PI / 2, 0]} />
      </group>
    </Suspense>
  )
}

function ContactZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <SolidModel path="/models/fence.glb" position={[-14, 0.6, 68]} scale={2.4} />
        <SolidModel path="/models/fence.glb" position={[-11, 0.6, 68]} scale={2.4} />
        <SolidModel path="/models/fence.glb" position={[ 11, 0.6, 68]} scale={2.4} />
        <SolidModel path="/models/fence.glb" position={[ 14, 0.6, 68]} scale={2.4} />
      </group>
    </Suspense>
  )
}

export default function EnvironmentModels({ maxProps }) {
  return (
    <group>
      <CloudZoneProps />
      <ProjectsZoneProps />
      <HobbiesZoneProps />
      <ContactZoneProps />
      <RockScatter count={maxProps} />
      <StreetLights />
    </group>
  )
}
