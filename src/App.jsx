import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import Scene          from './components/Scene'
import ZoneOverlay    from './components/ZoneOverlay'
import Minimap        from './components/Minimap'
import MobileJoystick from './components/MobileJoystick'
import StartScreen    from './components/StartScreen'
import MapOverlay     from './components/MapOverlay'
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
      position:'fixed', inset:0, zIndex:40, background:'#0d0500',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:24,
    }}>
      <p style={{
        fontFamily:'monospace', fontSize:26, fontWeight:900,
        letterSpacing:'0.22em', color:'#f0c060', textTransform:'uppercase',
      }}>ASIT MINZ</p>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, fontFamily:'monospace' }}>
        Loading world...
      </p>
      <div style={{
        width:200, height:2, background:'rgba(255,255,255,0.08)',
        borderRadius:99, overflow:'hidden',
      }}>
        <div style={{
          height:'100%', background:'#f0c060', borderRadius:99,
          width:'55%', animation:'ldpulse 1.4s ease-in-out infinite',
        }} />
      </div>
      <style>{`@keyframes ldpulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  )
}

function useTitleAnimation(vehicleBody) {
  useEffect(() => {
    if (!vehicleBody) return
    let last = ''
    const id = setInterval(() => {
      try {
        const lv = vehicleBody.linvel()
        const speed = Math.sqrt(lv.x*lv.x + lv.z*lv.z)
        const title = speed>15?'🔥 Asit Minz | Portfolio'
          : speed>8?'💨 Asit Minz | Portfolio'
          : speed>1?'🚗 Asit Minz | Portfolio'
          : 'Asit Minz | Portfolio'
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
      // Tab key opens map — prevent default tab focus behavior
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
      {/* Context lost */}
      <div id="context-lost-msg" style={{
        display:'none', position:'fixed', inset:0, zIndex:50,
        background:'rgba(0,0,0,0.92)', color:'white',
        flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16,
      }}>
        <p style={{ fontSize:20, fontWeight:700 }}>⚠️ Graphics context lost</p>
        <button onClick={() => window.location.reload()} style={{
          padding:'10px 28px', background:'#f0c060', color:'#1a0a00',
          borderRadius:8, fontWeight:700, border:'none', cursor:'pointer', fontSize:15,
        }}>Reload</button>
      </div>

      {/* A11y */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0 }}
        aria-label="Portfolio resume content">
        <h1>Asit Minz — Infrastructure & Cloud Engineer</h1>
        <p>Bangalore. AZ-104. Microland. CloudPulse. QuantBot. Magento DeployKit.</p>
      </div>

      {/* Canvas */}
      <div style={{ position:'fixed', inset:0 }}>
        <Suspense fallback={<LoadingScreen />}>
          <KeyboardControls map={keyMap}>
            <Canvas
              shadows={!isMobile}
              camera={{ fov:50, near:0.1, far:600, position:[-8, 18, -20] }}
              gl={{
                antialias: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={[1, Math.min(window.devicePixelRatio, 2)]}
              style={{ width:'100%', height:'100%' }}
            >
              <Scene />
            </Canvas>
          </KeyboardControls>
        </Suspense>
      </div>

      {/* Overlays */}
      <ZoneOverlay />
      <Minimap vehicleRef={vehicleRef} />
      <MapOverlay vehicleRef={vehicleRef} />
      <MobileJoystick onInput={setJoystick} />
      <StartScreen />

      {/* HUD */}
      <div style={{
        position:'fixed', bottom:20, left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(8,4,0,0.72)', backdropFilter:'blur(10px)',
        border:'1px solid rgba(240,180,80,0.18)',
        borderRadius:99, padding:'7px 22px',
        color:'rgba(255,220,120,0.8)', fontSize:11,
        fontFamily:'monospace', letterSpacing:'0.12em',
        pointerEvents:'none', userSelect:'none',
        textTransform:'uppercase', whiteSpace:'nowrap',
      }}>
        ↑↓←→ Drive &nbsp;·&nbsp; Space Brake &nbsp;·&nbsp; R Reset &nbsp;·&nbsp; M Mute &nbsp;·&nbsp; Tab Map
      </div>
    </>
  )
}