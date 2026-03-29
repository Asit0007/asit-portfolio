import { RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'

function GradientFloor() {
  const texture = useMemo(() => {
    const tl = new THREE.Color('#f5883c')
    const tr = new THREE.Color('#f9a34e')
    const br = new THREE.Color('#fccf7a')
    const bl = new THREE.Color('#e8702a')
    const data = new Uint8Array([
      Math.round(bl.r*255), Math.round(bl.g*255), Math.round(bl.b*255), 255,
      Math.round(br.r*255), Math.round(br.g*255), Math.round(br.b*255), 255,
      Math.round(tl.r*255), Math.round(tl.g*255), Math.round(tl.b*255), 255,
      Math.round(tr.r*255), Math.round(tr.g*255), Math.round(tr.b*255), 255,
    ])
    const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1.2}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
    </RigidBody>
  )
}

function ZonePad({ position, size, color }) {
  const lipY = position[1] + size[1] / 2 + 0.09
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={position}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
        </mesh>
      </RigidBody>
      <mesh receiveShadow position={[position[0], lipY, position[2]]}>
        <boxGeometry args={[size[0] + 0.5, 0.13, size[2] + 0.5]} />
        <meshStandardMaterial color="#e8d8c4" roughness={0.8} />
      </mesh>
    </group>
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
  const all = [...toCloud, ...toProjects, ...toHobbies]
  return (
    <group>
      {all.map(([x, z], i) => (
        <mesh key={i} receiveShadow
          rotation={[-Math.PI / 2, 0, (i * 1.3) % Math.PI]}
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
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, 0]}>
        <planeGeometry args={[8, 220]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, 0]}>
        <planeGeometry args={[220, 8]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}
        position={[0, Y + 0.001, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#4a4030" roughness={1} />
      </mesh>
      {[-3.6, 3.6].map((x, i) => (
        <mesh key={`ns-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]}
          position={[x, Y + 0.005, 0]}>
          <planeGeometry args={[0.18, 220]} />
          <meshStandardMaterial color="#e8c878" roughness={0.8} />
        </mesh>
      ))}
      {[-3.6, 3.6].map((z, i) => (
        <mesh key={`ew-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]}
          position={[0, Y + 0.005, z]}>
          <planeGeometry args={[220, 0.18]} />
          <meshStandardMaterial color="#e8c878" roughness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={`dns-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]}
          position={[0, Y + 0.01, -100 + i * 8]}>
          <planeGeometry args={[0.25, 4]} />
          <meshStandardMaterial color="#f0d060" roughness={0.7} />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={`dew-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]}
          position={[-100 + i * 8, Y + 0.01, 0]}>
          <planeGeometry args={[4, 0.25]} />
          <meshStandardMaterial color="#f0d060" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Boundaries() {
  const walls = [
    { pos: [0,   3, -100], size: [220, 6, 2] },
    { pos: [0,   3,  100], size: [220, 6, 2] },
    { pos: [-100, 3,  0],  size: [2, 6, 220] },
    { pos: [100,  3,  0],  size: [2, 6, 220] },
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

// ── ScatterProps — NOW WITH PHYSICS so car can bump them ─────────────────────
const SCATTER_DATA = [
  { x: -32, z: -28, sx: 1.2, sy: 0.8,  sz: 1.0, ry: 0.4  },
  { x:  42, z: -22, sx: 0.9, sy: 1.2,  sz: 0.9, ry: 1.1  },
  { x: -46, z:  26, sx: 1.4, sy: 0.7,  sz: 1.2, ry: 2.3  },
  { x:  32, z:  42, sx: 1.0, sy: 1.0,  sz: 1.1, ry: 0.8  },
  { x: -62, z: -48, sx: 1.1, sy: 1.4,  sz: 0.8, ry: 1.6  },
  { x:  66, z:  38, sx: 0.8, sy: 0.9,  sz: 1.3, ry: 2.8  },
  { x: -36, z:  68, sx: 1.3, sy: 0.6,  sz: 1.0, ry: 0.2  },
  { x:  52, z: -62, sx: 0.7, sy: 1.1,  sz: 0.9, ry: 3.1  },
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
        // Dynamic RigidBody — car can now push these!
        <RigidBody
          key={i}
          position={[r.x, r.sy * 0.5 + 0.1, r.z]}
          colliders="cuboid"
          mass={0.6}           // Light enough to scatter, heavy enough to feel solid
          linearDamping={0.8}  // Slow down quickly after being hit
          angularDamping={0.8}
          restitution={0.3}    // Small bounce
          friction={0.8}
        >
          <mesh castShadow receiveShadow rotation={[0, r.ry, 0]}>
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
      <ZonePad position={[0,   -0.6, -55]} size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[55,  -0.6,  0]}  size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[-55, -0.6,  0]}  size={[30, 1.2, 30]} color="#f5efe6" />
      <ZonePad position={[0,   -0.6,  0]}  size={[18, 1.2, 18]} color="#ffffff" />
      <ScatterProps />
    </group>
  )
}