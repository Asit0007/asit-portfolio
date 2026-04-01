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
  { text: '> select boot mode:',                delay: 1600, color: '#f0c060' },
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
      fontFamily: 'monospace', letterSpacing: '0.04em',
      lineHeight: 1.7, whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      {typed}
    </div>
  )
}

// Compact mode card — horizontal layout for small screens
function ModeCard({ mode, icon, label, subtitle, desc, tags, color, hovered, onClick, onEnter, onLeave }) {
  const isSmall = typeof window !== 'undefined' && window.innerWidth < 500

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
            fontFamily: 'monospace', fontWeight: 900,
            fontSize: 'clamp(14px, 3vw, 20px)',
            color, letterSpacing: '0.15em',
          }}>
            {mode}
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 'clamp(7px, 1.2vw, 9px)',
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
        fontFamily: 'monospace',
      }}>
        {desc}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {tags.map(t => (
          <span key={t} style={{
            fontSize: 'clamp(7px, 1vw, 9px)',
            padding: '1px 6px', borderRadius: 99,
            fontFamily: 'monospace', color,
            background: color + '15',
            border: `1px solid ${color}25`,
          }}>
            {t}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div style={{
        fontFamily: 'monospace',
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
  const [showOG,  setShowOG]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPhase('choice'), 2200)
    return () => clearTimeout(t)
  }, [])

  if (gameStarted && !showOG) return null

  const handleGG = () => {
    if (fading) return
    setShowOG(false)
    setFading(true)
    initAudio()
    setTimeout(() => setGameStarted(true), 700)
  }

  const handleOG = () => setShowOG(true)

  if (showOG) return <TraditionalPortfolio onBack={() => setShowOG(false)} onGG={handleGG} />

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
        fontFamily: 'monospace', fontSize: 'clamp(8px, 1.2vw, 10px)',
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
            fontFamily: '"Courier New", Courier, monospace',
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
            fontFamily: 'monospace',
            fontSize: 'clamp(8px, 1.5vw, 12px)',
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: 'clamp(0.1em, 2vw, 0.28em)',
            textTransform: 'uppercase',
            margin: 'clamp(6px, 1.5vh, 12px) 0 0',
          }}>
            Infrastructure & Cloud Engineer · DevOps
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
            { label: 'Email',    url: 'mailto:asitminz007@gmail.com'     },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noreferrer"
              style={{
                fontFamily: 'monospace',
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

// ─────────────────────────────────────────────────────────────────────────────
// TRADITIONAL PORTFOLIO — OG MODE
// ─────────────────────────────────────────────────────────────────────────────
function TraditionalPortfolio({ onBack, onGG }) {
  const [active, setActive] = useState('about')

  const scrollTo = (id) => {
    setActive(id)
    document.getElementById(`og-${id}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const NAV = ['about', 'experience', 'projects', 'skills', 'contact']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#050301',
      overflowY: 'auto',
      fontFamily: '"Courier New", Courier, monospace',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      }} />

      {/* Sticky nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(5,3,1,0.94)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(240,192,96,0.1)',
        padding: '0 clamp(12px, 4vw, 32px)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        height: 'clamp(44px, 7vh, 52px)',
        gap: 8, flexWrap: 'nowrap',
      }}>
        {/* Left: back + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={onBack} style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'monospace', fontSize: 9,
            letterSpacing: '0.1em', padding: '3px 8px',
            borderRadius: 4, cursor: 'pointer',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(240,192,96,0.4)'; e.target.style.color = '#f0c060' }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.color = 'rgba(255,255,255,0.35)' }}
          >
            ← BACK
          </button>
          <span style={{
            color: 'rgba(240,192,96,0.4)', fontSize: 9,
            letterSpacing: '0.18em', display: 'none',
          }}
            className="nav-label"
          >
            OG_MODE
          </span>
        </div>

        {/* Center: nav links — hidden on very small screens */}
        <div style={{
          display: 'flex', gap: 4,
          overflow: 'hidden', flexShrink: 1,
        }}>
          {NAV.map(s => (
            <button key={s} onClick={() => scrollTo(s)} style={{
              background: active === s ? 'rgba(240,192,96,0.1)' : 'transparent',
              border: `1px solid ${active === s ? 'rgba(240,192,96,0.3)' : 'transparent'}`,
              color: active === s ? '#f0c060' : 'rgba(255,255,255,0.22)',
              fontFamily: 'monospace',
              fontSize: 'clamp(7px, 1.1vw, 9px)',
              letterSpacing: '0.12em', padding: '3px 8px',
              borderRadius: 4, cursor: 'pointer',
              textTransform: 'uppercase', transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}>
              {s}
            </button>
          ))}
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onGG} style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff', fontFamily: 'monospace',
            fontSize: 'clamp(7px, 1.1vw, 9px)',
            letterSpacing: '0.1em',
            padding: 'clamp(3px, 0.5vh, 5px) clamp(6px, 1.5vw, 12px)',
            borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            🎮 GG
          </button>
          <a href="/resume.pdf" download style={{
            background: 'rgba(240,192,96,0.08)',
            border: '1px solid rgba(240,192,96,0.3)',
            color: '#f0c060', fontFamily: 'monospace',
            fontSize: 'clamp(7px, 1.1vw, 9px)',
            letterSpacing: '0.1em',
            padding: 'clamp(3px, 0.5vh, 5px) clamp(6px, 1.5vw, 12px)',
            borderRadius: 4, cursor: 'pointer',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            ↓ CV
          </a>
        </div>
      </nav>

      {/* Content */}
      <div style={{
        maxWidth: 860, margin: '0 auto',
        padding: '0 clamp(12px, 5vw, 24px) 80px',
        position: 'relative', zIndex: 2,
      }}>

        {/* ── HERO ── */}
        <section id="og-about" style={{ padding: 'clamp(32px, 6vh, 72px) 0 clamp(24px, 5vh, 48px)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', flexWrap: 'wrap', gap: 24,
          }}>
            <div style={{ flex: '1 1 280px' }}>
              <div style={{
                fontSize: 10, color: 'rgba(240,192,96,0.4)',
                letterSpacing: '0.28em', marginBottom: 14,
              }}>
                $ whoami
              </div>
              <h1 style={{
                fontSize: 'clamp(28px, 7vw, 58px)',
                fontWeight: 900, color: '#f0c060',
                letterSpacing: '0.1em', margin: 0, lineHeight: 1,
              }}>
                ASIT MINZ
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 'clamp(10px, 1.5vw, 13px)',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                margin: '10px 0 18px', lineHeight: 1.5,
              }}>
                Infrastructure & Cloud Engineer<br />
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85em' }}>
                  DevOps · SRE · Azure · AWS · Terraform
                </span>
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <Pill color="#10b981">✓ AZ-104 Certified</Pill>
                <Pill color="#10b981">✓ ~4 Years Exp</Pill>
                <Pill color="#f0c060">⚡ Open to Roles</Pill>
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 'clamp(10px, 1.4vw, 12px)',
                lineHeight: 1.9, maxWidth: 520,
              }}>
                Senior Engineer at Microland with production experience across Windows/Linux, Azure, VMware, and hybrid infrastructure. Building personal DevOps projects in Go, Python, Terraform, and Docker.
              </p>
            </div>

            {/* Quick contact */}
            <div style={{
              background: 'rgba(240,192,96,0.04)',
              border: '1px solid rgba(240,192,96,0.12)',
              borderRadius: 12, padding: 'clamp(14px, 3vw, 20px)',
              flex: '0 0 auto', minWidth: 200,
            }}>
              <div style={{ fontSize: 9, color: 'rgba(240,192,96,0.35)', letterSpacing: '0.2em', marginBottom: 14 }}>
                $ contact --quick
              </div>
              {[
                { icon: '📍', v: 'Bangalore, India'          },
                { icon: '📧', v: 'asitminz007@gmail.com'     },
                { icon: '📱', v: '+91-7978004721'             },
              ].map(({ icon, v }) => (
                <div key={v} style={{
                  display: 'flex', gap: 8, marginBottom: 8,
                  color: 'rgba(255,255,255,0.38)',
                  fontSize: 'clamp(9px, 1.3vw, 11px)',
                }}>
                  <span>{icon}</span><span style={{ wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                {[
                  { l: 'GitHub',   u: 'https://github.com/Asit0007'      },
                  { l: 'LinkedIn', u: 'https://linkedin.com/in/asitminz' },
                ].map(({ l, u }) => (
                  <a key={l} href={u} target="_blank" rel="noreferrer" style={{
                    flex: 1, textAlign: 'center', padding: '5px 0',
                    background: 'rgba(240,192,96,0.07)',
                    border: '1px solid rgba(240,192,96,0.18)',
                    borderRadius: 5, color: '#f0c060',
                    fontSize: 9, textDecoration: 'none', letterSpacing: '0.1em',
                  }}>
                    {l} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Divider label="experience" />

        {/* ── EXPERIENCE ── */}
        <section id="og-experience" style={{ padding: 'clamp(24px, 5vh, 48px) 0' }}>
          <SectionLabel>$ git log --work</SectionLabel>
          <TimelineItem
            title="Senior Engineer – Wintel & Virtualization"
            company="Microland Limited · Bangalore"
            period="Sep 2022 – Present"
            color="#f59e0b"
            tags={['Azure', 'VMware', 'Windows Server', 'Linux', 'PowerShell']}
            points={[
              'Awarded "Super Squad" Certificate by VP Client Delivery Americas (Jan 2025)',
              'Hybrid Azure + On-Prem environment management for enterprise clients',
              'VMs, VNETs, VDI desktops, VMware golden image management',
              'PowerShell/Bash automation reducing manual effort by 20%',
              'L2/L3 incident resolution — BSOD, CPU/Memory, RDP within SLA',
              'Monthly Commvault DR drills validating RPO/RTO targets',
            ]}
          />
          <TimelineItem
            title="Graduate Engineering Trainee"
            company="Microland Limited · Bangalore"
            period="Mar 2022 – Sep 2022"
            color="#6b7280"
            tags={['Training', 'Networking', 'OS', 'Virtualization']}
            points={[
              'Achieved 80%+ in Computer Networks, OS, and Virtualization',
              'Fast-tracked to full engineer duties within 3 months',
            ]}
          />
        </section>

        <Divider label="projects" />

        {/* ── PROJECTS ── */}
        <section id="og-projects" style={{ padding: 'clamp(24px, 5vh, 48px) 0' }}>
          <SectionLabel>$ ls -la ~/projects</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: 14, marginTop: 20,
          }}>
            <ProjectCard
              title="CloudPulse"
              period="May–Jun 2025"
              color="#0db7ed"
              stack={['Go', 'AWS ECS Fargate', 'Terraform', 'GitHub Actions']}
              points={[
                'Real-time cloud monitoring dashboard with Go REST API',
                'Automated AWS EC2 provisioning via Terraform + CI/CD',
                'HashiCorp Vault, Prometheus + Grafana observability',
              ]}
              url="https://github.com/Asit0007"
            />
            <ProjectCard
              title="QuantBot"
              period="2025"
              color="#f59e0b"
              stack={['Python', 'OCI', 'Docker Compose', 'Cloudflare Tunnel']}
              points={[
                '4-service Docker Compose automated trading system',
                'OCI infrastructure via Terraform: VCN, subnets, compute',
                'Zero-port-exposure HTTPS using Cloudflare Tunnel',
              ]}
              url="https://github.com/Asit0007"
            />
            <ProjectCard
              title="Magento DeployKit"
              period="2024"
              color="#10b981"
              stack={['Bash', 'NGINX', 'PHP-FPM', 'Varnish']}
              points={[
                '7 idempotent Bash scripts for automated deployment',
                '3-layer Varnish/NGINX/PHP-FPM caching architecture',
                'MySQL privilege separation, DigitalOcean production deploy',
              ]}
              url="https://github.com/Asit0007"
            />
          </div>
        </section>

        <Divider label="skills" />

        {/* ── SKILLS ── */}
        <section id="og-skills" style={{ padding: 'clamp(24px, 5vh, 48px) 0' }}>
          <SectionLabel>$ cat ~/.profile</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 16, marginTop: 20,
          }}>
            <SkillGroup title="☁️ Cloud" color="#0db7ed" skills={[
              { name: 'Azure',       level: 92, note: 'AZ-104' },
              { name: 'AWS',         level: 72, note: 'ECS, EC2, S3' },
              { name: 'OCI',         level: 65, note: 'Compute, VCN' },
            ]} />
            <SkillGroup title="🏗️ Infrastructure" color="#f59e0b" skills={[
              { name: 'Terraform',   level: 80, note: 'WIP cert' },
              { name: 'Docker',      level: 85, note: 'Compose, ECR' },
              { name: 'VMware',      level: 88, note: 'vSphere, VDI' },
            ]} />
            <SkillGroup title="💻 OS & Systems" color="#10b981" skills={[
              { name: 'Linux RHEL',  level: 90, note: 'Daily use' },
              { name: 'Windows Srv', level: 92, note: '2016–2022' },
              { name: 'AD / GPO',    level: 85, note: 'WSUS, SCCM' },
            ]} />
            <SkillGroup title="⚙️ Scripting" color="#a855f7" skills={[
              { name: 'PowerShell',  level: 85, note: 'Automation' },
              { name: 'Bash/Shell',  level: 88, note: 'Scripts' },
              { name: 'Python',      level: 75, note: 'Automation' },
            ]} />
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 9, color: 'rgba(240,192,96,0.35)', letterSpacing: '0.2em', marginBottom: 12 }}>
              $ ls ~/certs
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { name: 'Azure Administrator', code: 'AZ-104', color: '#0078d4', done: true  },
                { name: 'Terraform Associate',  code: 'TA-003', color: '#7B42BC', done: false },
                { name: 'Ansible Beginner',     code: 'Udemy',  color: '#ec6600', done: true  },
                { name: 'Postman Essential',    code: 'LinkedIn',color: '#ef5b25', done: true  },
              ].map(({ name, code, color, done }) => (
                <div key={code} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: `${color}10`, border: `1px solid ${color}28`,
                  borderRadius: 7, padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 14px)',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: color, opacity: done ? 1 : 0.3,
                    boxShadow: done ? `0 0 5px ${color}` : 'none',
                  }} />
                  <div>
                    <div style={{ color, fontSize: 10, fontWeight: 700 }}>{code}</div>
                    <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: 9 }}>{name}</div>
                  </div>
                  {!done && (
                    <span style={{
                      fontSize: 7, color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 99, padding: '1px 5px',
                    }}>WIP</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Divider label="contact" />

        {/* ── CONTACT ── */}
        <section id="og-contact" style={{ padding: 'clamp(24px, 5vh, 48px) 0 32px' }}>
          <SectionLabel>$ curl -X POST /api/contact</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 12, marginTop: 20,
          }}>
            {[
              { icon: '📧', label: 'Email',    value: 'asitminz007@gmail.com',  href: 'mailto:asitminz007@gmail.com', color: '#f43f5e' },
              { icon: '💼', label: 'LinkedIn', value: 'in/asitminz',            href: 'https://linkedin.com/in/asitminz', color: '#0ea5e9' },
              { icon: '🐙', label: 'GitHub',   value: 'Asit0007',               href: 'https://github.com/Asit0007', color: '#8b5cf6' },
              { icon: '📱', label: 'Phone',    value: '+91-7978004721',          href: 'tel:+917978004721', color: '#10b981' },
            ].map(({ icon, label, value, href, color }) => (
              <a key={label} href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: 'clamp(10px, 2vw, 14px)',
                  borderRadius: 9,
                  background: `${color}08`,
                  border: `1px solid ${color}1a`,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.borderColor = `${color}40` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}1a` }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 8, letterSpacing: '0.15em' }}>{label}</div>
                  <div style={{ color, fontSize: 'clamp(9px, 1.5vw, 12px)', fontWeight: 700, wordBreak: 'break-all' }}>
                    {value}
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: 'clamp(12px, 2vw, 16px) clamp(14px, 3vw, 20px)',
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 9, display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%',
              background: '#10b981', boxShadow: '0 0 7px #10b981', flexShrink: 0,
            }} />
            <div>
              <div style={{ color: '#10b981', fontSize: 'clamp(10px, 1.5vw, 12px)', fontWeight: 700 }}>
                Available for Cloud & DevOps roles
              </div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 'clamp(9px, 1.3vw, 11px)', marginTop: 2 }}>
                Open to full-time & freelance · Bangalore or remote
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 32, textAlign: 'center', padding: 'clamp(20px, 4vw, 28px)',
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: 10,
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.28)',
              fontSize: 'clamp(10px, 1.4vw, 12px)',
              marginBottom: 14, letterSpacing: '0.08em',
            }}>
              Want the full experience?
            </p>
            <button onClick={onGG} style={{
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.35)',
              color: '#00d4ff', fontFamily: 'monospace',
              fontSize: 'clamp(10px, 1.5vw, 12px)',
              letterSpacing: '0.14em',
              padding: 'clamp(10px, 2vh, 12px) clamp(18px, 4vw, 28px)',
              borderRadius: 7, cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.target.style.background = 'rgba(0,212,255,0.18)'}
              onMouseLeave={e => e.target.style.background = 'rgba(0,212,255,0.1)'}
            >
              🎮 SWITCH TO GG MODE
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Reusable sub-components ───────────────────────────────────────────────────
function Pill({ children, color }) {
  return (
    <span style={{
      fontSize: 'clamp(8px, 1.2vw, 10px)',
      padding: '2px 8px', borderRadius: 99,
      fontFamily: 'monospace', color,
      background: `${color}12`, border: `1px solid ${color}28`,
    }}>
      {children}
    </span>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(240,192,96,0.07)' }} />
      <span style={{
        fontFamily: 'monospace', fontSize: 8,
        color: 'rgba(240,192,96,0.22)', letterSpacing: '0.2em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(240,192,96,0.07)' }} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, color: 'rgba(240,192,96,0.35)',
      letterSpacing: '0.2em', marginBottom: 20,
    }}>
      {children}
    </div>
  )
}

function TimelineItem({ title, company, period, color, tags, points }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: color, boxShadow: `0 0 7px ${color}`,
          flexShrink: 0, marginTop: 3,
        }} />
        <div style={{ flex: 1, width: 1, background: `${color}22`, marginTop: 5 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <h3 style={{
            color, fontFamily: 'monospace',
            fontSize: 'clamp(11px, 1.6vw, 14px)',
            fontWeight: 700, margin: 0, letterSpacing: '0.04em',
          }}>
            {title}
          </h3>
          <span style={{
            color: 'rgba(255,255,255,0.22)',
            fontSize: 'clamp(8px, 1.1vw, 10px)',
            fontFamily: 'monospace',
          }}>
            {period}
          </span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '3px 0 10px' }}>
          {company}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {tags.map(t => <Pill key={t} color={color}>{t}</Pill>)}
        </div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {points.map((p, i) => (
            <li key={i} style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 'clamp(10px, 1.4vw, 12px)',
              lineHeight: 1.7, display: 'flex', gap: 7, marginBottom: 2,
            }}>
              <span style={{ color, flexShrink: 0 }}>▸</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ProjectCard({ title, period, color, stack, points, url }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}08` : 'transparent',
        border: `1px solid ${hov ? color + '38' : color + '15'}`,
        borderRadius: 9, padding: 'clamp(14px, 2.5vw, 18px)',
        transition: 'all 0.2s',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 style={{ color, fontSize: 'clamp(11px, 1.6vw, 14px)', fontWeight: 700, margin: 0 }}>
          {title}
        </h3>
        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9 }}>{period}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {stack.map(s => <Pill key={s} color={color}>{s}</Pill>)}
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {points.map((p, i) => (
          <li key={i} style={{
            color: 'rgba(255,255,255,0.38)',
            fontSize: 'clamp(10px, 1.3vw, 11px)',
            lineHeight: 1.7, display: 'flex', gap: 6, marginBottom: 2,
          }}>
            <span style={{ color, flexShrink: 0 }}>▸</span><span>{p}</span>
          </li>
        ))}
      </ul>
      <a href={url} target="_blank" rel="noreferrer" style={{
        display: 'inline-block', marginTop: 12, fontSize: 9,
        color, borderBottom: `1px solid ${color}35`,
        textDecoration: 'none', letterSpacing: '0.08em',
      }}>
        VIEW ON GITHUB ↗
      </a>
    </div>
  )
}

function SkillGroup({ title, color, skills }) {
  return (
    <div style={{
      background: `${color}05`,
      border: `1px solid ${color}12`,
      borderRadius: 9, padding: 'clamp(12px, 2vw, 16px)',
    }}>
      <div style={{ color, fontSize: 'clamp(9px, 1.3vw, 11px)', fontWeight: 700, marginBottom: 12 }}>
        {title}
      </div>
      {skills.map(({ name, level, note }) => (
        <div key={name} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(9px, 1.2vw, 11px)' }}>
              {name}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{note}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${level}%`,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              borderRadius: 99, boxShadow: `0 0 5px ${color}55`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}