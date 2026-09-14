import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'

// Offered when the car can't drive itself out — beached on a crate with the
// wheels in the air, wedged against a rock, or simply on its roof. The
// detection lives in Vehicle.jsx (see STUCK_SPEED / STUCK_UPRIGHT there);
// this is only the offer.
//
// Passive and dismissible, never a modal, exactly like ReturnHome.jsx — the
// car keeps driving underneath it (DESIGN.md §8.1). That matters more here
// than it does out in the desert: the visitor is already frustrated, and a
// dialog that steals the keyboard the moment they are wrestling with the
// controls would be the worst possible time to take them away.
//
// The delay before offering is the whole design. Too eager and it appears
// every time someone noses into a kerb or pushes a crate, which reads as the
// game calling you a bad driver; too slow and they have already given up.
const STUCK_MS = 2600
// A dismissal is worth a breather, not the rest of the session — unlike
// ReturnHome, where "keep going" means a deliberate choice to stay out in
// the sand. Someone who waves this away and is still stuck a few seconds
// later does want the help after all.
const SNOOZE_MS = 12000

export default function StuckPrompt() {
  const [visible, setVisible] = useState(false)
  const [snoozedUntil, setSnoozedUntil] = useState(0)

  // Polled rather than subscribed: __stuckSince is a per-frame value on a
  // window global for exactly that reason (same as ReturnHome and NosHUD).
  useEffect(() => {
    const id = setInterval(() => {
      const since = window.__stuckSince || 0
      const stuckFor = since ? performance.now() - since : 0
      setVisible(stuckFor > STUCK_MS && performance.now() > snoozedUntil)
    }, 300)
    return () => clearInterval(id)
  }, [snoozedUntil])

  if (!visible) return null

  const clearStuck = () => {
    window.__stuckSince = 0
    setVisible(false)
  }

  // Upright in place: keeps everything the visitor drove to get here. This
  // is the one that should be reached for first, which is why it leads.
  const standUp = () => {
    window.__uprightCar = true
    clearStuck()
  }

  // Full reset. A lap in progress is void the moment the car is teleported —
  // same reasoning as the R key (App.jsx) and ReturnHome.
  const goStart = () => {
    window.__resetCar = true
    useGameStore.getState().cancelRace()
    clearStuck()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 150, left: '50%', transform: 'translateX(-50%)',
        zIndex: 34, pointerEvents: 'none',
        maxWidth: 'min(400px, calc(100vw - 32px))',
        background: 'rgba(8,4,0,0.85)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(240,180,80,0.28)', borderRadius: 12,
        padding: '12px 16px', fontFamily: 'var(--font-mono)',
        boxShadow: '0 0 30px rgba(0,0,0,0.35)',
        animation: 'stuckIn 0.35s ease-out',
      }}
    >
      <style>{`
        @keyframes stuckIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,220,120,0.5)', marginBottom: 4,
      }}>
        Stuck?
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,244,224,0.88)' }}>
        Looks like the wheels aren&rsquo;t getting you anywhere. Stand the car
        back up where it is, or start again from the crossroads.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <button
          onClick={standUp}
          style={{
            pointerEvents: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(240,192,96,0.18)',
            border: '1px solid rgba(240,192,96,0.4)', color: '#f0c060',
          }}
        >
          STAND ME UP
        </button>
        <button
          onClick={goStart}
          style={{
            pointerEvents: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(240,192,96,0.28)', color: 'rgba(240,192,96,0.75)',
          }}
        >
          BACK TO START
        </button>
        <button
          onClick={() => { setSnoozedUntil(performance.now() + SNOOZE_MS); setVisible(false) }}
          style={{
            pointerEvents: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.5)',
          }}
        >
          I&rsquo;M FINE
        </button>
      </div>
    </div>
  )
}
