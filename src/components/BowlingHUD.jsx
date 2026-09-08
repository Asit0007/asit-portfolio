import { useState } from 'react'
import useGameStore from '../store/useGameStore'

// The prompt raised by the lane's reset pad. It appears only while the car
// is actually sitting on the pad (Bowling.jsx writes the flag), and pressing
// Enter — handled in App.jsx alongside the other global hotkeys, so it
// inherits the typing guard — stands the pins back up and returns the ball.
//
// Enter alone would strand mobile, which has no keyboard (DESIGN.md §8.4),
// so the panel is also a real button: tap it and it does the same thing.
// It reaches the reset through window.__resetBowling, published by
// Bowling.jsx, because this lives outside the Canvas and can't hold a ref
// into the R3F tree — the same bridge pattern as window.__resetCar.
export default function BowlingHUD() {
  const armed    = useGameStore((s) => s.bowlingResetPrompt)
  const isMobile = useGameStore((s) => s.isMobile)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  if (!armed) return null

  const reset = () => {
    if (typeof window.__resetBowling === 'function') window.__resetBowling()
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 104,          // clears the NOS gauge (56) and the hint bar
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={reset}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => { setHovered(false); setPressed(false) }}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 46,
          padding: '10px 20px',
          borderRadius: 12,
          border: '1px solid rgba(196,21,74,0.45)',
          background: hovered ? 'rgba(196,21,74,0.30)' : 'rgba(8,4,0,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#ffe0a0',
          font: '600 13px/1 var(--font-mono)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'background 0.3s ease-out, transform 0.12s ease-out',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span>
        {isMobile ? (
          <span>Tap to reset pins &amp; ball</span>
        ) : (
          <>
            <span style={{ opacity: 0.75 }}>Press</span>
            {/* Key cap — the affordance is the key, so it should look like one */}
            <kbd
              style={{
                display: 'inline-block',
                padding: '3px 9px',
                borderRadius: 5,
                border: '1px solid rgba(255,224,160,0.45)',
                background: 'rgba(255,224,160,0.12)',
                color: '#fff',
                font: '700 12px/1 var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              Enter
            </kbd>
            <span style={{ opacity: 0.75 }}>to reset pins &amp; ball</span>
          </>
        )}
      </button>
    </div>
  )
}
