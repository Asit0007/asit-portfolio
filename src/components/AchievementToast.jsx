import { useEffect } from 'react'

export default function AchievementToast({ title, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 35, pointerEvents: 'none', userSelect: 'none',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(8,4,0,0.85)', backdropFilter: 'blur(14px)',
      border: '1px solid rgba(240,180,80,0.3)', borderRadius: 12,
      padding: '10px 18px',
      boxShadow: '0 0 30px rgba(240,180,80,0.15)',
      animation: 'achievementIn 0.3s ease-out',
    }}>
      <span style={{ fontSize: 20 }}>🏆</span>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'rgba(255,220,120,0.5)',
        }}>
          Achievement
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#f0c060' }}>
          {title}
        </div>
      </div>
      <style>{`
        @keyframes achievementIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}
