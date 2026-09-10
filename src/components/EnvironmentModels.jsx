import { useMemo, useEffect, useRef, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider, HeightfieldCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { triggerShake } from '../utils/cameraShake'
import useGameStore from '../store/useGameStore'
import { isNearTrack } from '../data/track'
import { SCATTER_DATA } from './World'
import { NAME_KEEPOUT } from './NameTitle'
import { isOnRamp } from './Ramps'

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

// Clipping a rock used to shake the camera and nothing else — the car
// itself never reacted, because its pitch/roll inertia is deliberately
// stiff (Vehicle.jsx locks it down to kill wheelies) so the chassis barely
// tilts on its own. Kicking the body directly restores the thump without
// touching that tuning: a short vertical impulse plus a torque impulse
// weighted toward roll, which has the softest inertia (1.2 against pitch's
// 14) and so reads as the car lurching to one side over the obstacle.
function joltCar(scale) {
  const body = useGameStore.getState().vehicleBody
  if (!body) return
  const lv = body.linvel()
  const speed = Math.hypot(lv.x, lv.z)
  // Parking against a rock shouldn't make the car buck in place.
  if (speed < 2) return
  const j = Math.min(speed / 12, 1) * scale
  body.applyImpulse({ x: 0, y: 2.6 * j, z: 0 }, true)
  body.applyTorqueImpulse({
    x: (Math.random() - 0.5) * 0.25 * j,
    y: 0,
    z: (Math.random() - 0.5) * 0.85 * j,
  }, true)
}

// Everywhere a loose prop is allowed to land: off the crossroads, out of
// the zone plazas, and clear of the racing circuit. Hoisted out of
// RockScatter because the gravel below has to obey exactly the same rules —
// an apron of stones spilling onto the asphalt would be worse than no
// gravel at all, since pavement is the one surface that has to stay smooth.
const ZONE_CENTERS = [[0, -55], [55, 0], [-55, 0], [0, 55], [0, 0]]
function isOpenGround(x, z) {
  if (Math.abs(x) < 8 || Math.abs(z) < 8) return false
  if (ZONE_CENTERS.some(([zx, zz]) => Math.abs(x - zx) < 22 && Math.abs(z - zz) < 22)) return false
  if (isNearTrack(x, z, 6)) return false
  if (isOnRamp(x, z, 3)) return false
  return true
}

// ── Gravel ────────────────────────────────────────────────────────────────
// The boulders are single obstacles: clip one and the car takes one jolt.
// What was missing is the ground BETWEEN them. Real desert around a boulder
// is a spill of loose stone, and crossing it should chatter the suspension
// continuously — where, with one perfectly flat ground collider under the
// whole world, every square metre out here was as glassy as the asphalt.
//
// The FEEL comes from a heightfield, not from the stones. That is the whole
// design decision, and it is worth writing down because the obvious
// implementation does not work: a scatter of little pebble colliders reads
// correctly in a screenshot and is felt almost never. Rapier's raycast
// vehicle probes the ground with four zero-width rays, so a wheel only
// notices a pebble if its ray passes within the stone's own half-width of
// the centre — about 0.11 units. Eight stones over a 75 m^2 patch works out
// at roughly one hit per four crossings. To get the ~5 hits per metre that
// would actually read as vibration you would need something like 1700
// colliders per patch.
//
// A heightfield inverts that: it is a continuous surface, so EVERY ray
// lands on it and every ray gets a different answer. One collider per patch
// replaces hundreds, and the roughness is genuinely there in the physics —
// the springs really do work, the chassis really does shiver, and
// Vehicle.jsx reads the ground height straight back off the wheels to drive
// the camera rumble and the tyre noise.
//
// Amplitude is deliberately small: 0.10 against a 0.36 wheel radius and
// 0.22 of suspension travel, tapered to nothing at the rim so the patch
// edge is a surface and not a kerb. The car is never stopped, deflected or
// launched by it. The instanced stones on top are the LOOK, and the decal
// under them is the read — so the visitor can see why the car is shaking.
//
// Cost (DESIGN.md 8.6): 2 draw calls for every gravel patch in the world
// (one instanced stone mesh, one instanced decal), ~8 triangles per stone,
// and one static heightfield collider per patch.
const PATCH_HALF    = 5.0    // heightfield spans 10 x 10 world units
const PATCH_CELLS   = 24     // subdivisions -> 25x25 samples, 0.42-unit cells
const GRAVEL_DEPTH  = 0.10   // peak stone-bed height above the sand
const STONES_PER_PATCH = 12
const STONE_RADIUS  = 3.6    // stones cluster inside the rough core

// Sits above the sand and below the contact blobs at 0.075, so a tree's
// shadow still draws over the gravel it stands in. See the decal-height
// stack in GroundShadows.jsx.
const GRAVEL_DECAL_Y = 0.05

// Warm desert stone, inside the amber band (DESIGN.md 2) — grey gravel
// punched a cool hole in the sand.
const STONE_COLORS = ['#c2a483', '#ad8f6f', '#d3b895', '#9c8064']

// White noise, not smooth noise: adjacent samples SHOULD be unrelated. A
// smoothed field is a dune, and a dune is something the car floats over.
// Tapered radially, and to exactly 0 at the rim, so the bed thins into the
// surrounding sand instead of ending in a step.
function buildHeights(rng) {
  const n = PATCH_CELLS + 1
  const h = new Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = (i / PATCH_CELLS) * 2 - 1
      const v = (j / PATCH_CELLS) * 2 - 1
      const r = Math.min(Math.hypot(u, v), 1)
      h[i * n + j] = rng() * GRAVEL_DEPTH * (1 - r * r)
    }
  }
  return h
}

// Nearest-sample lookup, used to stand each visible stone on the bed rather
// than on the flat sand underneath it.
function sampleHeight(heights, dx, dz) {
  const n = PATCH_CELLS + 1
  const i = Math.round(((dx / PATCH_HALF) * 0.5 + 0.5) * PATCH_CELLS)
  const j = Math.round(((dz / PATCH_HALF) * 0.5 + 0.5) * PATCH_CELLS)
  if (i < 0 || j < 0 || i >= n || j >= n) return 0
  return heights[i * n + j]
}

// Gravel is a rough surface, and this world has loose DYNAMIC props resting
// on the ground for the whole session: the shoveable crates (World.jsx) and
// the name's letters (NameTitle.jsx). Drop one of those onto a bumpy
// heightfield and it never settles — it rocks against the slope, never
// reaches Rapier's sleep threshold, and goes on costing solver time and
// twitching visibly forever. Measured before this filter: 2-4 crates and up
// to 3 letters sat on gravel at every tier.
//
// Only patch CENTRES are filtered, not boulder placement. A boulder too
// close to a crate simply goes without its apron; it does not move, so the
// existing world layout is untouched.
const PROP_CLEARANCE = PATCH_HALF + 2
function clearOfLooseProps(x, z) {
  for (const r of SCATTER_DATA) {
    if (Math.abs(x - r.x) < PROP_CLEARANCE && Math.abs(z - r.z) < PROP_CLEARANCE) return false
  }
  return !(x > NAME_KEEPOUT.minX - PATCH_HALF && x < NAME_KEEPOUT.maxX + PATCH_HALF &&
           z > NAME_KEEPOUT.minZ - PATCH_HALF && z < NAME_KEEPOUT.maxZ + PATCH_HALF)
}

function buildPatches(centers, rng) {
  return centers.map(([cx, cz]) => {
    const heights = buildHeights(rng)
    const stones  = []
    for (let i = 0; i < STONES_PER_PATCH; i++) {
      const a = rng() * Math.PI * 2
      // sqrt keeps the density even across the disc instead of clumping it
      // all at the centre.
      const r  = 0.5 + Math.sqrt(rng()) * STONE_RADIUS
      const dx = Math.cos(a) * r
      const dz = Math.sin(a) * r
      const x  = cx + dx
      const z  = cz + dz
      if (!isOpenGround(x, z)) continue
      stones.push({
        x, z,
        y:    sampleHeight(heights, dx, dz),
        w:    0.11 + rng() * 0.15,
        h:    0.05 + rng() * 0.08,
        rotY: rng() * Math.PI * 2,
        tint: Math.floor(rng() * STONE_COLORS.length),
      })
    }
    return { cx, cz, heights, stones }
  })
}

// An octahedron reads as an angular stone at this size for 8 triangles — a
// dodecahedron would look no different across ~6 screen pixels and cost 4.5x
// the geometry. Sunk partway into the bed so none of them float.
const STONE_GEO = new THREE.OctahedronGeometry(1, 0)

// Mottled disc marking the rough ground. Warm and low-contrast on purpose:
// it has to be visible enough to explain the vibration and quiet enough not
// to read as a crater.
let _gravelTex = null
function gravelTexture() {
  if (_gravelTex) return _gravelTex
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0.00, 'rgba(120, 74, 34, 0.30)')
  g.addColorStop(0.55, 'rgba(120, 74, 34, 0.20)')
  g.addColorStop(0.82, 'rgba(120, 74, 34, 0.07)')
  g.addColorStop(1.00, 'rgba(120, 74, 34, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // Speckle, so the patch reads as loose stone rather than as a stain.
  let seed = 91
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * (S / 2)
    const x = S / 2 + Math.cos(a) * r
    const y = S / 2 + Math.sin(a) * r
    const fade = 1 - (r / (S / 2))
    ctx.fillStyle = rand() > 0.5
      ? `rgba(90, 55, 24, ${0.30 * fade})`
      : `rgba(224, 196, 152, ${0.26 * fade})`
    ctx.fillRect(x, y, 1 + rand() * 1.6, 1 + rand() * 1.6)
  }
  _gravelTex = new THREE.CanvasTexture(canvas)
  _gravelTex.colorSpace = THREE.SRGBColorSpace
  return _gravelTex
}

function Gravel({ patches }) {
  const stones = useMemo(() => patches.flatMap((p) => p.stones), [patches])
  const tex    = useMemo(() => gravelTexture(), [])
  const decalGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(() => () => decalGeo.dispose(), [decalGeo])

  const stoneRef = useRef()
  const decalRef = useRef()

  useEffect(() => {
    const mesh = stoneRef.current
    if (!mesh || stones.length === 0) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    stones.forEach(({ x, y, z, w, h, rotY, tint }, i) => {
      dummy.position.set(x, y + h * 0.45, z)
      dummy.rotation.set(0, rotY, 0)
      dummy.scale.set(w, h, w)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.set(STONE_COLORS[tint]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Same reasoning as Trees.jsx: patches span the whole world, so a real
    // bounding sphere would only ever cull when all of them are off-screen.
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [stones])

  useEffect(() => {
    const mesh = decalRef.current
    if (!mesh || patches.length === 0) return
    const dummy = new THREE.Object3D()
    patches.forEach(({ cx, cz }, i) => {
      dummy.position.set(cx, GRAVEL_DECAL_Y, cz)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(PATCH_HALF * 2)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [patches, decalGeo])

  if (patches.length === 0) return null

  return (
    <group>
      {/* The rough surface itself. One static heightfield per patch, all on
          a single fixed body — no per-instance rigid body, nothing to sync
          per frame (same rule as the boulder colliders above). */}
      <RigidBody type="fixed" colliders={false}>
        {patches.map(({ cx, cz, heights }, i) => (
          <HeightfieldCollider
            key={i}
            args={[PATCH_CELLS, PATCH_CELLS, heights, { x: PATCH_HALF * 2, y: 1, z: PATCH_HALF * 2 }]}
            position={[cx, 0, cz]}
            friction={1.2}
          />
        ))}
      </RigidBody>

      {/* Ground read — drawn before the contact blobs (renderOrder -1) so a
          tree's shadow still lands on top of the gravel it stands in. */}
      <instancedMesh
        key={`d${patches.length}`}
        ref={decalRef}
        args={[decalGeo, undefined, patches.length]}
        frustumCulled={false}
        renderOrder={-2}
      >
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {/* Visible stones. White base colour — the real colour rides on
          instanceColor, which three multiplies against this. */}
      {stones.length > 0 && (
        <instancedMesh
          key={`s${stones.length}`}
          ref={stoneRef}
          args={[STONE_GEO, undefined, stones.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0} flatShading />
        </instancedMesh>
      )}
    </group>
  )
}

function RockScatter({ count }) {
  const { placements, patches } = useMemo(() => {
    const rng = makeRng(137)
    const result = []
    let attempts = 0
    while (result.length < count && attempts < count * 20) {
      attempts++
      const angle  = rng() * Math.PI * 2
      const radius = 20 + rng() * 65
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (!isOpenGround(x, z)) continue
      result.push({
        x, z,
        model: `/models/snowy-rock-${1 + Math.floor(rng() * 4)}.glb`,
        scale: 0.4 + rng() * 0.7,
        rotY:  rng() * Math.PI * 2,
      })
    }

    // Every boulder gets an apron, plus a run of patches with no boulder at
    // all — gravel without a rock sitting in it is the commoner sight, and
    // it roughly doubles the chance of driving across some while exploring
    // for the cost of a few dozen more colliders.
    const centers = result
      .filter(({ x, z }) => clearOfLooseProps(x, z))
      .map(({ x, z }) => [x, z])
    let extra = Math.round(count * 0.8)
    attempts = 0
    while (extra > 0 && attempts < count * 20) {
      attempts++
      const angle  = rng() * Math.PI * 2
      const radius = 18 + rng() * 70
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (!isOpenGround(x, z) || !clearOfLooseProps(x, z)) continue
      centers.push([x, z])
      extra--
    }

    return { placements: result, patches: buildPatches(centers, rng) }
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
            onCollisionEnter={() => {
              triggerShake(0.16 * scale)
              joltCar(scale)
            }}
          />
        ))}
      </RigidBody>

      <Gravel patches={patches} />
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
        {/* Off the carriageway. At x=0 with a 1.6-unit collider half-width
            it stood squarely in the middle of an 8-wide road, so the only
            way north was to drive through its legs. x=-7.6 puts its west
            leg 2 units clear of the road edge and its east side 0.45 clear
            of the fence line at x=-11, with the model's own ladder and
            downpipe (which sit on its +x face) turned toward the road. */}
        <SolidModel path="/models/water-tower.glb"    position={[-7.6, 0.6, -68]} scale={1.2} />
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

// A few streetlights along the racing circuit for atmosphere — repositioned
// alongside the big wraparound loop (src/data/track.js), offset ~8.5 units
// outward from the road edge at three points spaced around the new, much
// bigger track. Reuses the same already-optimized model/collider as the
// crossroad StreetLights above — no new asset cost.
function CircuitProps() {
  const positions = [
    [ 48.4, 0.6, -116.9],
    [ 47.4, 0.6,  117.2],
    [-115.6, 0.6,  33.2],
  ]
  return (
    <Suspense fallback={null}>
      <group>
        {positions.map((p, i) => (
          <SolidModel key={i} path="/models/streetlight-1.glb" position={p} scale={3} />
        ))}
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
      <CircuitProps />
      <RockScatter count={maxProps} />
      <StreetLights />
    </group>
  )
}
