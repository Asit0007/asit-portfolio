import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'
import { initAudio } from '../audio'

// Boot lines — each types in sequence
const BOOT_LINES = [
  { text: '> initializing portfolio_v2.0 ...', delay: 0,    color: '#555'    },
  { text: '> node: bangalore-prod-01',          delay: 400,  color: '#555'    },
  { text: '> azure: connected ✓',               delay: 750,  color: '#10b981' },
  { text: '> aws: connected ✓',                 delay: 1000, color: '#10b981' },
  { text: '> terraform: ready ✓',               delay: 1250, color: '#10b981' },
  { text: '> llm_chain: ready ✓',               delay: 1550, color: '#10b981' },
  { text: '> select boot mode:',                delay: 1850, color: '#f0c060' },
]

function BootLine({ text, delay, color }) {
  const [show,  setShow]  = useState(false)
  const [typed, setTyped] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(true)
      let i = 0
      const id = setInterval(() => {
        i++; setTyped(text.slice(0, i))
        if (i >= text.length) clearInterval(id)
      }, 18)
      return () => clearInterval(id)
    }, delay)
    return () => clearTimeout(t)
  }, [text, delay])
  if (!show) return null
  return (
    <div style={{
      color, fontSize: 'clamp(9px, 1.4vw, 11px)',
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      {typed}
    </div>
  )
}

// Compact mode card — horizontal layout for small screens
function ModeCard({ mode, icon, label, subtitle, desc, tags, color, hovered, onClick, onEnter, onLeave }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        cursor: 'pointer',
        background: hovered ? `${color}10` : `${color}04`,
        border: `1px solid ${hovered ? color + '55' : color + '20'}`,
        borderRadius: 12,
        padding: 'clamp(14px, 3vw, 24px)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 32px ${color}15` : 'none',
        position: 'relative', overflow: 'hidden',
        width: '100%',
        maxWidth: 'min(240px, 90vw)',
      }}
    >
      {/* Top glow line on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
        }} />
      )}

      {/* Icon + Mode label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 'clamp(20px, 4vw, 28px)' }}>{icon}</span>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontWeight: 900,
            fontSize: 'clamp(14px, 3vw, 20px)',
            color, letterSpacing: '0.15em',
          }}>
            {mode}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 'clamp(7px, 1.2vw, 9px)',
            color: color + '88', letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        color: 'rgba(255,255,255,0.38)',
        fontSize: 'clamp(10px, 1.5vw, 12px)',
        lineHeight: 1.55, margin: '0 0 10px',
        fontFamily: 'var(--font-mono)',
      }}>
        {desc}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {tags.map(t => (
          <span key={t} style={{
            fontSize: 'clamp(7px, 1vw, 9px)',
            padding: '1px 6px', borderRadius: 99,
            fontFamily: 'var(--font-mono)', color,
            background: color + '15',
            border: `1px solid ${color}25`,
          }}>
            {t}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'clamp(8px, 1.2vw, 11px)',
        letterSpacing: '0.1em',
        color: hovered ? color : color + '50',
        transition: 'color 0.2s',
      }}>
        {hovered ? `▶ CLICK TO ${label}` : `▷ CLICK TO ${label}`}
      </div>
    </div>
  )
}

export default function StartScreen() {
  const gameStarted    = useGameStore((s) => s.gameStarted)
  const setGameStarted = useGameStore((s) => s.setGameStarted)
  const [phase,   setPhase]   = useState('boot')
  const [fading,  setFading]  = useState(false)
  const [hovered, setHovered] = useState(null)
  const [showOGLocal, setShowOGLocal] = useState(false)
  // Either the visitor picked OG MODE on the boot screen, or PerfNotice
  // offered it as the way out of a world their device can't render. Both end
  // up here, and either way "back" has to clear both.
  const showResume    = useGameStore((s) => s.showResume)
  const setShowResume = useGameStore((s) => s.setShowResume)
  const showOG = showOGLocal || showResume
  const closeOG = () => { setShowOGLocal(false); setShowResume(false) }

  useEffect(() => {
    const t = setTimeout(() => setPhase('choice'), 2200)
    return () => clearTimeout(t)
  }, [])

  if (gameStarted && !showOG) return null

  const handleGG = () => {
    if (fading) return
    closeOG()
    setFading(true)
    initAudio()
    setTimeout(() => setGameStarted(true), 700)
  }

  const handleOG = () => setShowOGLocal(true)

  // OG MODE is its own page now, /resume/ (public/resume/index.html): plain, fast, no 3D to load.
  // Both doors (this card and PerfNotice's offer) still set the flags above; this is where they lead.
  if (showOG) {
    window.location.assign('/resume/')
    return null
  }

  const ready = phase === 'choice'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#050301',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.7s ease',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      }} />

      {/* Header identifiers */}
      <div style={{
        position: 'absolute', top: 'clamp(12px, 2vh, 24px)',
        left: 'clamp(12px, 3vw, 28px)', right: 'clamp(12px, 3vw, 28px)',
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 'clamp(8px, 1.2vw, 10px)',
        color: 'rgba(240,192,96,0.22)', letterSpacing: '0.15em',
        zIndex: 2, pointerEvents: 'none',
      }}>
        <span>ASIT_MINZ // v2.0</span>
        <span>BANGALORE · INDIA</span>
      </div>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -80, left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(500px, 80vw)', height: 200,
        background: 'radial-gradient(ellipse, rgba(240,192,96,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Main content — vertically centered with scroll fallback */}
      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 32px) clamp(48px, 8vh, 64px)',
        gap: 0,
        overflowY: 'auto',
      }}>

        {/* Boot sequence */}
        <div style={{
          marginBottom: 'clamp(16px, 3vh, 32px)',
          opacity: ready ? 0.35 : 1,
          transition: 'opacity 1.2s ease',
          width: '100%', maxWidth: 420,
          minHeight: ready ? 0 : 'auto',
        }}>
          {BOOT_LINES.map((line, i) => (
            <BootLine key={i} {...line} />
          ))}
        </div>

        {/* Name */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'clamp(8px, 2vh, 20px)',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(32px, 9vw, 80px)',
            fontWeight: 900,
            letterSpacing: 'clamp(0.1em, 2vw, 0.2em)',
            color: '#f0c060',
            margin: 0, lineHeight: 1,
            textShadow: '0 0 40px rgba(240,192,96,0.28)',
          }}>
            ASIT MINZ
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(8px, 1.5vw, 12px)',
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: 'clamp(0.1em, 2vw, 0.28em)',
            textTransform: 'uppercase',
            margin: 'clamp(6px, 1.5vh, 12px) 0 0',
          }}>
            Building AI Systems · From an Operator's Chair
          </p>
        </div>

        {/* Divider */}
        <div style={{
          width: 40, height: 1,
          background: 'rgba(240,192,96,0.18)',
          margin: '0 auto',
          marginBottom: 'clamp(16px, 3vh, 28px)',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease 0.3s',
        }} />

        {/* Cards — side by side on wide, stacked on narrow */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 'clamp(10px, 2vw, 16px)',
          justifyContent: 'center',
          width: '100%',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.7s ease 0.4s, transform 0.7s ease 0.4s',
        }}>
          <ModeCard
            mode="GG MODE"
            icon="🎮"
            label="ENTER"
            subtitle="Interactive 3D Experience"
            desc="Drive through a gamified world. Explore zones, knock over letters, discover easter eggs."
            tags={['3D World', 'Physics', 'Audio', 'Fun']}
            color="#00d4ff"
            hovered={hovered === 'gg'}
            onClick={handleGG}
            onEnter={() => setHovered('gg')}
            onLeave={() => setHovered(null)}
          />

          <ModeCard
            mode="OG MODE"
            icon="📋"
            label="VIEW"
            subtitle="Professional Portfolio"
            desc="Resume, experience, projects, skills. Everything recruiters need in under 60 seconds."
            tags={['Resume', 'Projects', 'Skills', 'Contact']}
            color="#f0c060"
            hovered={hovered === 'og'}
            onClick={handleOG}
            onEnter={() => setHovered('og')}
            onLeave={() => setHovered(null)}
          />
        </div>

        {/* Links */}
        <div style={{
          display: 'flex', gap: 'clamp(12px, 3vw, 24px)',
          marginTop: 'clamp(16px, 3vh, 28px)',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease 0.7s',
        }}>
          {[
            { label: 'GitHub',   url: 'https://github.com/Asit0007'      },
            { label: 'LinkedIn', url: 'https://linkedin.com/in/asitminz' },
            { label: 'Blog',     url: 'https://blogs.asitminz.com'       },
            { label: 'Email',    url: 'mailto:asitminz007@gmail.com'     },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noreferrer"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(8px, 1.2vw, 10px)',
                color: 'rgba(255,255,255,0.18)',
                letterSpacing: '0.14em',
                textDecoration: 'none',
                textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'rgba(240,192,96,0.7)'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.18)'}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
