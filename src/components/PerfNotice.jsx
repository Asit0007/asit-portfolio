import { useEffect, useState } from 'react'

// What the visitor is told when the frame rate goes bad, and — more to the
// point — what they are OFFERED.
//
// The tempting message here is "things are slow, try refreshing". It is the
// wrong one. Refreshing does nothing about an integrated GPU, a 4K window, a
// laptop on battery saver, thermal throttling or the other twenty tabs, and
// those are what actually make this world stutter. The one thing a reload
// used to fix was a mis-measured quality tier, and the watchdog in
// usePerformance.js now repairs that by itself, without asking.
//
// So there are only two honest things left to say:
//
//   downgraded  the quality was just lowered. Worth a word, because the
//               world visibly thins out and an unexplained change looks
//               like a bug. Transient — it is information, not a request.
//   struggling  already at the simplest tier and still under 20 fps. There
//               is nothing left to turn down, so this one offers the escape
//               that genuinely helps: the plain resume, which is what a
//               recruiter on a weak laptop wanted in the first place.
//
// Never a modal, never blocking, always dismissible: the car keeps driving
// underneath it (DESIGN.md §8.1).
const PANEL = {
  position: 'fixed', top: 150, left: '50%', transform: 'translateX(-50%)',
  zIndex: 34,
  // The panel ignores the pointer so it can never eat a click meant for the
  // world; only the buttons inside it opt back in.
  pointerEvents: 'none',
  maxWidth: 'min(420px, calc(100vw - 32px))',
  background: 'rgba(8,4,0,0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(240,180,80,0.28)',
  borderRadius: 12,
  padding: '12px 16px',
  boxShadow: '0 0 30px rgba(0,0,0,0.35)',
  fontFamily: 'var(--font-mono)',
  animation: 'perfNoticeIn 0.35s ease-out',
}

const LABEL = {
  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(255,220,120,0.5)', marginBottom: 4,
}

const BODY = { fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,244,224,0.88)' }

const BTN = {
  pointerEvents: 'auto',
  fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
  letterSpacing: '0.06em',
  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
  background: 'rgba(240,192,96,0.18)',
  border: '1px solid rgba(240,192,96,0.4)',
  color: '#f0c060',
}

const GHOST = {
  ...BTN,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.5)',
}

export default function PerfNotice({ downgraded, struggling, onResume }) {
  // Dismissals are tracked per variant: waving away "quality reduced" must
  // not also silence the more important message that can follow it.
  const [hidDowngrade, setHidDowngrade] = useState(false)
  const [hidStruggle,  setHidStruggle]  = useState(false)

  const showStruggle = struggling && !hidStruggle
  const showDowngrade = downgraded && !hidDowngrade && !showStruggle

  // The downgrade note is informational, so it takes itself away. The
  // struggling one is a question waiting for an answer, so it stays.
  useEffect(() => {
    if (!showDowngrade) return
    const t = setTimeout(() => setHidDowngrade(true), 7000)
    return () => clearTimeout(t)
  }, [showDowngrade])

  if (!showStruggle && !showDowngrade) return null

  return (
    <div style={PANEL} role="status" aria-live="polite">
      <style>{`
        @keyframes perfNoticeIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {showStruggle ? (
        <>
          <div style={LABEL}>Performance</div>
          <div style={BODY}>
            This device is having a hard time with the 3D world, even at the
            lowest quality. The written version has everything — no graphics
            needed.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
            {/* Taking the offer counts as answering it. Without this the
                notice is waiting again the moment they come back from the
                resume, which turns one honest suggestion into nagging. */}
            <button style={BTN} onClick={() => { setHidStruggle(true); onResume() }}>
              VIEW RESUME
            </button>
            <button style={GHOST} onClick={() => setHidStruggle(true)}>KEEP DRIVING</button>
          </div>
        </>
      ) : (
        <>
          <div style={LABEL}>Performance</div>
          <div style={BODY}>
            Graphics quality lowered to keep things smooth.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button style={GHOST} onClick={() => setHidDowngrade(true)}>GOT IT</button>
          </div>
        </>
      )}
    </div>
  )
}
