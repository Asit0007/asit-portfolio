import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { isNearTrack } from '../data/track'

const TREE_COUNT = 100

// ── Species ───────────────────────────────────────────────────────────────
// Three canopy shapes instead of one cone. The world is a desert diorama
// (DESIGN.md §1), so the flat-topped acacia leads the mix — it's the shape
// that reads as "arid" rather than "generic forest", and it silhouettes far
// better against the orange sand than a cone does.
//
// Each species' canopy is MERGED into a single geometry, so a three-tier
// pine still costs exactly one instanced draw call. Draw-call budget
// (DESIGN.md §8.6): 1 trunk + 3 canopies = 4 calls for all 100 trees,
// up from 2. Measured against a scene that sits at 42-259 calls.
const SPECIES = ['acacia', 'round', 'pine']

// Weighted so the desert silhouette dominates; pine stays a minority accent
// that ties back to the existing pine/snow props in EnvironmentModels.
const SPECIES_MIX = ['acacia', 'acacia', 'acacia', 'round', 'round', 'pine']

function canopyGeometry(species) {
  const parts = []
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz)
    geo.translate(x, y, z)
    parts.push(geo)
  }

  if (species === 'acacia') {
    // Wide, flattened, slightly asymmetric umbrella.
    add(new THREE.IcosahedronGeometry(1.55, 0), 0, 2.62, 0, 1, 0.40, 1)
    add(new THREE.IcosahedronGeometry(0.85, 0), 0.62, 2.38, -0.34, 1, 0.42, 1)
  } else if (species === 'round') {
    // Clustered blobs — a broadleaf crown with a lumpy, hand-made outline.
    add(new THREE.IcosahedronGeometry(1.12, 0), 0, 2.55, 0)
    add(new THREE.IcosahedronGeometry(0.78, 0), 0.64, 2.10, 0.36)
    add(new THREE.IcosahedronGeometry(0.68, 0), -0.52, 2.24, -0.42)
  } else {
    // Three tapering tiers.
    add(new THREE.ConeGeometry(1.22, 1.5, 7), 0, 1.95, 0)
    add(new THREE.ConeGeometry(0.94, 1.3, 7), 0, 2.72, 0)
    add(new THREE.ConeGeometry(0.60, 1.1, 7), 0, 3.42, 0)
  }

  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

// Trunk sits with its base at y=0 so instance transforms are plain
// (position, rotation, scale) with no per-species height bookkeeping.
function trunkGeometry() {
  const g = new THREE.CylinderGeometry(0.15, 0.3, 2.0, 6)
  g.translate(0, 1.0, 0)
  return g
}

// Warm sage/olive greens rather than one flat forest green — these sit in
// the desert-amber band (DESIGN.md §2) instead of fighting it.
const CANOPY_COLORS = {
  acacia: ['#7d9a4a', '#6b8b3d', '#8aa653'],
  round:  ['#5f8a3a', '#6f9942', '#547d34'],
  pine:   ['#4a7135', '#3f6530', '#55803c'],
}
const TRUNK_COLORS = ['#8b5e3c', '#7a5334', '#96694a']

function randomTreePositions() {
  const zoneCenters = [[0,-55],[55,0],[-55,0],[0,55],[0,0]]
  const positions = []
  let attempts = 0
  while (positions.length < TREE_COUNT && attempts < 3000) {
    attempts++
    const angle  = Math.random() * Math.PI * 2
    const radius = 22 + Math.random() * 72
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue
    if (zoneCenters.some(([zx,zz]) =>
      Math.abs(x-zx) < 20 && Math.abs(z-zz) < 20)) continue
    if (isNearTrack(x, z, 6)) continue
    positions.push({
      x, z,
      scale: 0.7 + Math.random() * 0.9,
      // Per-instance variation. The old version applied position and scale
      // only, so all 100 trees were the same object at different sizes —
      // which is what made them read as clones rather than as a treeline.
      species: SPECIES_MIX[Math.floor(Math.random() * SPECIES_MIX.length)],
      rotY:    Math.random() * Math.PI * 2,
      leanX:   (Math.random() - 0.5) * 0.13,
      leanZ:   (Math.random() - 0.5) * 0.13,
      tint:    Math.floor(Math.random() * 3),
      trunkTint: Math.floor(Math.random() * TRUNK_COLORS.length),
    })
  }
  return positions
}

// Frozen at module load — positions are stable across renders
export const TREES = randomTreePositions()

// One instanced canopy per species. Split out so each gets its own ref and
// its own geometry without duplicating the matrix/color loop three times.
function Canopy({ species, trees }) {
  const ref = useRef()
  const geo = useMemo(() => canopyGeometry(species), [species])
  useEffect(() => () => geo.dispose(), [geo])

  const count = trees.length

  useEffect(() => {
    const mesh = ref.current
    if (!mesh || count === 0) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const palette = CANOPY_COLORS[species]

    trees.forEach(({ x, z, scale, rotY, leanX, leanZ, tint }, i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(leanX, rotY, leanZ)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.set(palette[tint % palette.length]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Trees are scattered to r~94; a real bounding sphere would only cull
    // when every tree is off-screen. Keep the existing generous sphere.
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), 200)
  }, [trees, count, species, geo])

  if (count === 0) return null

  return (
    <instancedMesh
      key={`${species}-${count}`}
      ref={ref}
      args={[geo, undefined, count]}
      frustumCulled={false}
    >
      {/* White base color — the real color rides on instanceColor, which
          three multiplies against this. */}
      <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
    </instancedMesh>
  )
}

export default function Trees({ maxTrees = TREE_COUNT }) {
  const trunkRef = useRef()
  const visibleTrees = useMemo(() => TREES.slice(0, maxTrees), [maxTrees])
  const count = visibleTrees.length

  const trunkGeo = useMemo(() => trunkGeometry(), [])
  useEffect(() => () => trunkGeo.dispose(), [trunkGeo])

  // Grouped once so each canopy gets a contiguous list and its instance
  // index matches its own array position.
  const bySpecies = useMemo(() => {
    const g = Object.fromEntries(SPECIES.map((s) => [s, []]))
    visibleTrees.forEach((t) => g[t.species].push(t))
    return g
  }, [visibleTrees])

  useEffect(() => {
    const mesh = trunkRef.current
    if (!mesh || count === 0) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    visibleTrees.forEach(({ x, z, scale, rotY, leanX, leanZ, trunkTint }, i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(leanX, rotY, leanZ)
      // Trunks thicken a little slower than the tree grows, so big trees
      // don't read as scaled-up saplings.
      dummy.scale.set(scale * 0.92, scale, scale * 0.92)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.set(TRUNK_COLORS[trunkTint % TRUNK_COLORS.length]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), 200)
  }, [visibleTrees, count, trunkGeo])

  return (
    <group>
      {/* Visual trunks — one instanced mesh for every species */}
      <instancedMesh
        key={`trunk-${count}`}
        ref={trunkRef}
        args={[trunkGeo, undefined, count]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>

      {/* Visual canopies — one instanced mesh per species */}
      {SPECIES.map((s) => (
        <Canopy key={s} species={s} trees={bySpecies[s]} />
      ))}

      {/* Physics trunks — one static cuboid collider per tree, all on a
          single fixed body. Trees never move, so this needs no per-frame
          transform sync (unlike InstancedRigidBodies, which is built for
          instances whose positions change and costs a JS↔WASM readback
          every frame for each instance even when nothing moves).

          Deliberately UNCHANGED from the pre-species version: same size,
          same position, and still independent of each tree's visual scale.
          Collision feel is gameplay, and the canopy rework is a visual
          change — bundling a physics change into it would make any
          regression impossible to attribute. */}
      <RigidBody type="fixed" colliders={false}>
        {visibleTrees.map(({ x, z }, i) => (
          <CuboidCollider key={i} args={[0.35, 1.75, 0.35]} position={[x, 1.75, z]} />
        ))}
      </RigidBody>
    </group>
  )
}
