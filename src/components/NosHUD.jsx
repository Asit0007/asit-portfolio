import { useFrame } from '@react-three/fiber'
import { useState, useRef } from 'react'

export default function NosHUD() {
  const [nos, setNos]         = useState(100)
  const [boosting, setBoosting] = useState(false)
  const frameRef = useRef(0)

  useFrame(() => {
    // Poll every 3 frames — cheap
    frameRef.current++
    if (frameRef.current % 3 !== 0) return
    if (typeof window !== 'undefined') {
      setNos(Math.round(window.__nosLevel ?? 100))
      setBoosting(window.__isBoosting ?? false)
    }
  })

  const pct   = nos / 100
  const color = pct > 0.5 ? '#00d4ff' : pct > 0.25 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', bottom: 56, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4,
    }}>
      {/* BOOST label */}
      <div style={{
        fontFamily: 'monospace', fontSize: 9,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: boosting ? color : 'rgba(255,255,255,0.25)',
        transition: 'color 0.15s',
      }}>
        {boosting ? '⚡ BOOSTING' : 'SHIFT = BOOST'}
      </div>

      {/* NOS bar */}
      <div style={{
        width: 140, height: 5,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 99, overflow: 'hidden',
        border: `1px solid ${boosting ? color + '60' : 'rgba(255,255,255,0.1)'}`,
        transition: 'border-color 0.15s',
      }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          background: boosting
            ? `linear-gradient(90deg, ${color}88, ${color})`
            : `linear-gradient(90deg, ${color}55, ${color}99)`,
          borderRadius: 99,
          boxShadow: boosting ? `0 0 8px ${color}` : 'none',
          transition: 'width 0.1s, background 0.2s, box-shadow 0.2s',
        }} />
      </div>

      {/* Percentage */}
      <div style={{
        fontFamily: 'monospace', fontSize: 8,
        color: boosting ? color : 'rgba(255,255,255,0.2)',
        letterSpacing: '0.1em', transition: 'color 0.15s',
      }}>
        {nos}%
      </div>
    </div>
  )
}