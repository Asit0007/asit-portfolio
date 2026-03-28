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

// ── Fix: lip is now a plain mesh OUTSIDE RigidBody — purely visual ────────────
function ZonePad({ position, size, color }) {
  const lipY = position[1] + size[1] / 2 + 0.09
  return (
    <group>
      {/* Physics collider — only the main box, no lip */}
      <RigidBody type="fixed" colliders="cuboid" position={position}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
        </mesh>
      </RigidBody>

      {/* Visual lip — no physics, just decoration */}
      <mesh
        receiveShadow
        position={[position[0], lipY, position[2]]}
      >
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

function ScatterProps() {
  const items = useMemo(() => [
    [-32,-28], [42,-22], [-46,26], [32,42],
    [-62,-48], [66,38],  [-36,68], [52,-62],
    [-72,12],  [22,-72], [62,-16], [-16,62],
    [45, 70],  [-68,-30],[28, 58], [-50, -70],
  ].map(([x, z]) => ({
    x, z,
    sx: 0.8 + Math.random() * 1.6,
    sy: 0.6 + Math.random() * 1.2,
    sz: 0.7 + Math.random() * 1.4,
    ry: Math.random() * Math.PI,
  })), [])

  return (
    <group>
      {items.map((r, i) => (
        <mesh key={i} castShadow receiveShadow
          position={[r.x, r.sy * 0.4, r.z]}
          rotation={[0, r.ry, 0]}
        >
          <boxGeometry args={[r.sx, r.sy, r.sz]} />
          <meshStandardMaterial color="#ddd0b8" roughness={0.9} flatShading />
        </mesh>
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