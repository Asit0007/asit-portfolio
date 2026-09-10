import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'

// The desert past the built world has no edge any more (EndlessDesert.jsx),
// which is the point — but "no edge" and "no way back" are different things.
// Drive far enough and every direction looks the same, so this offers a lift
// home rather than leaving someone to guess which way the roads were.
//
// Passive and dismissible, never a modal: the car keeps driving underneath
// it (DESIGN.md §8.1). Dismissing it is permanent for the session — someone
// who wants to keep going into the sand has said so, and being asked again
// every minute would be nagging.
const FAR = 450          // world units from the origin
const NEAR_AGAIN = 260   // hysteresis, so it can't flicker on the threshold

export default function ReturnHome() {
  const [far, setFar] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Polled rather than subscribed: the car's position is a per-frame value
  // and lives on a window global for exactly that reason (see NosHUD and
  // LapTimerHUD, which poll for the same reason). Twice a second is plenty
  // for a threshold this coarse.
  useEffect(() => {
    const id = setInterval(() => {
      const p = window.__carPosition
      if (!p) return
      const d = Math.hypot(p.x, p.z)
      setFar((was) => (was ? d > NEAR_AGAIN : d > FAR))
    }, 500)
    return () => clearInterval(id)
  }, [])

  if (!far || dismissed) return null

  const goHome = () => {
    window.__resetCar = true
    // A lap in progress is void the moment the car is teleported — same
    // reasoning as the R key (App.jsx).
    useGameStore.getState().cancelRace()
    setDismissed(true)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 150, left: '50%', transform: 'translateX(-50%)',
        zIndex: 34, pointerEvents: 'none',
        maxWidth: 'min(380px, calc(100vw - 32px))',
        background: 'rgba(8,4,0,0.85)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(240,180,80,0.28)', borderRadius: 12,
        padding: '12px 16px', fontFamily: 'var(--font-mono)',
        boxShadow: '0 0 30px rgba(0,0,0,0.35)',
        animation: 'returnHomeIn 0.35s ease-out',
      }}
    >
      <style>{`
        @keyframes returnHomeIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,220,120,0.5)', marginBottom: 4,
      }}>
        Open desert
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,244,224,0.88)' }}>
        You&rsquo;re a long way out. The dunes go on for as far as you care to
        drive &mdash; but there&rsquo;s a ride back whenever you want one.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <button
          onClick={goHome}
          style={{
            pointerEvents: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(240,192,96,0.18)',
            border: '1px solid rgba(240,192,96,0.4)', color: '#f0c060',
          }}
        >
          DRIVE ME BACK
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            pointerEvents: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)',
          }}
        >
          KEEP GOING
        </button>
      </div>
    </div>
  )
}
