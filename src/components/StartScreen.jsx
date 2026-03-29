import { useState } from 'react'
import useGameStore from '../store/useGameStore'
import { initAudio } from '../audio'

export default function StartScreen() {
  const gameStarted    = useGameStore((s) => s.gameStarted)
  const setGameStarted = useGameStore((s) => s.setGameStarted)
  const [fading, setFading] = useState(false)

  if (gameStarted) return null

  const handleStart = () => {
    if (fading) return
    setFading(true)
    initAudio()
    setTimeout(() => setGameStarted(true), 900)
  }

  return (
    <div
      onClick={handleStart}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: fading ? 'rgba(10,4,0,0)' : 'rgba(10,4,0,0.92)',
        backdropFilter: fading ? 'blur(0px)' : 'blur(4px)',
        transition: 'background 0.9s ease, backdrop-filter 0.9s ease',
      }}
    >
      <div style={{
        textAlign: 'center',
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(-12px)' : 'translateY(0)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        padding: '0 24px',
        maxWidth: 520,
      }}>

        {/* Decorative line */}
        <div style={{
          width: 48, height: 2,
          background: 'rgba(240,192,96,0.5)',
          margin: '0 auto 28px',
        }} />

        {/* Name */}
        <h1 style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(28px, 5.5vw, 64px)',
          fontWeight: 900,
          letterSpacing: '0.22em',
          color: '#f0c060',
          margin: 0,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          ASIT MINZ
        </h1>

        {/* Role */}
        <p style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(10px, 1.4vw, 14px)',
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          margin: '14px 0 0',
        }}>
          Infrastructure & Cloud Engineer · Bangalore
        </p>

        {/* Divider */}
        <div style={{
          width: 48, height: 1,
          background: 'rgba(240,192,96,0.25)',
          margin: '28px auto',
        }} />

        {/* Skill tags */}
        <div style={{
          display: 'flex', flexWrap: 'wrap',
          gap: 8, justifyContent: 'center', marginBottom: 32,
        }}>
          {['Azure AZ-104', 'AWS', 'Terraform', 'Docker', 'GitHub Actions', 'Python'].map((t) => (
            <span key={t} style={{
              fontSize: 10, padding: '3px 10px',
              borderRadius: 99, fontFamily: 'monospace',
              background: 'rgba(240,192,96,0.08)',
              color: 'rgba(240,192,96,0.65)',
              border: '1px solid rgba(240,192,96,0.18)',
              letterSpacing: '0.06em',
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          fontFamily: 'monospace',
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          animation: 'startPulse 2.2s ease-in-out infinite',
        }}>
          Click anywhere to explore
        </div>

        {/* Music note hint */}
        <p style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.1em',
          marginTop: 16,
        }}>
          🎵 with sound &nbsp;·&nbsp; M to mute
        </p>
      </div>

      {/* Links */}
      <div style={{
        position: 'absolute', bottom: 24,
        display: 'flex', gap: 20,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}>
        {[
          { label: 'GitHub', url: 'https://github.com/Asit0007' },
          { label: 'LinkedIn', url: 'https://linkedin.com/in/asitminz' },
        ].map(({ label, url }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: 'monospace', fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              textTransform: 'uppercase',
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              paddingBottom: 2,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.color = 'rgba(240,192,96,0.8)'}
            onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.35)'}
          >
            {label}
          </a>
        ))}
      </div>

      <style>{`
        @keyframes startPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}