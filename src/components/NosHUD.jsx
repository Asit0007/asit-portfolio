import { useState, useEffect } from 'react'

export default function NosHUD() {
  const [nos,      setNos]      = useState(100)
  const [boosting, setBoosting] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setNos(Math.round(window.__nosLevel ?? 100))
      setBoosting(window.__isBoosting ?? false)
    }, 80)
    return () => clearInterval(id)
  }, [])

  const pct   = nos / 100
  const color = pct > 0.5 ? '#00d4ff' : pct > 0.25 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 'clamp(7px, 1vw, 9px)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: boosting ? color : 'rgba(255,255,255,0.25)',
        transition: 'color 0.15s',
      }}>
        {boosting ? '⚡ BOOSTING' : 'SHIFT = BOOST'}
      </div>

      <div style={{
        width: 'clamp(100px, 15vw, 140px)',
        height: 5,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 99,
        overflow: 'hidden',
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
          transition: 'width 0.1s linear, background 0.2s, box-shadow 0.2s',
        }} />
      </div>

      <div style={{
        fontFamily: 'monospace',
        fontSize: 8,
        color: boosting ? color : 'rgba(255,255,255,0.2)',
        letterSpacing: '0.1em',
        transition: 'color 0.15s',
      }}>
        {nos}%
      </div>
    </div>
  )
}