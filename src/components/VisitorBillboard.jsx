import { useState, useEffect } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import { fetchVisitorCount, incrementVisitorCount } from '../utils/visitorApi'
import { hasCountedVisit, markCountedVisit } from '../utils/visitorStorage'

const REFRESH_MS = 60000 // so the number can visibly tick up during a session
// Off the 8-wide crossroads (x/z in [-4,4]) near spawn, same clearance
// reasoning used throughout this session for prop placement.
const POSITION = [8, 0, 8]

export default function VisitorBillboard() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = hasCountedVisit()
        ? await fetchVisitorCount()
        : await incrementVisitorCount()
      if (!cancelled && result != null) {
        setCount(result)
        markCountedVisit()
      }
    }
    load()
    const id = setInterval(async () => {
      const result = await fetchVisitorCount()
      if (!cancelled && result != null) setCount(result)
    }, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const display = count == null ? 'OFFLINE' : count.toLocaleString()

  return (
    <RigidBody type="fixed" position={POSITION}>
      <group>
        {/* Pole — same construction as SignPosts.jsx's ArrowSign */}
        <mesh castShadow position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.08, 0.10, 3.2, 6]} />
          <meshStandardMaterial color="#6B5020" roughness={0.8} />
        </mesh>

        {/* Board */}
        <mesh castShadow position={[0, 3.2, 0]}>
          <boxGeometry args={[3.2, 1.1, 0.15]} />
          <meshStandardMaterial color="#1a3a34" roughness={0.4} metalness={0.08} />
        </mesh>

        <Text position={[0, 3.5, 0.09]} fontSize={0.26} color="#32ffc1"
          anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          TOTAL VISITORS
        </Text>
        <Text position={[0, 3.05, 0.09]} fontSize={0.4} color="#ffffff"
          anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#000">
          {display}
        </Text>

        {/* Base */}
        <mesh receiveShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[0.35, 0.16, 0.35]} />
          <meshStandardMaterial color="#4a3a18" roughness={0.9} />
        </mesh>
      </group>
    </RigidBody>
  )
}
