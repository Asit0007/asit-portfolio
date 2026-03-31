import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import Scene          from './components/Scene'
import ZoneOverlay    from './components/ZoneOverlay'
import MapOverlay     from './components/MapOverlay'
import MobileJoystick from './components/MobileJoystick'
import StartScreen    from './components/StartScreen'
import NosHUD         from './components/NosHUD'
import MusicPlayer    from './components/MusicPlayer'
import useGameStore   from './store/useGameStore'
import { keyMap }     from './Controls'
import { toggleMusic } from './audio'

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
        fontFamily: 'monospace',
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
        fontFamily: 'monospace',
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
  const setJoystick = useGameStore((s) => s.setJoystick)
  const vehicleBody = useGameStore((s) => s.vehicleBody)
  const gameStarted = useGameStore((s) => s.gameStarted)
  const vehicleRef  = useRef()

  if (vehicleBody) vehicleRef.current = vehicleBody
  useTitleAnimation(vehicleBody)

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
      if (e.code === 'KeyR') window.__resetCar = true
      if (e.code === 'KeyM') toggleMusic()
      if (e.code === 'Tab') {
        e.preventDefault()
        document.getElementById('map-btn')?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Global responsive styles */}
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root {
          width: 100%; height: 100%;
          margin: 0; padding: 0;
          overflow: hidden;
        }
        /* Vertical viewport fix for mobile browsers with address bar */
        #root {
          height: 100dvh;
          min-height: -webkit-fill-available;
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

      {/* 3D Canvas — always mounted */}
      <div style={{ position: 'fixed', inset: 0 }}>
        <Suspense fallback={<LoadingScreen />}>
          <KeyboardControls map={keyMap}>
            <Canvas
              shadows={!isMobile}
              camera={{ fov: 50, near: 0.1, far: 600, position: [8, 18, 20] }}
              gl={{
                antialias: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={[1, Math.min(window.devicePixelRatio, 2)]}
              style={{ width: '100%', height: '100%' }}
            >
              <Scene />
            </Canvas>
          </KeyboardControls>
        </Suspense>
      </div>

      {/* Game overlays — only when active */}
      {gameStarted && (
        <>
          <ZoneOverlay />

          {/* NOS gauge */}
          <div className="nos-hud" style={{ position: 'fixed', bottom: 56, left: '50%',
            transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none' }}>
            <NosHUD />
          </div>

          <MapOverlay vehicleRef={vehicleRef} />
          <MusicPlayer />
          <MobileJoystick onInput={setJoystick} />

          {/* Mobile boost button */}
          {isMobile && (
            <button
              onTouchStart={() => setJoystick(p => ({ ...p, boost: true }))}
              onTouchEnd={()   => setJoystick(p => ({ ...p, boost: false }))}
              style={{
                position: 'fixed',
                bottom: 'clamp(60px, 10vh, 80px)',
                right:  'clamp(60px, 8vw, 80px)',
                zIndex: 40,
                width: 'clamp(44px, 7vw, 56px)',
                height: 'clamp(44px, 7vw, 56px)',
                borderRadius: '50%',
                background: 'rgba(0,212,255,0.22)',
                border: '2px solid rgba(0,212,255,0.55)',
                color: '#00d4ff', fontFamily: 'monospace',
                fontSize: 10, fontWeight: 700,
                touchAction: 'none', userSelect: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexDirection: 'column', gap: 1,
              }}
            >
              <span style={{ fontSize: 18 }}>⚡</span>
              <span style={{ fontSize: 7 }}>BOOST</span>
            </button>
          )}

          {/* HUD bar — responsive */}
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
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              pointerEvents: 'none',
              userSelect: 'none',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              zIndex: 30,
            }}
          >
            <span className="hud-full" style={{ display: 'inline' }}>
              ↑↓←→ Drive · Space Brake · Shift Boost · R Reset · Tab Map
            </span>
            <span className="hud-short" style={{ display: 'none' }}>
              Controls active
            </span>
          </div>
        </>
      )}

      {/* StartScreen — always on top */}
      <StartScreen />
    </>
  )
}