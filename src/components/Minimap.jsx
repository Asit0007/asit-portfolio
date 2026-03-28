import { useRef, useEffect } from 'react'
import useGameStore, { ZONES } from '../store/useGameStore'

const WORLD_SIZE = 200
const MAP_SIZE   = 130
const SCALE      = MAP_SIZE / WORLD_SIZE

const ZONE_DOTS = [
  { id: 'start',    x:   0, z:   0, color: '#00d4ff' },
  { id: 'cloud',    x:   0, z: -55, color: '#f59e0b' },
  { id: 'projects', x:  55, z:   0, color: '#10b981' },
  { id: 'hobbies',  x: -55, z:   0, color: '#a855f7' },
]

export default function Minimap({ vehicleRef }) {
  const canvasRef  = useRef()
  const activeZone = useGameStore((s) => s.activeZone)

  useEffect(() => {
    let raf
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) { raf = requestAnimationFrame(draw); return }
      const ctx = canvas.getContext('2d')
      const w = MAP_SIZE, h = MAP_SIZE
      const cx = w / 2, cz = h / 2

      ctx.clearRect(0, 0, w, h)

      // Background
      ctx.fillStyle = 'rgba(12,6,2,0.85)'
      ctx.beginPath()
      ctx.roundRect(0, 0, w, h, 10)
      ctx.fill()

      // Roads
      ctx.strokeStyle = 'rgba(180,150,80,0.35)'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx, h-4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(4, cz); ctx.lineTo(w-4, cz); ctx.stroke()

      // Zone dots
      ZONE_DOTS.forEach(({ id, x, z, color }) => {
        const mx = cx + x * SCALE
        const mz = cz + z * SCALE
        const isActive = activeZone?.id === id
        const r = isActive ? 6.5 : 4.5

        ctx.beginPath()
        ctx.arc(mx, mz, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = isActive ? 1.0 : 0.65
        ctx.fill()
        ctx.globalAlpha = 1

        if (isActive) {
          ctx.beginPath()
          ctx.arc(mx, mz, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = color
          ctx.lineWidth = 1.2
          ctx.globalAlpha = 0.35
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      })

      // Vehicle position
      try {
        if (vehicleRef?.current) {
          const t = vehicleRef.current.translation()
          const vx = Math.max(5, Math.min(w-5, cx + t.x * SCALE))
          const vz = Math.max(5, Math.min(h-5, cz + t.z * SCALE))

          ctx.beginPath()
          ctx.arc(vx, vz, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = 1
          ctx.fill()

          ctx.beginPath()
          ctx.arc(vx, vz, 7, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      } catch (_) {}

      // Border
      ctx.strokeStyle = 'rgba(240,180,80,0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(1, 1, w-2, h-2, 10)
      ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [vehicleRef, activeZone])

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      zIndex: 30, userSelect: 'none', pointerEvents: 'none',
    }}>
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        style={{ borderRadius: 10, display: 'block' }}
      />
      <div style={{
        marginTop: 6, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', gap: 3,
      }}>
        {ZONE_DOTS.filter(d => d.id !== 'start').map(d => (
          <div key={d.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 9, fontFamily: 'monospace',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {ZONES[d.id]?.sublabel?.split('·')[0].trim()}
            </span>
            <span style={{ color: d.color, fontSize: 8 }}>⬤</span>
          </div>
        ))}
      </div>
    </div>
  )
}