import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import Scene from './components/Scene'
import ZoneOverlay from './components/ZoneOverlay'
import Minimap from './components/Minimap'
import MobileJoystick from './components/MobileJoystick'
import useGameStore from './store/useGameStore'
import { keyMap } from './Controls'

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
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <p style={{
        fontFamily: 'monospace', fontSize: 28, fontWeight: 900,
        letterSpacing: '0.2em', color: '#f0c060',
        textTransform: 'uppercase',
      }}>
        ASIT MINZ
      </p>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading world...
      </p>
      <div style={{
        width: 220, height: 3, background: 'rgba(255,255,255,0.1)',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#f0c060',
          borderRadius: 99, width: '60%',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

export default function App() {
  const isMobile   = useGameStore((s) => s.isMobile)
  const setJoystick = useGameStore((s) => s.setJoystick)
  const vehicleBody = useGameStore((s) => s.vehicleBody)
  const vehicleRef  = useRef()

  if (vehicleBody) vehicleRef.current = vehicleBody

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

  return (
    <>
      {/* Context lost overlay */}
      <div id="context-lost-msg" style={{
        display: 'none', position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.92)', color: 'white',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16,
      }}>
        <p style={{ fontSize: 22, fontWeight: 700 }}>⚠️ Graphics context lost</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 28px', background: '#f0c060',
            color: '#1a0a00', borderRadius: 8, fontWeight: 700,
            border: 'none', cursor: 'pointer', fontSize: 15,
          }}
        >
          Reload Page
        </button>
      </div>

      {/* SEO / A11y hidden resume */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
        aria-label="Portfolio resume content">
        <h1>Asit Minz — Infrastructure & Cloud Engineer</h1>
        <p>Bangalore, India. 4 years IT experience. B.Tech CS, IIIT Bhubaneswar.</p>
        <h2>Experience</h2>
        <p>Senior Engineer – Wintel & Virtualization at Microland Limited (Sep 2022–Present)</p>
        <h2>Skills</h2>
        <p>Azure, AWS, Terraform, Ansible, Docker, GitHub Actions, Linux, Windows Server, Python, Bash</p>
        <h2>Certifications</h2>
        <p>Azure Administrator Associate (AZ-104), Ansible for Beginners, Postman Essential</p>
        <h2>Projects</h2>
        <p>CloudPulse: Go, Docker, Terraform, GitHub Actions CI/CD.</p>
        <p>Automated Trading System: Python, SQLite, Streamlit.</p>
        <p>Magento 2: Debian, NGINX, PHP 8.3.</p>
      </div>

      {/* 3D Canvas — fullscreen */}
      <div style={{ position: 'fixed', inset: 0 }}>
        <Suspense fallback={<LoadingScreen />}>
          <KeyboardControls map={keyMap}>
            <Canvas
              shadows={!isMobile}
              camera={{ fov: 55, near: 0.1, far: 600, position: [0, 10, 18] }}
              gl={{
                antialias: !isMobile,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={isMobile ? [1, 1.5] : [1, 2]}
              style={{ width: '100%', height: '100%' }}
            >
              <Scene />
            </Canvas>
          </KeyboardControls>
        </Suspense>
      </div>

      {/* HTML overlays */}
      <ZoneOverlay />
      <Minimap vehicleRef={vehicleRef} />
      <MobileJoystick onInput={setJoystick} />

      {/* HUD */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,220,120,0.5)', fontSize: 12,
        fontFamily: 'monospace', letterSpacing: '0.1em',
        pointerEvents: 'none', userSelect: 'none',
        textTransform: 'uppercase',
      }}>
        WASD / Arrow Keys to drive &nbsp;·&nbsp; Space to brake
      </div>
    </>
  )
}