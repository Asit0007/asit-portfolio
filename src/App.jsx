import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import ZoneOverlay    from './components/ZoneOverlay'
import MapOverlay     from './components/MapOverlay'
import MobileControls from './components/MobileControls'
import StartScreen    from './components/StartScreen'
import NosHUD         from './components/NosHUD'
import LapTimerHUD    from './components/LapTimerHUD'
import AchievementSystem from './components/AchievementSystem'
import MusicPlayer    from './components/MusicPlayer'
import useGameStore   from './store/useGameStore'
import { keyMap }     from './Controls'
import { toggleMusic } from './audio'
import { usePerformanceTier, TIER_CONFIG } from './hooks/usePerformance'
import { RendererInfoOverlay } from './components/DevStats'
import BowlingHUD from './components/BowlingHUD'
import PerfNotice from './components/PerfNotice'
import ReturnHome from './components/ReturnHome'
import { WhisperInput } from './components/Whispers'

// Scene is the only import path to @react-three/rapier and the world
// components, so lazy-loading it keeps the ~2 MB rapier chunk out of the
// initial bundle: the start screen paints immediately and the world
// streams in behind it (the chunk starts fetching at mount, not on START).
const Scene = lazy(() => import('./components/Scene'))

function handleContextLost(e) {
  e.preventDefault()
  const el = document.getElementById('context-lost-msg')
  if (el) el.style.display = 'flex'
}

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: '#0d0500',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 'clamp(12px, 3vh, 24px)',
      padding: '16px',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'clamp(14px, 3.5vw, 26px)',
        fontWeight: 900,
        letterSpacing: '0.22em',
        color: '#f0c060',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        ASIT MINZ
      </p>
      <p style={{
        color: 'rgba(255,255,255,0.35)',
        fontSize: 'clamp(10px, 1.5vw, 13px)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'center',
      }}>
        Loading world...
      </p>
      <div style={{
        width: 'min(200px, 50vw)', height: 2,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#f0c060',
          borderRadius: 99, width: '55%',
          animation: 'ldpulse 1.4s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes ldpulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

// Forced-landscape frame for mobile portrait. Instead of the unreliable
// screen.orientation.lock() (fullscreen-only on Android, unavailable on iOS
// Safari), the whole app is wrapped in a CSS-rotated frame sized
// 100dvh × 100dvw. The frame's transform makes it the containing block for
// every position:fixed overlay inside, so all existing UI lays itself out in
// the rotated space with no per-component changes.
//
// Stages: 'pre' paints one unrotated frame so the rotate(0)→rotate(90)
// transition can run — the visible "screen flips to horizontal" intro
// (cinematic tier, DESIGN.md §5) — then 'settled' drops the transition so a
// later physical device rotation snaps like a native re-layout.
function useForcedLandscape(isMobile) {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(orientation: portrait)').matches
      : false
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(orientation: portrait)')
    const onChange = (e) => setPortrait(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const forced = isMobile && portrait
  const [stage, setStage] = useState('off') // off | pre | flipping | settled
  useEffect(() => {
    if (!forced) { setStage('off'); return }
    setStage('pre')
    const t1 = setTimeout(() => setStage('flipping'), 80)
    const t2 = setTimeout(() => setStage('settled'), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [forced])

  return { forced, stage }
}

function useTitleAnimation(vehicleBody) {
  useEffect(() => {
    if (!vehicleBody) return
    let last = ''
    const id = setInterval(() => {
      try {
        const lv    = vehicleBody.linvel()
        const speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z)
        const boost = window.__isBoosting
        const title =
          boost      ? '🔥 Asit Minz | Portfolio' :
          speed > 15 ? '💨 Asit Minz | Portfolio' :
          speed > 1  ? '🚗 Asit Minz | Portfolio' :
                       'Asit Minz | Portfolio'
        if (title !== last) { document.title = last = title }
      } catch (_) {}
    }, 500)
    return () => clearInterval(id)
  }, [vehicleBody])
}

export default function App() {
  const isMobile    = useGameStore((s) => s.isMobile)
  const vehicleBody = useGameStore((s) => s.vehicleBody)
  const gameStarted = useGameStore((s) => s.gameStarted)
  const vehicleRef  = useRef()
  const { forced, stage } = useForcedLandscape(isMobile)

  if (vehicleBody) vehicleRef.current = vehicleBody
  useTitleAnimation(vehicleBody)

  // `antialias`/`powerPreference` are WebGL context attributes — fixed at
  // Canvas mount, so they're decided from the synchronous device check
  // rather than the async FPS-measured tier (which resolves ~1.5s later
  // and can only affect props that update reactively post-mount).
  // The tier is no longer decided once and lived with — usePerformance keeps
  // sampling and steps it down if this machine can't hold the frame rate,
  // which is the actual repair for a stuttering visit. `downgraded` and
  // `struggling` are what PerfNotice reports to the visitor.
  const { tier: perfTier, downgraded, struggling } = usePerformanceTier(gameStarted)
  const tierCfg  = TIER_CONFIG[perfTier ?? 1]
  const showResume    = useGameStore((s) => s.showResume)
  const setShowResume = useGameStore((s) => s.setShowResume)

  useEffect(() => {
    let cleanup = () => {}
    const attach = () => {
      const canvas = document.querySelector('canvas')
      if (canvas) {
        canvas.addEventListener('webglcontextlost', handleContextLost)
        cleanup = () => canvas.removeEventListener('webglcontextlost', handleContextLost)
      } else {
        const t = setTimeout(attach, 200)
        cleanup = () => clearTimeout(t)
      }
    }
    attach()
    return () => cleanup()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      // Ignore game hotkeys while the user is typing in any text field
      // (comment input, leaderboard name input) — otherwise R resets the
      // car and C re-opens the comment box mid-sentence.
      const el = e.target
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      // R has always teleported the car home; it now voids a lap in
      // progress too. Resetting mid-lap and having the clock keep running
      // is the opposite of what "reset" means, and the timer would go on
      // measuring an attempt the visitor had already abandoned.
      if (e.code === 'KeyR') {
        window.__resetCar = true
        useGameStore.getState().cancelRace()
      }
      if (e.code === 'KeyM') toggleMusic()
      if (e.code === 'KeyC') useGameStore.getState().setWhisperInputOpen(true)
      // Only while the car is parked on the bowling lane's reset pad, so
      // Enter stays free everywhere else in the world. The typing guard
      // above already keeps this off the leaderboard-name and comment
      // fields, where Enter means submit.
      if (e.code === 'Enter' && useGameStore.getState().bowlingResetPrompt) {
        e.preventDefault()
        if (typeof window.__resetBowling === 'function') window.__resetBowling()
      }
      if (e.code === 'Tab') {
        e.preventDefault()
        document.getElementById('map-btn')?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const frameClass =
    'app-frame' +
    (forced ? ' forced-landscape' : '') +
    (stage === 'pre' ? ' flip-pre' : '') +
    (stage === 'pre' || stage === 'flipping' ? ' flip-anim' : '')

  return (
    <div className={frameClass}>
      {/* Global responsive styles */}
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root {
          width: 100%; height: 100%;
          margin: 0; padding: 0;
          overflow: hidden;
          background: #0d0500;
        }
        /* Vertical viewport fix for mobile browsers with address bar */
        #root {
          height: 100dvh;
          min-height: -webkit-fill-available;
        }
        .app-frame { position: fixed; inset: 0; }
        /* Mobile portrait → rotate the whole app into landscape. The frame
           is sized to the rotated viewport (100dvh wide, 100dvw tall) and
           swung into place around the top-left corner. */
        .app-frame.forced-landscape {
          inset: auto;
          top: 0; left: 0;
          width: 100vh;  height: 100vw;   /* fallback */
          width: 100dvh; height: 100dvw;
          transform-origin: top left;
          transform: rotate(90deg) translateY(-100%);
          overflow: hidden;
          background: #0d0500;
        }
        .app-frame.forced-landscape.flip-pre {
          transform: rotate(0deg) translateY(0%);
        }
        .app-frame.forced-landscape.flip-anim {
          transition: transform 0.9s cubic-bezier(0.45, 0, 0.55, 1);
        }
        @media (max-width: 640px) {
          .hud-full { display: none !important; }
          .hud-short { display: inline !important; }
        }
        @media (max-height: 500px) {
          .nos-hud { bottom: 44px !important; }
          .hud-bar { bottom: 6px !important; padding: 4px 12px !important; }
        }
      `}</style>

      {/* Context lost overlay */}
      <div id="context-lost-msg" style={{
        display: 'none', position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.92)', color: 'white',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16,
      }}>
        <p style={{ fontSize: 20, fontWeight: 700 }}>⚠️ Graphics context lost</p>
        <button onClick={() => window.location.reload()} style={{
          padding: '10px 28px', background: '#f0c060', color: '#1a0a00',
          borderRadius: 8, fontWeight: 700, border: 'none',
          cursor: 'pointer', fontSize: 15,
        }}>
          Reload
        </button>
      </div>

      {/* A11y */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0 }}
        aria-label="Asit Minz portfolio">
        <h1>Asit Minz — Infrastructure & Cloud Engineer, Bangalore</h1>
      </div>

      {/* 3D Canvas — always mounted, but idle until gameStarted */}
      <div style={{ position: 'fixed', inset: 0 }}>
        <Suspense fallback={<LoadingScreen />}>
          <KeyboardControls map={keyMap}>
            <Canvas
              camera={{ fov: 50, near: 0.1, far: 600, position: [8, 18, 20] }}
              // offsetSize measures the container's layout size instead of
              // getBoundingClientRect — required under the forced-landscape
              // CSS rotation, where the bounding rect is the portrait
              // viewport and the canvas would otherwise render a portrait
              // strip. Pointer picking stays correct too: R3F divides
              // offsetX/offsetY (local, untransformed coords) by this size.
              resize={{ offsetSize: true }}
              // 'demand' until the game starts: the Canvas stays mounted so
              // assets keep streaming and the scene is warm on reveal, but it
              // stops re-rendering a world nobody can see behind StartScreen.
              // Also drops back to 'demand' behind the written portfolio.
              // Someone reading the resume because the 3D was too slow for
              // their machine should not still be paying for the 3D.
              frameloop={gameStarted && !showResume ? 'always' : 'demand'}
              gl={{
                antialias: !isMobile,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={[tierCfg.dpr[0], Math.min(tierCfg.dpr[1], window.devicePixelRatio)]}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Boundary inside the Canvas: catches both the lazy chunk
                  and rapier's WASM init without unmounting the Canvas.
                  Empty canvas during load is invisible behind StartScreen. */}
              <Suspense fallback={null}>
                <Scene tierCfg={tierCfg} />
              </Suspense>
            </Canvas>
          </KeyboardControls>
        </Suspense>
      </div>

      <RendererInfoOverlay />

      {/* Game overlays — only when active */}
      {gameStarted && (
        <>
          <ZoneOverlay />
          <LapTimerHUD />
          <AchievementSystem />
          <WhisperInput />
          {!showResume && <ReturnHome />}
          {!showResume && (
            <PerfNotice
              downgraded={downgraded}
              struggling={struggling}
              onResume={() => setShowResume(true)}
            />
          )}

          {/* NOS gauge */}
          <div className="nos-hud" style={{ position: 'fixed', bottom: 56, left: '50%',
            transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none' }}>
            <NosHUD />
          </div>

          <BowlingHUD />
          <MapOverlay vehicleRef={vehicleRef} />
          <MusicPlayer />
          <MobileControls />

          {/* HUD bar — keyboard hints, desktop only (mobile has the
              self-explanatory wheel/pedal cockpit instead) */}
          {!isMobile && (
            <div
              className="hud-bar"
              style={{
                position: 'fixed',
                bottom: 'clamp(8px, 2vh, 20px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(8,4,0,0.75)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(240,180,80,0.18)',
                borderRadius: 99,
                padding: 'clamp(5px, 1vh, 7px) clamp(12px, 3vw, 22px)',
                color: 'rgba(255,220,120,0.82)',
                fontSize: 'clamp(8px, 1.1vw, 11px)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                pointerEvents: 'none',
                userSelect: 'none',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                zIndex: 30,
              }}
            >
              <span className="hud-full" style={{ display: 'inline' }}>
                ↑↓←→ Drive · Space Brake · Shift Boost · R Reset · C Comment · Tab Map
              </span>
              <span className="hud-short" style={{ display: 'none' }}>
                Controls active
              </span>
            </div>
          )}
        </>
      )}

      {/* StartScreen — always on top */}
      <StartScreen />
    </div>
  )
}