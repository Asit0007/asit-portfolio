import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SAND_FLAT_HEX } from './EndlessDesert'
import { ASPHALT, ASPHALT_EDGE_SHADE, ASPHALT_WORN_SHADE } from '../data/track'
import { ROADS, ROAD_HALF, CIRCUS_R, roadRows } from '../data/roads'
import { ribbonGeometry } from '../utils/ribbon'
import { useThree } from '@react-three/fiber'
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

// Road paint. Warm sand-yellow edge lines and a brighter centre dash — the
// public-highway vocabulary, deliberately not the circuit's white kerb
// paint, so a road still reads as a road where the two cross.
const EDGE_LINE  = '#e8c878'
const DASH_PAINT = '#f0d060'

function GradientFloor() {
  // Was a 2x2 DataTexture (pure 4-corner gradient) — perfectly flat sand.
  // Now a 256x256 canvas baked once at mount: same warm corner gradient,
  // plus seeded soft blotches (sand variation) and a warm edge vignette so
  // the world reads as a diorama with a lit center, folio-style. Still one
  // texture on the same single ground draw call. Deliberately left in the
  // pre-color-managed brightness (no colorSpace tag) to keep the exact
  // saturated-orange look the old DataTexture rendered with.
  // The sand is viewed almost edge-on for most of the frame, which is the
  // exact case bilinear filtering handles worst — the far half of the plane
  // smears. Anisotropic filtering is a sampler setting, not another pass,
  // so it costs nothing per frame here.
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const texture = useMemo(() => {
    // 256 stretched over a 400-unit plane is 0.64 texels per world unit —
    // there was simply no detail to sample close up. 1024 is 4x that for
    // one 4 MB upload, still a single texture on the same one draw call.
    const S = 1024
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const ctx = canvas.getContext('2d')

    // 4-corner gradient via bilinear upscale of a 2x2 base
    const base = document.createElement('canvas')
    base.width = base.height = 2
    const bctx = base.getContext('2d')
    bctx.fillStyle = '#f5883c'; bctx.fillRect(0, 0, 1, 1)
    bctx.fillStyle = '#f9a34e'; bctx.fillRect(1, 0, 1, 1)
    bctx.fillStyle = '#e8702a'; bctx.fillRect(0, 1, 1, 1)
    bctx.fillStyle = '#fccf7a'; bctx.fillRect(1, 1, 1, 1)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(base, 0, 0, 2, 2, 0, 0, S, S)

    // Seeded soft blotches — deterministic so the ground never changes
    // between visits/renders (same reasoning as Trees' frozen positions)
    let seed = 42
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 70; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = (6 + rand() * 26) * (S / 256)
      const dark = rand() > 0.5
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, dark ? 'rgba(168,80,26,0.10)' : 'rgba(255,232,170,0.10)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // Warm vignette toward the world edges (never gray/black — DESIGN.md)
    const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.74)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(150,55,15,0.20)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, S, S)

    // ── Meeting the dunes ────────────────────────────────────────────────
    // Everything above was drawn for a world that ENDED at this plane: a lit
    // diorama with a darker, framed rim. It doesn't end any more
    // (EndlessDesert.jsx), and the rim became a join instead of an edge.
    //
    // Measured across it: at the middle of an edge the two surfaces already
    // agree to within 0.7 luma levels out of 255 — the dunes' flat tone and
    // this texture happen to land on the same colour there. At a CORNER the
    // step is 23 levels, because the 4-corner gradient above runs from
    // #e8702a to #fccf7a while the sand beyond is one fixed tone, so the
    // pale corner meets it with nothing in between and reads as a drawn
    // line. It is a corner problem, not an edge problem, which is why the
    // fade below is square rather than radial: a radial one would work the
    // corners and miss the edge midpoints, which is backwards.
    //
    // So the outer band ramps to exactly the colour the dunes start from.
    // Nothing the visitor drives on is inside it — the circuit's outermost
    // checkpoint is at 131 and the ramp starts at 150 — so the diorama still
    // reads everywhere it was meant to, and the last 50 units simply agree
    // with what is on the other side.
    const HALF      = 200   // the plane is 400 units across
    const RAMP_FROM = 150   // world units from the centre
    const sr = parseInt(SAND_FLAT_HEX.slice(1, 3), 16)
    const sg = parseInt(SAND_FLAT_HEX.slice(3, 5), 16)
    const sb = parseInt(SAND_FLAT_HEX.slice(5, 7), 16)
    const img = ctx.getImageData(0, 0, S, S)
    const px  = img.data
    for (let y = 0; y < S; y++) {
      const wy = Math.abs((y + 0.5) / S - 0.5) * 2 * HALF
      for (let x = 0; x < S; x++) {
        const wx = Math.abs((x + 0.5) / S - 0.5) * 2 * HALF
        // Chebyshev distance — the join is a square, so the fade is too.
        const d = wy > wx ? wy : wx
        if (d <= RAMP_FROM) continue
        const u = (d - RAMP_FROM) / (HALF - RAMP_FROM)
        const t = u * u * (3 - 2 * u)
        const i = (y * S + x) * 4
        px[i]     += (sr - px[i]) * t
        px[i + 1] += (sg - px[i + 1]) * t
        px[i + 2] += (sb - px[i + 2]) * t
      }
    }
    ctx.putImageData(img, 0, 0)

    const tex = new THREE.CanvasTexture(canvas)
    tex.anisotropy = maxAniso
    return tex
  }, [maxAniso])

  return (
    <RigidBody type="fixed" colliders={false} friction={1.2}>
      {/* Explicit thick slab instead of the auto "cuboid" collider generated
          from a paper-thin plane mesh — the vehicle's wheel raycasts need a
          collider with real vertical extent to hit reliably; a near-zero-
          thickness auto-collider was letting raycasts miss intermittently
          away from the (separately, more solidly collided) start zone pad. */}
      {/* Reaches far past the 400x400 visible plane. The boundary walls are
          gone (EndlessDesert.jsx), so a crate shoved over the old edge would
          otherwise fall forever — and the dune tiles only exist near the car,
          so they cannot be relied on to catch anything. A single oversized
          cuboid costs nothing and guarantees there is always a floor. */}
      <CuboidCollider args={[2000, 0.15, 2000]} position={[0, -0.15, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial map={texture} />
      </mesh>
    </RigidBody>
  )
}

function ZonePad({ position, size, color }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshLambertMaterial color={color} />
      </mesh>
    </RigidBody>
  )
}

function makePath(x1, z1, x2, z2, steps = 10) {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return [
      x1 + (x2 - x1) * t + (Math.random() - 0.5) * 2,
      z1 + (z2 - z1) * t + (Math.random() - 0.5) * 2,
    ]
  })
}

function TilePaths() {
  const toCloud    = useMemo(() => makePath(0,  8,  0,  -42, 14), [])
  const toProjects = useMemo(() => makePath(8,  0,  42,   0, 14), [])
  const toHobbies  = useMemo(() => makePath(-8, 0, -42,   0, 14), [])
  const toContact  = useMemo(() => makePath(0, -8,  0,   42, 14), [])
  const all = [...toCloud, ...toProjects, ...toHobbies, ...toContact]
  return (
    <group>
      {all.map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, (i * 1.3) % Math.PI]}
          position={[x, 0.04, z]}
        >
          <planeGeometry args={[3, 3]} />
          <meshLambertMaterial color="#f0e0c8" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

function Roads() {
  const { surface, markings } = useMemo(() => {
    const Y = 0.06
    const surfaces = []
    const marks = []

    // Asphalt, shaded across the width exactly as the circuit and the ramps
    // are — the worn middle and lighter edges come from track.js so a road
    // meeting the track does not change colour at the join.
    const roadProfile = [
      { o: -ROAD_HALF,        y: Y, shade: ASPHALT_EDGE_SHADE },
      { o: -ROAD_HALF * 0.45, y: Y, shade: ASPHALT_WORN_SHADE },
      { o:  ROAD_HALF * 0.45, y: Y, shade: ASPHALT_WORN_SHADE },
      { o:  ROAD_HALF,        y: Y, shade: ASPHALT_EDGE_SHADE },
    ]
    const edgeProfile = (side) => [
      { o: side * (ROAD_HALF - 0.55), y: Y + 0.006 },
      { o: side * (ROAD_HALF - 0.37), y: Y + 0.006 },
    ]

    for (const { points, trunk } of ROADS) {
      const rows = roadRows(points)
      surfaces.push(ribbonGeometry(rows, roadProfile, ASPHALT))
      for (const side of [-1, 1]) marks.push(ribbonGeometry(rows, edgeProfile(side), EDGE_LINE))
      if (!trunk) continue
      // Centre dashes: two rows per dash, stepped along the polyline.
      for (let i = 0; i + 1 < rows.length; i++) {
        const a = rows[i], b = rows[i + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        const n = Math.max(1, Math.round(len / 8))
        for (let k = 0; k < n; k++) {
          const t0 = (k + 0.15) / n, t1 = (k + 0.65) / n
          const at = (t) => ({
            x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: a.nx, nz: a.nz,
          })
          marks.push(ribbonGeometry([at(t0), at(t1)],
            [{ o: -0.13, y: Y + 0.012 }, { o: 0.13, y: Y + 0.012 }], DASH_PAINT))
        }
      }
    }

    // The circus: a paved disc at the crossroads with a painted rim. Drawn
    // as a disc rather than a ribbon because that is what it is — the thing
    // the radials leave from, and the ground the car spawns on.
    const disc = new THREE.CircleGeometry(CIRCUS_R, 64)
    disc.rotateX(-Math.PI / 2)
    disc.translate(0, Y + 0.002, 0)
    // mergeGeometries needs every input to carry the SAME attributes and
    // returns null when they don't — silently, so the whole group vanishes
    // and the console only complains later about a missing boundingSphere.
    // CircleGeometry ships a uv the ribbons have no use for.
    disc.deleteAttribute('uv')
    surfaces.push(colouredGeometry(disc, ASPHALT, ASPHALT_WORN_SHADE))

    const rim = []
    const STEPS = 64
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2
      rim.push({ x: Math.cos(a) * (CIRCUS_R - 1.1), z: Math.sin(a) * (CIRCUS_R - 1.1),
                 nx: Math.cos(a), nz: Math.sin(a) })
    }
    marks.push(ribbonGeometry(rim, [{ o: -0.14, y: Y + 0.014 }, { o: 0.14, y: Y + 0.014 }], EDGE_LINE))

    return { surface: mergeGeometries(surfaces), markings: mergeGeometries(marks) }
  }, [])

  useEffect(() => () => { surface.dispose(); markings.dispose() }, [surface, markings])

  return (
    <group>
      <mesh geometry={surface}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={markings}>
        <meshLambertMaterial vertexColors />
      </mesh>
    </group>
  )
}

// Flat vertex colour over a whole geometry — the disc has no profile to
// shade across, so it gets one tone rather than the ribbon treatment.
function colouredGeometry(geo, hex, shade = 1) {
  const c = new THREE.Color(hex)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r * shade; arr[i * 3 + 1] = c.g * shade; arr[i * 3 + 2] = c.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

// The world used to end in four invisible walls at +-160. It doesn't end
// any more — EndlessDesert.jsx grows dune tiles around the car for as long
// as anyone keeps driving — so there is nothing left to wall off. Hitting an
// invisible wall was the worst edge this world had.

// Hand-placed, so these do NOT go through isOnRoad() — check new entries
// against src/data/roads.js by hand.
export const SCATTER_DATA = [
  { x: -26, z: -28, sx: 1.2, sy: 0.8,  sz: 1.0, ry: 0.4  }, // clear of the x=-35 spur
  { x:  30, z: -22, sx: 0.9, sy: 1.2,  sz: 0.9, ry: 1.1  }, // clear of the ring road
  { x: -46, z:  36, sx: 1.4, sy: 0.7,  sz: 1.2, ry: 2.3  }, // clear of the ring road
  { x:  22, z:  30, sx: 1.0, sy: 1.0,  sz: 1.1, ry: 0.8  }, // inside the ring road
  { x: -62, z: -48, sx: 1.1, sy: 1.4,  sz: 0.8, ry: 1.6  },
  { x:  66, z:  38, sx: 0.8, sy: 0.9,  sz: 1.3, ry: 2.8  },
  { x: -10, z:  80, sx: 1.3, sy: 0.6,  sz: 1.0, ry: 0.2  }, // nudged clear of the big wraparound track (src/data/track.js)
  { x:  46, z: -55, sx: 0.7, sy: 1.1,  sz: 0.9, ry: 3.1  },
  { x: -95, z:  12, sx: 1.5, sy: 0.8,  sz: 1.2, ry: 1.9  }, // clear of the bowling branch
  { x:  22, z: -72, sx: 1.0, sy: 1.3,  sz: 0.7, ry: 0.6  },
  { x:  62, z: -16, sx: 0.9, sy: 0.7,  sz: 1.4, ry: 2.1  },
  { x: -16, z:  62, sx: 1.2, sy: 1.0,  sz: 0.8, ry: 1.4  },
  { x:  45, z:  70, sx: 0.8, sy: 1.2,  sz: 1.1, ry: 0.9  },
  { x: -68, z: -30, sx: 1.1, sy: 0.9,  sz: 0.9, ry: 2.5  },
  { x:  28, z:  58, sx: 1.4, sy: 0.7,  sz: 1.3, ry: 1.7  },
  { x: -50, z: -70, sx: 0.9, sy: 1.1,  sz: 1.0, ry: 3.0  },
]

function ScatterProps() {
  return (
    <group>
      {SCATTER_DATA.map((r, i) => (
        <RigidBody
          key={i}
          position={[r.x, r.sy * 0.5 + 0.1, r.z]}
          rotation={[0, r.ry, 0]}
          colliders="cuboid"
          // Damping at 0.8/0.8 killed all momentum within a metre, which
          // reads as weight even more than the mass does.
          mass={0.3}
          linearDamping={0.45}
          angularDamping={0.5}
          restitution={0.3}
          friction={0.8}
        >
          <mesh>
            <boxGeometry args={[r.sx, r.sy, r.sz]} />
            <meshLambertMaterial color="#ddd0b8" flatShading />
          </mesh>
        </RigidBody>
      ))}
    </group>
  )
}

export default function World() {
  return (
    <group>
      <GradientFloor />
      <Roads />
      <TilePaths />
      <ZonePad position={[0,   -0.58, -55]} size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[55,  -0.58,  0]}  size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[-55, -0.58,  0]}  size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[0,   -0.58,  0]}  size={[18, 1.2, 18]} color="#ffffff" />
      <ZonePad position={[0,   -0.58, 55]}  size={[30, 1.2, 30]} color="#f5e6e8" />
      <ScatterProps />
    </group>
  )
}