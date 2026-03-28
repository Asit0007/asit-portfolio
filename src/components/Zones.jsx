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
]

function ZoneMarker({ id, position, radius, color, label }) {
  const ringRef = useRef()
  const activeZone = useGameStore((s) => s.activeZone)
  const isActive   = activeZone?.id === id

  useFrame((state) => {
    if (!ringRef.current) return
    const t = state.clock.elapsedTime
    ringRef.current.rotation.y = t * 0.35
    ringRef.current.material.opacity = isActive
      ? 0.55 + Math.sin(t * 4) * 0.2
      : 0.2 + Math.sin(t * 1.5) * 0.05
  })

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[radius - 1, radius, 36]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, 6, 0]}
        fontSize={1.3}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#000000"
      >
        {label}
      </Text>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.08, radius * 0.25, 14, 8, 1, true]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default function Zones({ vehicleRef }) {
  const setActiveZone = useGameStore((s) => s.setActiveZone)
  const lastZone      = useRef(null)

  const _vPos  = new THREE.Vector3()
  const _zPos  = new THREE.Vector3()

  useFrame(() => {
    if (!vehicleRef?.current) return
    try {
      const t = vehicleRef.current.translation()
      _vPos.set(t.x, 0, t.z)

      let inside = null
      for (const zone of ZONE_DEFS) {
        _zPos.set(zone.position[0], 0, zone.position[2])
        if (_vPos.distanceTo(_zPos) < zone.radius) {
          inside = zone.id
          break
        }
      }

      if (inside !== lastZone.current) {
        lastZone.current = inside
        setActiveZone(inside)
      }
    } catch (_) {}
  })

  return (
    <group>
      {ZONE_DEFS.map((zone) => (
        <ZoneMarker key={zone.id} {...zone} />
      ))}
    </group>
  )
}