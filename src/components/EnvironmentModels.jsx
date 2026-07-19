import { useMemo, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePerformanceTier } from '../hooks/usePerformance'

// Preload only the models we actually render
;[
  '/models/streetlight-1.glb',
  '/models/fence.glb',
  '/models/trashcan.glb',
  '/models/large-trashcan.glb',
  '/models/water-tower.glb',
  '/models/automatron-latern.glb',
  '/models/treasure-chest.glb',
  '/models/gold-bars.glb',
  '/models/snowman.glb',
  '/models/fantasy-tower.glb',
  '/models/wood-1.glb',
  '/models/wood-log.glb',
  '/models/houseplant-1.glb',
  '/models/houseplant-2.glb',
  '/models/flowers-plant-1.glb',
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
    </group>
  )
}

// ── Street lights — every 40 units to keep draw calls low ────────────────
function StreetLights() {
  const positions = [-80, -40, 40, 80]
  return (
    <Suspense fallback={null}>
      <group>
        {positions.map((z, i) => (
          <Model key={`ns-${i}`} path="/models/streetlight-1.glb" position={[5, 0, z]} />
        ))}
        {positions.map((x, i) => (
          <Model key={`ew-${i}`} path="/models/streetlight-1.glb"
            position={[x, 0, 5]} rotation={[0, Math.PI / 2, 0]} />
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
        <Model path="/models/water-tower.glb"    position={[0,   0.6, -68]} scale={1.2} />
        <Model path="/models/fence.glb"           position={[-14, 0.6, -65]} />
        <Model path="/models/fence.glb"           position={[-10, 0.6, -65]} />
        <Model path="/models/fence.glb"           position={[ 10, 0.6, -65]} />
        <Model path="/models/fence.glb"           position={[ 14, 0.6, -65]} />
        <Model path="/models/large-trashcan.glb"  position={[ 12, 0.6, -46]} scale={0.8} />
        <Model path="/models/trashcan.glb"        position={[-12, 0.6, -46]} scale={0.8} />
        <Model path="/models/houseplant-1.glb"    position={[-11, 0.6, -50]} scale={0.7} />
        <Model path="/models/houseplant-2.glb"    position={[ 11, 0.6, -50]} scale={0.7} />
      </group>
    </Suspense>
  )
}

function ProjectsZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <Model path="/models/trashcan.glb"        position={[46, 0.6,  12]} scale={0.7} />
        <Model path="/models/trashcan.glb"        position={[46, 0.6, -12]} scale={0.7} />
        <Model path="/models/flowers-plant-1.glb" position={[46, 0.6,  0]}  scale={0.8} />
        <Model path="/models/wood-1.glb"          position={[70, 0.6,  12]} scale={0.6}
          rotation={[0, 0.4, 0]} />
        <Model path="/models/wood-log.glb"        position={[70, 0.6, -12]} scale={0.6} />
      </group>
    </Suspense>
  )
}

function HobbiesZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <Model path="/models/treasure-chest.glb" position={[-68, 0.6,  6]}
          scale={0.9} rotation={[0, Math.PI / 2, 0]} />
        <Model path="/models/gold-bars.glb"       position={[-68, 0.6, -6]}
          scale={0.8} rotation={[0, Math.PI / 2, 0]} />
        <Model path="/models/snowman.glb"          position={[-46, 0.6,  12]} scale={0.9} />
        <Model path="/models/snowman.glb"          position={[-46, 0.6, -12]} scale={0.7}
          rotation={[0, 1.2, 0]} />
        <Model path="/models/fantasy-tower.glb"   position={[-70, 0.6,  0]}
          scale={0.8} rotation={[0, Math.PI / 2, 0]} />
        <Model path="/models/wood-log.glb"         position={[-48, 0.6,  8]}  scale={0.6} />
        <Model path="/models/wood-log.glb"         position={[-48, 0.6, -8]}  scale={0.6}
          rotation={[0, 1.5, 0]} />
      </group>
    </Suspense>
  )
}

function ContactZoneProps() {
  return (
    <Suspense fallback={null}>
      <group>
        <Model path="/models/automatron-latern.glb" position={[0, 0.6, 68]} scale={0.9} />
        <Model path="/models/fence.glb" position={[-14, 0.6, 68]} />
        <Model path="/models/fence.glb" position={[-10, 0.6, 68]} />
        <Model path="/models/fence.glb" position={[ 10, 0.6, 68]} />
        <Model path="/models/fence.glb" position={[ 14, 0.6, 68]} />
      </group>
    </Suspense>
  )
}

export default function EnvironmentModels() {
  const tier = usePerformanceTier()
  const t = tier ?? 1

  return (
    <group>
      <CloudZoneProps />
      <ProjectsZoneProps />
      <HobbiesZoneProps />
      <ContactZoneProps />
      {t >= 1 && <RockScatter count={t === 2 ? 12 : 5} />}
      {t >= 1 && <StreetLights />}
    </group>
  )
}
