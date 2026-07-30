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
    <div
      ref={elRef}
      style={{
        position: 'fixed', top: 48, left: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', color: '#0f0',
        font: '11px monospace', padding: '4px 8px',
        pointerEvents: 'none', whiteSpace: 'pre',
      }}
    />
  )
}

// Mount inside <Canvas> — just the FPS/ms graph + the renderer.info tracker.
export default function DevStats() {
  if (!import.meta.env.DEV) return null
  return (
    <>
      <Stats />
      <RendererInfoTracker />
    </>
  )
}
