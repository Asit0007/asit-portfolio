import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useGameStore from '../store/useGameStore'

// The key light (and its shadow target) follow the car, so a tight 120x120
// ortho shadow frustum stays sharp everywhere on the 400x400 map instead of
// needing one giant blurry map covering the whole world. Offset direction is
// fixed — shadows always fall the same way, folio-style single-sun look.
const KEY_OFFSET = { x: 40, y: 60, z: -60 }

export default function Lights({ shadows = false, shadowMapSize = 1024 }) {
  const keyRef = useRef()
  const targetRef = useRef()

  useEffect(() => {
    if (keyRef.current && targetRef.current) {
      keyRef.current.target = targetRef.current
    }
  }, [])

  useFrame(() => {
    const key = keyRef.current
    const target = targetRef.current
    if (!key || !target) return
    const body = useGameStore.getState().vehicleBody
    if (!body) return
    try {
      const t = body.translation()
      target.position.set(t.x, 0, t.z)
      key.position.set(t.x + KEY_OFFSET.x, KEY_OFFSET.y, t.z + KEY_OFFSET.z)
    } catch (_) { /* body may be mid-teardown on reset */ }
  })

  return (
    <>
      {/* Warm fills keep shadowed areas amber, never gray (DESIGN.md §6) */}
      <ambientLight intensity={0.85} color="#ffe5b4" />
      <directionalLight
        ref={keyRef}
        position={[KEY_OFFSET.x, KEY_OFFSET.y, KEY_OFFSET.z]}
        intensity={2.2}
        color="#ffcc88"
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={10}
        shadow-camera-far={220}
        shadow-bias={-0.0002}
        shadow-normalBias={0.15}
      />
      <object3D ref={targetRef} />
      <directionalLight
        position={[-30, 20, 40]}
        intensity={0.45}
        color="#aaccff"
      />
      <hemisphereLight
        skyColor="#ffe0a0"
        groundColor="#c8640a"
        intensity={0.7}
      />
    </>
  )
}
