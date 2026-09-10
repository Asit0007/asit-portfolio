import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, HeightfieldCollider } from '@react-three/rapier'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'

// ── Endless dunes ─────────────────────────────────────────────────────────
// Past the built world the map used to end in four invisible walls. Now it
// doesn't end: a grid of dune tiles follows the car, and tiles that fall
// behind are rebuilt ahead of it. Drive out far enough and the desert simply
// keeps going.
//
// The trick that makes this work is that the height of the sand is a pure
// FUNCTION OF WORLD POSITION, not per-tile random data. duneHeight(x, z)
// answers the same way no matter which tile is asking, so neighbouring
// tiles agree exactly along their shared edge and there is never a seam or
// a step — and a tile rebuilt after you drive back is identical to the one
// that was there before. No state to keep, nothing to stream.
//
// Nothing exists until the car goes looking for it: with the car anywhere
// in the built world this component renders and collides nothing at all, so
// the visitors who never drive to the edge pay nothing for it.

const TILE   = 150   // world units square
const CELLS  = 24    // 25x25 height samples -> 6.25-unit cells
const RING   = 1     // tiles kept either side of the car's own -> 3x3

// Where the built world stops. The ground plane and its collider are
// 400x400 (World.jsx), so measuring on the square rather than a radius is
// what actually matches the edge the dunes have to meet.
const FLAT_EDGE = 200
const TAPER     = 60    // sand rises from flat to full over this distance

// Kept gentle on purpose. At 4.5 units over a 110-unit wavelength the
// steepest face is about 11 degrees, with the second octave adding another
// 9 — comfortably drivable, and a crest taken at boost throws the car
// exactly like the ramps do.
const DUNE_HEIGHT = 4.5
const WAVE_LONG   = 110
const WAVE_SHORT  = 45

const STONES_PER_TILE = 24

// ── Height field ──────────────────────────────────────────────────────────
function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// Smooth value noise in 0..1 — smooth, unlike the gravel beds' white noise,
// because a dune is a landform and white noise is a rasp.
function valueNoise(x, z, wavelength) {
  const fx = x / wavelength, fz = z / wavelength
  const ix = Math.floor(fx), iz = Math.floor(fz)
  const tx = fx - ix, tz = fz - iz
  const ux = tx * tx * (3 - 2 * tx), uz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz),     b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1)
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz
}

// Always >= 0, so the sand can never dip below the flat ground it meets,
// and tapered to exactly 0 at the edge of the built world so the join is
// seamless rather than a kerb.
export function duneHeight(x, z) {
  const edge = Math.max(Math.abs(x), Math.abs(z))
  if (edge <= FLAT_EDGE) return 0
  const t = Math.min((edge - FLAT_EDGE) / TAPER, 1)
  const fade = t * t * (3 - 2 * t)
  const n = valueNoise(x, z, WAVE_LONG) * 0.75 + valueNoise(x, z, WAVE_SHORT) * 0.25
  return n * DUNE_HEIGHT * fade
}

// ── One tile ──────────────────────────────────────────────────────────────
function buildTile(tx, tz) {
  const originX = tx * TILE, originZ = tz * TILE
  const n = CELLS + 1
  const step = TILE / CELLS

  // Heights sampled on the tile's own grid. Rapier's heightfield spans
  // [-scale/2, +scale/2] on both axes, so sample from the tile's corner.
  const heights = new Array(n * n)
  let peak = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const h = duneHeight(originX - TILE / 2 + i * step, originZ - TILE / 2 + j * step)
      heights[i * n + j] = h
      if (h > peak) peak = h
    }
  }

  // Visual mesh on exactly the same samples, so what the wheels find and
  // what the eye sees are the same surface by construction.
  const geo = new THREE.PlaneGeometry(TILE, TILE, CELLS, CELLS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let v = 0; v < pos.count; v++) {
    pos.setY(v, duneHeight(originX + pos.getX(v), originZ + pos.getZ(v)))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  // Stones, sitting on the surface. Deterministic from the tile index for
  // the same reason the heights are: a revisited tile looks identical.
  const stones = []
  for (let s = 0; s < STONES_PER_TILE; s++) {
    const rx = hash2(tx * 7919 + s, tz * 6271)
    const rz = hash2(tx * 5417, tz * 4093 + s)
    const rs = hash2(tx * 3271 + s, tz * 2749 + s)
    const x = originX - TILE / 2 + rx * TILE
    const z = originZ - TILE / 2 + rz * TILE
    if (duneHeight(x, z) <= 0) continue      // nothing inside the built world
    stones.push({ x, z, y: duneHeight(x, z), s: 0.18 + rs * 0.5, r: rs * Math.PI * 2 })
  }

  return { key: `${tx}:${tz}`, tx, tz, originX, originZ, heights, geo, stones, peak }
}

const STONE_GEO = new THREE.OctahedronGeometry(1, 0)

function Tile({ tile }) {
  const stoneRef = useRef()

  useEffect(() => () => tile.geo.dispose(), [tile])

  useEffect(() => {
    const mesh = stoneRef.current
    if (!mesh || tile.stones.length === 0) return
    const dummy = new THREE.Object3D()
    tile.stones.forEach(({ x, y, z, s, r }, i) => {
      dummy.position.set(x, y + s * 0.35, z)
      dummy.rotation.set(0, r, 0)
      dummy.scale.set(s, s * 0.55, s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [tile])

  return (
    <group>
      <mesh geometry={tile.geo} position={[tile.originX, 0, tile.originZ]} frustumCulled={false}>
        {/* Same sand family as the ground plane, and Lambert like every
            other large surface (see the PBR pass) — nothing out here is
            glossy. polygonOffset keeps the tapered-to-zero inner edge from
            z-fighting the flat floor it lies on top of. */}
        <meshLambertMaterial
          color="#ee8f42"
          flatShading
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {tile.stones.length > 0 && (
        <instancedMesh
          ref={stoneRef}
          args={[STONE_GEO, undefined, tile.stones.length]}
          frustumCulled={false}
        >
          <meshLambertMaterial color="#c2a483" flatShading />
        </instancedMesh>
      )}

      {/* Only worth a collider if there is actually relief here — a tile
          still fully inside the built world is flat, and the ground plane
          already covers it. */}
      {tile.peak > 0.01 && (
        <RigidBody type="fixed" colliders={false}>
          <HeightfieldCollider
            args={[CELLS, CELLS, tile.heights, { x: TILE, y: 1, z: TILE }]}
            position={[tile.originX, 0, tile.originZ]}
            friction={1.1}
          />
        </RigidBody>
      )}
    </group>
  )
}

export default function EndlessDesert() {
  const [tiles, setTiles] = useState([])
  const centre = useRef(null)

  useFrame(() => {
    const body = useGameStore.getState().vehicleBody
    if (!body) return
    const p = body.translation()

    // Nothing at all until the car is near the edge of the built world.
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < FLAT_EDGE - TILE) {
      if (centre.current !== null) { centre.current = null; setTiles([]) }
      return
    }

    const tx = Math.round(p.x / TILE)
    const tz = Math.round(p.z / TILE)
    if (centre.current && centre.current.tx === tx && centre.current.tz === tz) return
    centre.current = { tx, tz }

    // Rebuild the ring, reusing any tile that is still in range so crossing
    // a boundary only costs the tiles that actually changed.
    setTiles((prev) => {
      const keep = new Map(prev.map((t) => [t.key, t]))
      const next = []
      for (let i = -RING; i <= RING; i++) {
        for (let j = -RING; j <= RING; j++) {
          const k = `${tx + i}:${tz + j}`
          next.push(keep.get(k) || buildTile(tx + i, tz + j))
          keep.delete(k)
        }
      }
      keep.forEach((t) => t.geo.dispose())
      return next
    })
  })

  return <group>{tiles.map((t) => <Tile key={t.key} tile={t} />)}</group>
}
