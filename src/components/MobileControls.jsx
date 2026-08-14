import { useRef } from 'react'
import useGameStore from '../store/useGameStore'

// Mobile cockpit controls — landscape layout: steering wheel bottom-left,
// brake + accelerator pedals bottom-right, boost above the gas pedal
// (generous folio-scale touch targets — DESIGN.md §4).
//
// Data flow follows the project's two-path input convention:
//  - The wheel angle is ANALOG and changes every touchmove, so it bypasses
//    the Zustand store (Scene subscribes to `joystick` and would re-render
//    the whole 3D tree per move) and is written to window.__mobileSteer
//    (-1..1, +1 = full left), read per-frame by Vehicle.getInput() — same
//    pattern as __nosLevel/__carPosition.
//  - Pedals and boost are press/release booleans and go through
//    store.joystick like the old joystick did. The brake pedal maps to
//    `backward`: Vehicle already brakes to a stop first and only then
//    reverses, which is the correct two-pedal behavior.

const WHEEL_MAX_DEG = 110 // full lock each way → ±1.0 steer

function SteeringWheel() {
  const surfaceRef = useRef() // static touch surface — its rect never rotates
  const wheelRef   = useRef() // rotating visual
  const angleRef   = useRef(0)
  const grabRef    = useRef(null) // { id, lastDeg }

  const touchDeg = (t) => {
    const r = surfaceRef.current.getBoundingClientRect()
    // The rect center is the wheel's visual center even when the whole app
    // frame is CSS-rotated for forced landscape, and angle *deltas* are
    // rotation-invariant — so no coordinate transform is needed.
    return Math.atan2(
      t.clientY - (r.top + r.height / 2),
      t.clientX - (r.left + r.width / 2),
    ) * 180 / Math.PI
  }

  const setWheel = (deg) => {
    angleRef.current = Math.max(-WHEEL_MAX_DEG, Math.min(WHEEL_MAX_DEG, deg))
    if (wheelRef.current)
      wheelRef.current.style.transform = `rotate(${angleRef.current}deg)`
    // CSS-clockwise (wheel turned right) must steer right, and Vehicle
    // treats +1 as left — hence the negation.
    window.__mobileSteer = -angleRef.current / WHEEL_MAX_DEG
  }

  const onStart = (e) => {
    if (grabRef.current) return
    const t = e.changedTouches[0]
    grabRef.current = { id: t.identifier, lastDeg: touchDeg(t) }
    if (wheelRef.current) wheelRef.current.style.transition = 'none'
  }

  const onMove = (e) => {
    if (!grabRef.current) return
    for (const t of e.changedTouches) {
      if (t.identifier !== grabRef.current.id) continue
      const d = touchDeg(t)
      let delta = d - grabRef.current.lastDeg
      // shortest arc — crossing atan2's ±180° seam must not spin the wheel
      if (delta > 180)  delta -= 360
      if (delta < -180) delta += 360
      grabRef.current.lastDeg = d
      setWheel(angleRef.current + delta)
    }
  }

  const onEnd = (e) => {
    if (!grabRef.current) return
    for (const t of e.changedTouches) {
      if (t.identifier !== grabRef.current.id) continue
      grabRef.current  = null
      angleRef.current = 0
      window.__mobileSteer = 0
      if (wheelRef.current) {
        // return-to-center with a small overshoot (back.out — DESIGN.md §5)
        wheelRef.current.style.transition =
          'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
        wheelRef.current.style.transform = 'rotate(0deg)'
      }
    }
  }

  return (
    <div
      ref={surfaceRef}
      aria-label="Steering wheel"
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', zIndex: 40,
        left:   'clamp(14px, 4vmin, 36px)',
        bottom: 'clamp(12px, 3vmin, 32px)',
        width:  'clamp(124px, 38vmin, 200px)',
        height: 'clamp(124px, 38vmin, 200px)',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <div ref={wheelRef} style={{ width: '100%', height: '100%' }}>
        <svg
          viewBox="0 0 100 100" width="100%" height="100%"
          style={{ display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))' }}
        >
          <circle cx="50" cy="50" r="46" fill="rgba(8,4,0,0.35)" />
          {/* rim — dark outline under the amber stroke */}
          <circle cx="50" cy="50" r="42" fill="none"
            stroke="rgba(8,4,0,0.8)" strokeWidth="13" />
          <circle cx="50" cy="50" r="42" fill="none"
            stroke="rgba(240,192,96,0.85)" strokeWidth="9" />
          {/* spokes */}
          <g stroke="rgba(8,4,0,0.8)" strokeWidth="8" strokeLinecap="round">
            <line x1="50" y1="50" x2="50" y2="88" />
            <line x1="50" y1="50" x2="16" y2="30" />
            <line x1="50" y1="50" x2="84" y2="30" />
          </g>
          {/* hub */}
          <circle cx="50" cy="50" r="14" fill="rgba(8,4,0,0.85)"
            stroke="rgba(240,192,96,0.5)" strokeWidth="2" />
          {/* top marker so rotation reads at a glance */}
          <circle cx="50" cy="9" r="3.4" fill="#ffe0a0" />
        </svg>
      </div>
    </div>
  )
}

function Pedal({ label, sub, subSize = 20, color, style, onDown, onUp }) {
  const ref = useRef()
  const setPressed = (down) => {
    if (ref.current) {
      ref.current.style.transform  = down ? 'scale(0.93)' : 'scale(1)'
      ref.current.style.background = `${color}${down ? '48' : '22'}`
    }
  }
  return (
    <button
      ref={ref}
      onTouchStart={()  => { setPressed(true);  onDown() }}
      onTouchEnd={()    => { setPressed(false); onUp()   }}
      onTouchCancel={() => { setPressed(false); onUp()   }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        background: `${color}22`,
        border: `2px solid ${color}88`,
        borderRadius: 14,
        color,
        fontFamily: 'monospace', fontWeight: 700,
        fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        cursor: 'pointer', padding: 0,
        transition: 'transform 0.12s ease, background 0.12s ease',
        ...style,
      }}
    >
      <span style={{ fontSize: subSize, lineHeight: 1 }}>{sub}</span>
      <span>{label}</span>
    </button>
  )
}

export default function MobileControls() {
  const isMobile    = useGameStore((s) => s.isMobile)
  const setJoystick = useGameStore((s) => s.setJoystick)
  if (!isMobile) return null

  const hold = (key, v) => () => setJoystick((p) => ({ ...p, [key]: v }))

  return (
    <>
      {/* gradient scrim so controls read over any world color (DESIGN.md §4) */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: 150,
        zIndex: 39, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(13,5,0,0) 0%, rgba(13,5,0,0.42) 100%)',
      }} />

      <SteeringWheel />

      {/* pedal cluster — brake left of gas (real-car order), boost on top */}
      <div style={{
        position: 'fixed', zIndex: 40,
        right:  'clamp(14px, 4vmin, 36px)',
        bottom: 'clamp(12px, 3vmin, 32px)',
        display: 'flex', alignItems: 'flex-end',
        gap: 'clamp(10px, 2.5vmin, 16px)',
      }}>
        <Pedal
          label="Brake" sub="■" color="#f43f5e"
          style={{
            width:  'clamp(64px, 17vmin, 88px)',
            height: 'clamp(76px, 20vmin, 104px)',
          }}
          onDown={hold('backward', true)}
          onUp={hold('backward', false)}
        />
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 'clamp(10px, 2.5vmin, 14px)',
        }}>
          <Pedal
            label="" sub="⚡" subSize={16} color="#00d4ff"
            style={{
              width:  'clamp(44px, 12vmin, 56px)',
              height: 'clamp(44px, 12vmin, 56px)',
              borderRadius: '50%', gap: 0,
            }}
            onDown={hold('boost', true)}
            onUp={hold('boost', false)}
          />
          <Pedal
            label="Gas" sub="▲" color="#10b981"
            style={{
              width:  'clamp(68px, 18vmin, 92px)',
              height: 'clamp(96px, 26vmin, 128px)',
            }}
            onDown={hold('forward', true)}
            onUp={hold('forward', false)}
          />
        </div>
      </div>
    </>
  )
}
