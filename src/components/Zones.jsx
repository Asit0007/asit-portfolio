import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'

const ZONE_DEFS = [
  { id: 'start',    position: [0,   0,   0],  radius: 10, color: '#00d4ff', label: 'START'         },
  { id: 'cloud',    position: [0,   0, -55],  radius: 15, color: '#f59e0b', label: 'CLOUD & INFRA' },
  { id: 'projects', position: [55,  0,   0],  radius: 15, color: '#10b981', label: 'PROJECTS'      },
  { id: 'hobbies',  position: [-55, 0,   0],  radius: 13, color: '#a855f7', label: 'EASTER EGG'    },
  { id: 'contact',  position: [0,   0,  55],  radius: 14, color: '#f43f5e', label: 'CONTACT'       },
]

function ZoneMarker({ id, position, radius, color, label }) {
  const ringRef    = useRef()
  const activeZone = useGameStore((s) => s.activeZone)
  const isActive   = activeZone?.id === id

  useFrame((state) => {
    if (!ringRef.current) return
    const t = state.clock.elapsedTime
    ringRef.current.material.opacity = isActive
      ? 0.5 + Math.sin(t * 4) * 0.2
      : 0.14 + Math.sin(t * 1.2) * 0.04
  })

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[radius - 1.2, radius, 48]} />
        <meshStandardMaterial
          color={color} transparent opacity={0.16}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.48, 0]}>
        <circleGeometry args={[radius - 1.2, 48]} />
        <meshStandardMaterial
          color={color} transparent
          opacity={isActive ? 0.05 : 0.02} depthWrite={false}
        />
      </mesh>
      {isActive && (
        <Text
          position={[0, 7, 0]}
          fontSize={1.5}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#000"
        >
          {label}
        </Text>
      )}
    </group>
  )
}

export default function Zones({ vehicleRef }) {
  const setActiveZone = useGameStore((s) => s.setActiveZone)
  const lastZone      = useRef(null)
  const _vPos = new THREE.Vector3()
  const _zPos = new THREE.Vector3()

  useFrame(() => {
    if (!vehicleRef?.current) return
    try {
      const t = vehicleRef.current.translation()
      _vPos.set(t.x, 0, t.z)
      let inside = null
      for (const zone of ZONE_DEFS) {
        _zPos.set(zone.position[0], 0, zone.position[2])
        if (_vPos.distanceTo(_zPos) < zone.radius) { inside = zone.id; break }
      }
      if (inside !== lastZone.current) {
        lastZone.current = inside
        setActiveZone(inside)
      }
    } catch (_) {}
  })

  return (
    <group>
      {ZONE_DEFS.map((z) => <ZoneMarker key={z.id} {...z} />)}
    </group>
  )
}