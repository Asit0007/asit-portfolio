import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'

// ── Project slideshow overlay ─────────────────────────────────────────────────
function ProjectSlideshow({ content, color }) {
  const [idx, setIdx] = useState(0)
  const slides = content.slides || []

  // Arrow key navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'ArrowRight') setIdx(i => (i + 1) % slides.length)
      if (e.code === 'ArrowLeft')  setIdx(i => (i - 1 + slides.length) % slides.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[idx]

  return (
    <div style={{ marginTop: 16 }}>
      {/* Screenshot */}
      <div style={{
        width: '100%', height: 140,
        background: '#111',
        borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${color}30`,
        position: 'relative',
      }}>
        <img
          src={slide.image}
          alt={slide.title}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: 0.92,
          }}
          onError={(e) => { e.target.style.display = 'none' }}
        />
        {/* Project name overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          padding: '12px 10px 8px',
        }}>
          <p style={{
            color: '#fff', fontSize: 12, fontWeight: 700,
            fontFamily: 'monospace', margin: 0,
          }}>
            {slide.title}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 8,
      }}>
        <button
          onClick={() => setIdx(i => (i - 1 + slides.length) % slides.length)}
          style={{
            background: `${color}22`, border: `1px solid ${color}44`,
            color, borderRadius: 6, padding: '4px 10px',
            cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}
        >
          ←
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 16 : 6, height: 6,
                borderRadius: 99, cursor: 'pointer',
                background: i === idx ? color : `${color}40`,
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setIdx(i => (i + 1) % slides.length)}
          style={{
            background: `${color}22`, border: `1px solid ${color}44`,
            color, borderRadius: 6, padding: '4px 10px',
            cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}
        >
          →
        </button>
      </div>
      <p style={{
        color: 'rgba(255,255,255,0.3)', fontSize: 9,
        fontFamily: 'monospace', textAlign: 'center',
        marginTop: 4, letterSpacing: '0.08em',
      }}>
        ← → ARROW KEYS TO NAVIGATE
      </p>
    </div>
  )
}

// ── Contact zone special overlay ──────────────────────────────────────────────
function ContactOverlay({ zone }) {
  const contacts = [
    { icon: '📧', label: 'Email',    value: 'asitminz007@gmail.com', href: 'mailto:asitminz007@gmail.com' },
    { icon: '💼', label: 'LinkedIn', value: 'in/asitminz',           href: 'https://linkedin.com/in/asitminz'  },
    { icon: '🐙', label: 'GitHub',   value: 'Asit0007',              href: 'https://github.com/Asit0007'       },
    { icon: '📱', label: 'Phone',    value: '+91-7978004721',         href: 'tel:+917978004721'                 },
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center',
      paddingRight: 20, zIndex: 30, pointerEvents: 'none',
    }}>
      <div style={{
        width: 290,
        background: 'rgba(8,3,2,0.88)',
        backdropFilter: 'blur(18px)',
        borderRadius: 14,
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeft: `3px solid ${zone.color}`,
        padding: '20px 18px 20px 20px',
        pointerEvents: 'auto',
        boxShadow: `0 0 50px ${zone.color}25`,
      }}>
        <div style={{
          display: 'inline-block',
          background: `${zone.color}20`, border: `1px solid ${zone.color}40`,
          borderRadius: 5, padding: '2px 10px', fontSize: 10,
          color: zone.color, fontFamily: 'monospace',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          {zone.label}
        </div>

        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Let's Work Together
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 18 }}>
          Open to Cloud & DevOps opportunities
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contacts.map(({ icon, label, value, href }) => (
            
              key={label}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: `${zone.color}10`,
                border: `1px solid ${zone.color}20`,
                textDecoration: 'none',
                transition: 'background 0.2s, border-color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${zone.color}22`
                e.currentTarget.style.borderColor = `${zone.color}50`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${zone.color}10`
                e.currentTarget.style.borderColor = `${zone.color}20`
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <p style={{
                  color: 'rgba(255,255,255,0.4)', fontSize: 9,
                  fontFamily: 'monospace', letterSpacing: '0.08em',
                  textTransform: 'uppercase', margin: 0,
                }}>
                  {label}
                </p>
                <p style={{
                  color: '#fff', fontSize: 12, fontWeight: 600, margin: 0,
                }}>
                  {value}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Availability badge */}
        <div style={{
          marginTop: 14, padding: '7px 12px',
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 6px #10b981',
            animation: 'contactPulse 2s ease-in-out infinite',
          }} />
          <p style={{ color: '#10b981', fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
            Available for opportunities
          </p>
        </div>
        <style>{`
          @keyframes contactPulse {
            0%,100%{opacity:1;transform:scale(1)}
            50%{opacity:0.6;transform:scale(1.3)}
          }
        `}</style>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ZoneOverlay() {
  const activeZone = useGameStore((s) => s.activeZone)

  // Start zone welcome banner
  if (activeZone?.id === 'start') {
    return (
      <div style={{
        position: 'fixed', top: 20, left: '50%',
        transform: 'translateX(-50%)', zIndex: 30,
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(10,5,0,0.78)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(240,180,80,0.25)',
          borderRadius: 14, padding: '14px 30px', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 900,
            letterSpacing: '0.18em', color: '#f0c060', textTransform: 'uppercase',
          }}>
            Asit Minz
          </p>
          <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 }}>
            Infrastructure & Cloud Engineer · Bangalore
          </p>
          <p style={{
            color: 'rgba(255,220,100,0.32)', fontSize: 10,
            marginTop: 8, letterSpacing: '0.12em',
          }}>
            DRIVE TO EXPLORE · HIT THE LETTERS!
          </p>
        </div>
      </div>
    )
  }

  // Contact zone — special layout
  if (activeZone?.id === 'contact') {
    return <ContactOverlay zone={activeZone} />
  }

  // No content
  if (!activeZone?.content) return null

  const { content, color, label } = activeZone

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center',
      paddingRight: 20, zIndex: 30, pointerEvents: 'none',
    }}>
      <div style={{
        width: 300,
        background: 'rgba(8,4,1,0.86)',
        backdropFilter: 'blur(18px)',
        borderRadius: 14,
        border: `1px solid rgba(255,255,255,0.05)`,
        borderLeft: `3px solid ${color}`,
        padding: '18px 18px 18px 20px',
        pointerEvents: 'auto',
        boxShadow: `0 0 50px ${color}20`,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Zone badge */}
        <div style={{
          display: 'inline-block',
          background: `${color}20`, border: `1px solid ${color}40`,
          borderRadius: 5, padding: '2px 10px', fontSize: 10,
          color, fontFamily: 'monospace', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          {label}
        </div>

        <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 3 }}>
          {content.title}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 13 }}>
          {content.company}
        </p>

        {/* Bullet points */}
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {content.points.map((point, i) => (
            <li key={i} style={{
              display: 'flex', gap: 8,
              color: 'rgba(255,255,255,0.72)', fontSize: 11.5, lineHeight: 1.5,
            }}>
              <span style={{ color, flexShrink: 0, marginTop: 2 }}>▸</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          {content.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 99,
              fontFamily: 'monospace', background: `${color}15`,
              color, border: `1px solid ${color}30`,
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Project slideshow */}
        {activeZone.id === 'projects' && content.slides && (
          <ProjectSlideshow content={content} color={color} />
        )}

        {/* Links */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            { label: 'GitHub',   url: 'https://github.com/Asit0007' },
            { label: 'LinkedIn', url: 'https://linkedin.com/in/asitminz' },
          ].map(({ label: lbl, url }) => (
            
              key={lbl}
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, textAlign: 'center',
                padding: '6px 0',
                background: `${color}18`,
                border: `1px solid ${color}35`,
                borderRadius: 7, color,
                fontSize: 11, fontFamily: 'monospace',
                textDecoration: 'none', letterSpacing: '0.06em',
              }}
            >
              {lbl} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}