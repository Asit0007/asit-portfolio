import { useState, useEffect, useRef } from 'react'
import useGameStore from '../store/useGameStore'

const WORLD_SIZE = 200
const MAP_SIZE   = 340

const ZONE_INFO = [
  { id:'cloud',    x:0,   z:-55, color:'#f59e0b', icon:'☁️',  label:'Cloud & Infra',  desc:'Microland · Azure · AZ-104' },
  { id:'projects', x:55,  z:0,   color:'#10b981', icon:'🛠️',  label:'Projects',       desc:'CloudPulse · QuantBot · Magento' },
  { id:'hobbies',  x:-55, z:0,   color:'#a855f7', icon:'🥊',  label:'Easter Egg',     desc:'Muay Thai · PS2 · Badminton' },
  { id:'contact',  x:0,   z:55,  color:'#f43f5e', icon:'📬',  label:'Contact',        desc:'asitminz007@gmail.com' },
  { id:'start',    x:0,   z:0,   color:'#00d4ff', icon:'🚗',  label:'Start',          desc:'Spawn · Instructions' },
]

export default function MapOverlay({ vehicleRef }) {
  const [open,     setOpen]     = useState(false)
  const [hovered,  setHovered]  = useState(null)
  const canvasRef  = useRef()
  const activeZone = useGameStore((s) => s.activeZone)
  const scale      = MAP_SIZE / WORLD_SIZE
  const cx         = MAP_SIZE / 2
  const cz         = MAP_SIZE / 2

  // Draw map on canvas
  useEffect(() => {
    if (!open) return
    let raf
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE)

      // Background
      ctx.fillStyle = 'rgba(10,5,0,0.95)'
      ctx.beginPath()
      ctx.roundRect(0, 0, MAP_SIZE, MAP_SIZE, 12)
      ctx.fill()

      // Grid lines
      ctx.strokeStyle = 'rgba(255,200,80,0.06)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 10; i++) {
        const pos = (i / 10) * MAP_SIZE
        ctx.beginPath(); ctx.moveTo(pos,0); ctx.lineTo(pos,MAP_SIZE); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0,pos); ctx.lineTo(MAP_SIZE,pos); ctx.stroke()
      }

      // Roads
      ctx.strokeStyle = 'rgba(160,130,60,0.5)'
      ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(cx,8); ctx.lineTo(cx,MAP_SIZE-8); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(8,cz); ctx.lineTo(MAP_SIZE-8,cz); ctx.stroke()

      // Road dashes
      ctx.strokeStyle = 'rgba(240,200,80,0.35)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([8,6])
      ctx.beginPath(); ctx.moveTo(cx,8); ctx.lineTo(cx,MAP_SIZE-8); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(8,cz); ctx.lineTo(MAP_SIZE-8,cz); ctx.stroke()
      ctx.setLineDash([])

      // Zone circles
      ZONE_INFO.forEach(({ x, z, color, id }) => {
        const mx = cx + x * scale
        const mz = cz + z * scale
        const isActive = activeZone?.id === id
        const isHovered = hovered === id
        const r = id === 'start' ? 12 : 22

        // Zone glow
        if (isActive || isHovered) {
          const grd = ctx.createRadialGradient(mx,mz,0,mx,mz,r*1.8)
          grd.addColorStop(0, color + '40')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.beginPath(); ctx.arc(mx,mz,r*1.8,0,Math.PI*2); ctx.fill()
        }

        // Zone fill
        ctx.beginPath(); ctx.arc(mx,mz,r,0,Math.PI*2)
        ctx.fillStyle = color + (isActive?'55':'28')
        ctx.fill()
        ctx.strokeStyle = color + (isActive?'ff':'88')
        ctx.lineWidth = isActive ? 2.5 : 1.5
        ctx.stroke()
      })

      // Vehicle dot
      try {
        if (vehicleRef?.current) {
          const t = vehicleRef.current.translation()
          const vx = Math.max(8, Math.min(MAP_SIZE-8, cx + t.x * scale))
          const vz = Math.max(8, Math.min(MAP_SIZE-8, cz + t.z * scale))

          // Glow
          const grd = ctx.createRadialGradient(vx,vz,0,vx,vz,14)
          grd.addColorStop(0, 'rgba(255,255,255,0.5)')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.beginPath(); ctx.arc(vx,vz,14,0,Math.PI*2); ctx.fill()

          ctx.beginPath(); ctx.arc(vx,vz,5,0,Math.PI*2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      } catch (_) {}

      // Border
      ctx.strokeStyle = 'rgba(240,180,80,0.25)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.roundRect(1,1,MAP_SIZE-2,MAP_SIZE-2,11); ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [open, activeZone, hovered, vehicleRef])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Map toggle button — replaces minimap entirely */}
      <button
        id="map-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 20, right: 20,
          zIndex: 35,
          width: 56, height: 56,
          background: open
            ? 'rgba(240,192,96,0.22)'
            : 'rgba(8,4,0,0.78)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${open
            ? 'rgba(240,192,96,0.55)'
            : 'rgba(240,180,80,0.2)'}`,
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          transition: 'all 0.2s',
          boxShadow: open ? '0 0 16px rgba(240,192,96,0.2)' : 'none',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>🗺️</span>
        <span style={{
          color: open
            ? 'rgba(240,192,96,0.9)'
            : 'rgba(240,192,96,0.5)',
          fontSize: 8,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          MAP
        </span>
      </button>

      {/* Map overlay panel */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 45,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              display: 'flex', gap: 20, alignItems: 'flex-start',
              padding: 24,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Canvas map */}
            <div style={{ position: 'relative' }}>
              <canvas
                ref={canvasRef}
                width={MAP_SIZE}
                height={MAP_SIZE}
                style={{ borderRadius: 12, display: 'block', cursor: 'default' }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const mx = e.clientX - rect.left
                  const mz = e.clientY - rect.top
                  let found = null
                  ZONE_INFO.forEach(({ id, x, z }) => {
                    const zx = cx + x * scale
                    const zz = cz + z * scale
                    const r = id === 'start' ? 12 : 22
                    if (Math.sqrt((mx-zx)**2 + (mz-zz)**2) < r + 8) found = id
                  })
                  setHovered(found)
                }}
                onMouseLeave={() => setHovered(null)}
              />

              {/* Zone icon labels on canvas */}
              {ZONE_INFO.map(({ id, x, z, color, icon, label }) => {
                const mx = cx + x * scale
                const mz = cz + z * scale
                const offsetY = id === 'start' ? -20 : -32
                return (
                  <div key={id} style={{
                    position: 'absolute',
                    left: mx, top: mz + offsetY,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: id === 'start' ? 14 : 16 }}>{icon}</div>
                    {hovered === id && (
                      <div style={{
                        background: 'rgba(0,0,0,0.85)',
                        color, fontSize: 10,
                        padding: '2px 8px', borderRadius: 99,
                        fontFamily: 'monospace', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap', marginTop: 2,
                      }}>
                        {label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Zone legend panel */}
            <div style={{
              width: 240,
              background: 'rgba(8,4,0,0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(240,180,80,0.15)',
              borderRadius: 12, padding: '18px 16px',
            }}>
              <p style={{
                fontFamily: 'monospace', fontSize: 11,
                color: 'rgba(240,192,96,0.7)',
                letterSpacing: '0.15em', textTransform: 'uppercase',
                margin: '0 0 16px',
              }}>
                World Map
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ZONE_INFO.map(({ id, color, icon, label, desc }) => (
                  <div
                    key={id}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '8px 10px', borderRadius: 8, cursor: 'default',
                      background: hovered===id || activeZone?.id===id
                        ? `${color}15` : 'transparent',
                      border: `1px solid ${hovered===id || activeZone?.id===id
                        ? color+'40' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color, flexShrink: 0,
                      boxShadow: activeZone?.id===id ? `0 0 8px ${color}` : 'none',
                    }} />
                    <div>
                      <p style={{
                        color: '#fff', fontSize: 12, fontWeight: 700,
                        fontFamily: 'monospace', margin: 0, lineHeight: 1.2,
                      }}>
                        {icon} {label}
                      </p>
                      <p style={{
                        color: 'rgba(255,255,255,0.35)', fontSize: 10,
                        margin: '2px 0 0', fontFamily: 'monospace',
                      }}>
                        {desc}
                      </p>
                    </div>
                    {activeZone?.id === id && (
                      <div style={{
                        marginLeft: 'auto', fontSize: 9,
                        color, fontFamily: 'monospace',
                        letterSpacing: '0.08em',
                      }}>
                        HERE
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{
                height: 1, background: 'rgba(240,180,80,0.12)',
                margin: '16px 0',
              }} />

              {/* Controls reminder */}
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {[
                  ['↑↓←→', 'Drive'],
                  ['SPACE', 'Brake'],
                  ['R',     'Reset car'],
                  ['M',     'Mute music'],
                  ['ESC',   'Close map'],
                ].map(([key, label]) => (
                  <div key={key} style={{
                    display:'flex', justifyContent:'space-between',
                    alignItems:'center',
                  }}>
                    <span style={{
                      background:'rgba(255,255,255,0.08)',
                      color:'rgba(255,255,255,0.6)',
                      fontSize:10, padding:'1px 7px', borderRadius:4,
                      fontFamily:'monospace', letterSpacing:'0.06em',
                    }}>{key}</span>
                    <span style={{
                      color:'rgba(255,255,255,0.35)',
                      fontSize:10, fontFamily:'monospace',
                    }}>{label}</span>
                  </div>
                ))}
              </div>

              <p style={{
                color:'rgba(255,255,255,0.18)', fontSize:9,
                fontFamily:'monospace', textAlign:'center',
                marginTop:14, letterSpacing:'0.08em',
              }}>
                Click anywhere outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}