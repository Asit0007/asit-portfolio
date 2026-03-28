import { useRef } from 'react'
import useGameStore from '../store/useGameStore'

export default function MobileJoystick({ onInput }) {
  const isMobile  = useGameStore((s) => s.isMobile)
  const stickRef  = useRef()
  const originRef = useRef({ x: 0, y: 0 })
  const activeId  = useRef(null)
  const DEAD = 12, MAX = 50

  if (!isMobile) return null

  const getDir = (cx, cy, ox, oy) => {
    const dx = cx - ox, dy = cy - oy
    const dist = Math.sqrt(dx*dx + dy*dy)
    if (dist < DEAD) return { forward:false, backward:false, left:false, right:false }
    const nx = dx/dist, ny = dy/dist
    return {
      forward:  ny < -0.3,
      backward: ny >  0.3,
      left:     nx < -0.3,
      right:    nx >  0.3,
    }
  }

  const onStart = (e) => {
    const t = e.changedTouches[0]
    activeId.current  = t.identifier
    originRef.current = { x: t.clientX, y: t.clientY }
    if (stickRef.current)
      stickRef.current.style.transform = 'translate(-50%,-50%)'
  }

  const onMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== activeId.current) continue
      const dx = t.clientX - originRef.current.x
      const dy = t.clientY - originRef.current.y
      const dist  = Math.sqrt(dx*dx + dy*dy)
      const clamp = Math.min(dist, MAX)
      const angle = Math.atan2(dy, dx)
      if (stickRef.current)
        stickRef.current.style.transform =
          `translate(calc(-50% + ${Math.cos(angle)*clamp}px), calc(-50% + ${Math.sin(angle)*clamp}px))`
      onInput(getDir(t.clientX, t.clientY, originRef.current.x, originRef.current.y))
    }
  }

  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== activeId.current) continue
      activeId.current = null
      if (stickRef.current)
        stickRef.current.style.transform = 'translate(-50%,-50%)'
      onInput({ forward:false, backward:false, left:false, right:false, brake:false })
    }
  }

  return (
    <>
      <div
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{
          position:'fixed', bottom:64, left:48, zIndex:40,
          width:112, height:112, borderRadius:'50%',
          background:'rgba(255,255,255,0.08)',
          border:'2px solid rgba(255,255,255,0.18)',
          display:'flex', alignItems:'center', justifyContent:'center',
          touchAction:'none', userSelect:'none',
        }}
      >
        <div ref={stickRef} style={{
          position:'absolute', width:44, height:44, borderRadius:'50%',
          background:'rgba(255,255,255,0.38)',
          border:'2px solid rgba(255,255,255,0.6)',
          top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }} />
      </div>
      <button
        onTouchStart={() => onInput(p => ({ ...p, brake:true  }))}
        onTouchEnd={()   => onInput(p => ({ ...p, brake:false }))}
        style={{
          position:'fixed', bottom:64, right:48, zIndex:40,
          width:64, height:64, borderRadius:'50%',
          background:'rgba(220,50,50,0.35)',
          border:'2px solid rgba(220,80,80,0.5)',
          color:'white', fontWeight:700, fontSize:12,
          touchAction:'none', userSelect:'none', cursor:'pointer',
        }}
      >
        BRAKE
      </button>
    </>
  )
}