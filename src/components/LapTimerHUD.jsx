import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'
import { fetchLeaderboard, submitScore } from '../utils/leaderboardApi'

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
  const pendingSubmit = useGameStore((s) => s.pendingLeaderboardSubmit)

  // null = offline/not-yet-loaded, [] = loaded but empty, array = entries
  const [leaderboard, setLeaderboard] = useState(null)
  const [nameInput, setNameInput]     = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard)
  }, [])

  const handleSubmit = async () => {
    const name = nameInput.trim().slice(0, 12)
    if (!name || submitting) return
    setSubmitting(true)
    const entries = await submitScore(name, pendingSubmit)
    if (entries) setLeaderboard(entries)
    setSubmitting(false)
    setNameInput('')
    useGameStore.setState({ pendingLeaderboardSubmit: null })
  }

  if (raceState === 'idle' && bestLapTime == null) return null

  const isNewBest = raceState === 'finished' && lastLapTime != null && lastLapTime === bestLapTime

  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 30,
      fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)',
      background: 'rgba(8,4,0,0.75)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(240,180,80,0.18)', borderRadius: 10,
      padding: '8px 14px', userSelect: 'none',
      minWidth: 140,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', opacity: 0.5, textTransform: 'uppercase', pointerEvents: 'none' }}>
        {raceState === 'racing' ? 'LAP TIME' : raceState === 'finished' ? 'FINISHED' : 'BEST LAP'}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700, pointerEvents: 'none',
        color: raceState === 'racing' ? '#00d4ff' : isNewBest ? '#f59e0b' : 'rgba(255,255,255,0.85)',
      }}>
        {raceState === 'racing' ? formatTime(liveMs) : formatTime(raceState === 'finished' ? lastLapTime : bestLapTime)}
      </div>
      {raceState !== 'racing' && bestLapTime != null && (
        <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2, pointerEvents: 'none' }}>
          {isNewBest ? '⚡ NEW BEST!' : `BEST ${formatTime(bestLapTime)}`}
        </div>
      )}

      {pendingSubmit != null && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(240,180,80,0.15)' }}>
          <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 4 }}>
            NEW RECORD — ADD TO LEADERBOARD?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.code === 'Enter') handleSubmit() }}
              placeholder="NAME"
              maxLength={12}
              autoFocus
              style={{
                width: 70, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(240,180,80,0.3)', borderRadius: 6,
                color: '#f0c060', fontFamily: 'monospace', fontSize: 11,
                padding: '3px 6px', outline: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !nameInput.trim()}
              style={{
                background: 'rgba(240,180,80,0.18)', border: '1px solid rgba(240,180,80,0.4)',
                borderRadius: 6, color: '#f0c060', fontFamily: 'monospace', fontSize: 10,
                padding: '3px 10px', cursor: 'pointer',
                opacity: submitting || !nameInput.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? '...' : 'SUBMIT'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(240,180,80,0.15)', pointerEvents: 'none' }}>
        <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 3 }}>LEADERBOARD</div>
        {leaderboard === null ? (
          <div style={{ fontSize: 10, opacity: 0.35 }}>OFFLINE</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ fontSize: 10, opacity: 0.35 }}>No times yet</div>
        ) : (
          leaderboard.slice(0, 3).map((entry, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, opacity: 0.7, marginTop: 1,
            }}>
              <span>{i + 1}. {entry.name}</span>
              <span style={{ color: '#f0c060' }}>{formatTime(entry.timeMs)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
