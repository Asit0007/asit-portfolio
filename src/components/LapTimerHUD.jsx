import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'

function formatTime(ms) {
  if (ms == null) return '--:--.---'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const msPart = Math.floor(ms % 1000)
  return `${m}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`
}

export default function LapTimerHUD() {
  // Elapsed time changes every frame — polled from a window global (written
  // in Circuit.jsx's useFrame) rather than through Zustand, same reasoning
  // as NosHUD.jsx: routing a per-frame value through the store would cause
  // a re-render every frame.
  const [liveMs, setLiveMs] = useState(null)
  useEffect(() => {
    const id = setInterval(() => setLiveMs(window.__raceElapsedMs ?? null), 50)
    return () => clearInterval(id)
  }, [])

  const raceState   = useGameStore((s) => s.raceState)
  const lastLapTime = useGameStore((s) => s.lastLapTime)
  const bestLapTime  = useGameStore((s) => s.bestLapTime)

  if (raceState === 'idle' && bestLapTime == null) return null

  const isNewBest = raceState === 'finished' && lastLapTime != null && lastLapTime === bestLapTime

  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 30,
      fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)',
      background: 'rgba(8,4,0,0.75)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(240,180,80,0.18)', borderRadius: 10,
      padding: '8px 14px', pointerEvents: 'none', userSelect: 'none',
      minWidth: 140,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', opacity: 0.5, textTransform: 'uppercase' }}>
        {raceState === 'racing' ? 'LAP TIME' : raceState === 'finished' ? 'FINISHED' : 'BEST LAP'}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: raceState === 'racing' ? '#00d4ff' : isNewBest ? '#f59e0b' : 'rgba(255,255,255,0.85)',
      }}>
        {raceState === 'racing' ? formatTime(liveMs) : formatTime(raceState === 'finished' ? lastLapTime : bestLapTime)}
      </div>
      {raceState !== 'racing' && bestLapTime != null && (
        <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>
          {isNewBest ? '⚡ NEW BEST!' : `BEST ${formatTime(bestLapTime)}`}
        </div>
      )}
    </div>
  )
}
