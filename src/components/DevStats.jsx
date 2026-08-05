import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'

// Written every frame from inside the Canvas, read every frame by
// RendererInfoOverlay outside it — avoids passing DOM nodes through R3F's
// non-DOM reconciler (createPortal from 'react-dom' broke it: R3F tried to
// create the <div> itself instead of routing it to the real DOM renderer).
export const rendererInfo = { text: '' }

// Mount inside <Canvas>. No DOM, just reads renderer.info each frame.
export function RendererInfoTracker() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    const { calls, triangles } = gl.info.render
    const { geometries, textures } = gl.info.memory
    rendererInfo.text =
      `calls ${calls}  tris ${triangles.toLocaleString()}  ` +
      `geo ${geometries}  tex ${textures}  progs ${gl.info.programs?.length ?? 0}`
  })
  return null
}

// Mount outside <Canvas>, in plain App DOM. Dev-only overlay.
// Bottom-left, above the music toggle button (MusicPlayer.jsx, bottom:20
// left:20) — moved off the top-left corner where it used to overlap
// LapTimerHUD (top:16 left:16) and drei's own <Stats/> panel, which
// defaults to top:0 left:0 (repositioned below via the .dev-stats-gl-panel
// override — stats.js sets that inline via style attribute, which beats a
// plain class selector without !important).
export function RendererInfoOverlay() {
  const elRef = useRef()

  useEffect(() => {
    let raf
    const tick = () => {
      if (elRef.current) elRef.current.textContent = rendererInfo.text
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!import.meta.env.DEV) return null
  return (
    <>
      <style>{`
        .dev-stats-gl-panel { top: auto !important; left: 8px !important; bottom: 70px !important; }
      `}</style>
      <div
        ref={elRef}
        style={{
          position: 'fixed', bottom: 8, left: 8, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', color: '#0f0',
          font: '11px monospace', padding: '4px 8px',
          pointerEvents: 'none', whiteSpace: 'pre',
        }}
      />
    </>
  )
}

// Mount inside <Canvas> — just the FPS/ms graph + the renderer.info tracker.
export default function DevStats() {
  if (!import.meta.env.DEV) return null
  return (
    <>
      <Stats className="dev-stats-gl-panel" />
      <RendererInfoTracker />
    </>
  )
}
