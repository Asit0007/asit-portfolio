import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'

function GradientFloor() {
  // Was a 2x2 DataTexture (pure 4-corner gradient) — perfectly flat sand.
  // Now a 256x256 canvas baked once at mount: same warm corner gradient,
  // plus seeded soft blotches (sand variation) and a warm edge vignette so
  // the world reads as a diorama with a lit center, folio-style. Still one
  // texture on the same single ground draw call. Deliberately left in the
  // pre-color-managed brightness (no colorSpace tag) to keep the exact
  // saturated-orange look the old DataTexture rendered with.
  const texture = useMemo(() => {
    const S = 256
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
      const r = 6 + rand() * 26
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

    const tex = new THREE.CanvasTexture(canvas)
    tex.anisotropy = 4
    return tex
  }, [])

  return (
    <RigidBody type="fixed" colliders={false} friction={1.2}>
      {/* Explicit thick slab instead of the auto "cuboid" collider generated
          from a paper-thin plane mesh — the vehicle's wheel raycasts need a
          collider with real vertical extent to hit reliably; a near-zero-
          thickness auto-collider was letting raycasts miss intermittently
          away from the (separately, more solidly collided) start zone pad. */}
      <CuboidCollider args={[200, 0.15, 200]} position={[0, -0.15, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
    </RigidBody>
  )
}

function ZonePad({ position, size, color }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
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
          <meshStandardMaterial color="#f0e0c8" roughness={0.8}
            transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

function Roads() {
  const Y = 0.06
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, 0]}>
        <planeGeometry args={[8, 220]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, 0]}>
        <planeGeometry args={[220, 8]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}
        position={[0, Y + 0.001, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      {[-3.6, 3.6].map((x, i) => (
        <mesh key={`ns-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[x, Y + 0.005, 0]}>
          <planeGeometry args={[0.18, 220]} />
          <meshStandardMaterial color="#e8c878" roughness={0.8} />
        </mesh>
      ))}
      {[-3.6, 3.6].map((z, i) => (
        <mesh key={`ew-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[0, Y + 0.005, z]}>
          <planeGeometry args={[220, 0.18]} />
          <meshStandardMaterial color="#e8c878" roughness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={`dns-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[0, Y + 0.01, -100 + i * 8]}>
          <planeGeometry args={[0.25, 4]} />
          <meshStandardMaterial color="#f0d060" roughness={0.7} />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={`dew-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[-100 + i * 8, Y + 0.01, 0]}>
          <planeGeometry args={[4, 0.25]} />
          <meshStandardMaterial color="#f0d060" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Boundaries() {
  // Pushed out from ±100 to ±160 to make room for the racing circuit — the
  // big wraparound track (src/data/track.js) reaches x/z ≈±142 at its
  // widest, verified to stay clear of these walls with margin. The ground
  // plane is already 400x400 (half-extent 200), so there's plenty of
  // margin without touching any floor geometry.
  const walls = [
    { pos: [0,   3, -160], size: [340, 6, 2] },
    { pos: [0,   3,  160], size: [340, 6, 2] },
    { pos: [-160, 3,  0],  size: [2, 6, 340] },
    { pos: [160,  3,  0],  size: [2, 6, 340] },
  ]
  return (
    <>
      {walls.map(({ pos, size }, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid" position={pos}>
          <mesh>
            <boxGeometry args={size} />
            <meshStandardMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

const SCATTER_DATA = [
  { x: -32, z: -28, sx: 1.2, sy: 0.8,  sz: 1.0, ry: 0.4  },
  { x:  42, z: -22, sx: 0.9, sy: 1.2,  sz: 0.9, ry: 1.1  },
  { x: -46, z:  26, sx: 1.4, sy: 0.7,  sz: 1.2, ry: 2.3  },
  { x:  32, z:  42, sx: 1.0, sy: 1.0,  sz: 1.1, ry: 0.8  },
  { x: -62, z: -48, sx: 1.1, sy: 1.4,  sz: 0.8, ry: 1.6  },
  { x:  66, z:  38, sx: 0.8, sy: 0.9,  sz: 1.3, ry: 2.8  },
  { x: -10, z:  80, sx: 1.3, sy: 0.6,  sz: 1.0, ry: 0.2  }, // nudged clear of the big wraparound track (src/data/track.js)
  { x:  46, z: -55, sx: 0.7, sy: 1.1,  sz: 0.9, ry: 3.1  },
  { x: -72, z:  12, sx: 1.5, sy: 0.8,  sz: 1.2, ry: 1.9  },
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
          mass={0.6}
          linearDamping={0.8}
          angularDamping={0.8}
          restitution={0.3}
          friction={0.8}
        >
          <mesh>
            <boxGeometry args={[r.sx, r.sy, r.sz]} />
            <meshStandardMaterial color="#ddd0b8" roughness={0.9} flatShading />
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
      <Boundaries />
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