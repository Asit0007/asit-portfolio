import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { fetchWhispers, submitWhisper } from '../utils/whisperApi'
import { hasWhispered, markWhispered } from '../utils/whisperStorage'

const READ_RADIUS = 4 // folio uses 3; scaled slightly for this world

const _vPos = new THREE.Vector3()
const _wPos = new THREE.Vector3()

function WhisperMarker({ entry }) {
  const [near, setNear] = useState(false)
  const glowRef = useRef()

  useFrame((state) => {
    if (!glowRef.current) return
    const t = state.clock.elapsedTime
    glowRef.current.intensity = 1.2 + Math.sin(t * 3) * 0.4
  })

  useFrame(() => {
    const car = window.__carPosition
    if (!car) return
    _vPos.set(car.x, 0, car.z)
    _wPos.set(entry.x, 0, entry.z)
    const isNear = _vPos.distanceTo(_wPos) < READ_RADIUS
    setNear((prev) => (prev === isNear ? prev : isNear))
  })

  return (
    <group position={[entry.x, 0, entry.z]}>
      <pointLight ref={glowRef} position={[0, 1.2, 0]} distance={5} color="#ffb347" intensity={1.2} />
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[0.15, 0.5, 8]} />
        <meshStandardMaterial color="#ffb347" emissive="#ff8c1a" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1, 6]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      {near && (
        <group position={[0, 2.4, 0]}>
          <Text fontSize={0.4} color="#ffe0a0" anchorX="center" anchorY="middle"
            outlineWidth={0.03} outlineColor="#000" maxWidth={4}>
            "{entry.message}"
          </Text>
        </group>
      )}
    </group>
  )
}

// Mount inside <Canvas> — fetches + renders whisper markers, tracks the
// car's live position into a window global (same bridge pattern DevStats.jsx
// uses) so the outside-canvas WhisperInput below can read it on submit
// without needing the position to flow through props/store every frame.
export default function Whispers({ vehicleRef }) {
  const whispers = useGameStore((s) => s.whispers)

  useEffect(() => {
    fetchWhispers().then((entries) => {
      if (entries) useGameStore.setState({ whispers: entries })
    })
  }, [])

  useFrame(() => {
    if (!vehicleRef?.current) return
    try {
      const t = vehicleRef.current.translation()
      window.__carPosition = { x: t.x, z: t.z }
    } catch (_) {}
  })

  return (
    <group>
      {whispers.map((entry) => (
        <WhisperMarker key={entry.id} entry={entry} />
      ))}
    </group>
  )
}

// Mount outside <Canvas>, in plain App DOM (App.jsx) — the actual text
// input. Kept as a separate export in this same file rather than a new one,
// matching DevStats.jsx's in-canvas/outside-canvas split.
export function WhisperInput() {
  const open = useGameStore((s) => s.whisperInputOpen)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    if (open) setAlreadyDone(hasWhispered())
  }, [open])

  useEffect(() => {
    if (!open || !alreadyDone) return
    const t = setTimeout(() => useGameStore.getState().setWhisperInputOpen(false), 3000)
    return () => clearTimeout(t)
  }, [open, alreadyDone])

  if (!open) return null

  const close = () => {
    useGameStore.getState().setWhisperInputOpen(false)
    setMessage('')
  }

  const handleSubmit = async () => {
    const text = message.trim().slice(0, 30)
    if (!text || submitting) return
    setSubmitting(true)
    const pos = window.__carPosition || { x: 0, z: 0 }
    const entries = await submitWhisper(text, pos.x, pos.z)
    if (entries) {
      useGameStore.setState({ whispers: entries })
      markWhispered()
    }
    setSubmitting(false)
    close()
  }

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 35, fontFamily: 'var(--font-mono)',
      background: 'rgba(8,4,0,0.85)', backdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,179,71,0.35)', borderRadius: 12,
      padding: '10px 16px', color: '#ffe0a0',
    }}>
      {alreadyDone ? (
        <div style={{ fontSize: 11 }}>You've already left a comment in this world.</div>
      ) : (
        <>
          <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 6, letterSpacing: '0.1em' }}>
            LEAVE A COMMENT HERE (30 CHARS)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.code === 'Enter') handleSubmit()
                if (e.code === 'Escape') close()
              }}
              placeholder="Write a comment..."
              maxLength={30}
              autoFocus
              style={{
                width: 200, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,179,71,0.3)', borderRadius: 6,
                color: '#ffe0a0', fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '4px 8px', outline: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              style={{
                background: 'rgba(255,179,71,0.18)', border: '1px solid rgba(255,179,71,0.4)',
                borderRadius: 6, color: '#ffe0a0', fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '4px 12px', cursor: 'pointer',
                opacity: submitting || !message.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? '...' : 'POST'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
