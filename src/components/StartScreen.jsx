import { useState, useEffect } from 'react'
import useGameStore from '../store/useGameStore'
import { initAudio } from '../audio'

// Terminal typewriter hook
function useTypewriter(text, speed = 28, startDelay = 0) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    let i = 0
    setDisplayed('')
    setDone(false)
    const delay = setTimeout(() => {
      const id = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) { clearInterval(id); setDone(true) }
      }, speed)
      return () => clearInterval(id)
    }, startDelay)
    return () => clearTimeout(delay)
  }, [text, speed, startDelay])
  return { displayed, done }
}

const BOOT_LINES = [
  { text: '> initializing portfolio_v2.0 ...', delay: 0,    color: '#666' },
  { text: '> node: bangalore-prod-01',          delay: 500,  color: '#555' },
  { text: '> azure: connected ✓',               delay: 900,  color: '#10b981' },
  { text: '> aws: connected ✓',                 delay: 1200, color: '#10b981' },
  { text: '> terraform: ready ✓',               delay: 1500, color: '#10b981' },
  { text: '> select boot mode:',                delay: 2000, color: '#f0c060' },
]

function BootLine({ text, delay, color }) {
  const [show, setShow] = useState(false)
  const [typed, setTyped] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(true)
      let i = 0
      const id = setInterval(() => {
        i++
        setTyped(text.slice(0, i))
        if (i >= text.length) clearInterval(id)
      }, 22)
      return () => clearInterval(id)
    }, delay)
    return () => clearTimeout(t)
  }, [text, delay])
  if (!show) return null
  return (
    <div style={{ color, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.04em', lineHeight: 1.8 }}>
      {typed}
    </div>
  )
}

// Scanline overlay
const scanlineStyle = {
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
}

export default function StartScreen() {
  const gameStarted    = useGameStore((s) => s.gameStarted)
  const setGameStarted = useGameStore((s) => s.setGameStarted)
  const [phase, setPhase]           = useState('boot')   // boot → choice → fading
  const [fading, setFading]         = useState(false)
  const [hoveredCard, setHoveredCard] = useState(null)
  const [showOG, setShowOG]         = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPhase('choice'), 2800)
    return () => clearTimeout(t)
  }, [])

  if (gameStarted && !showOG) return null

  const handleGG = () => {
    if (fading) return
    setFading(true)
    initAudio()
    setTimeout(() => setGameStarted(true), 700)
  }

  const handleOG = () => setShowOG(true)

  if (showOG) {
    return <TraditionalPortfolio onBack={() => setShowOG(false)} onGG={handleGG} />
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#050301',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.7s ease',
      overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={scanlineStyle} />

      {/* Ambient glow top */}
      <div style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(240,192,96,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 2,
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}>

        {/* Top identifier */}
        <div style={{
          position: 'absolute', top: 28, left: 32,
          fontFamily: 'monospace', fontSize: 10,
          color: 'rgba(240,192,96,0.25)', letterSpacing: '0.2em',
        }}>
          ASIT_MINZ_PORTFOLIO // v2.0
        </div>
        <div style={{
          position: 'absolute', top: 28, right: 32,
          fontFamily: 'monospace', fontSize: 10,
          color: 'rgba(240,192,96,0.25)', letterSpacing: '0.12em',
        }}>
          BANGALORE · INDIA
        </div>

        {/* Boot sequence */}
        <div style={{
          marginBottom: 48, minHeight: 132,
          opacity: phase === 'choice' ? 0.4 : 1,
          transition: 'opacity 1s ease',
        }}>
          {BOOT_LINES.map((line, i) => (
            <BootLine key={i} {...line} />
          ))}
        </div>

        {/* Name */}
        <div style={{
          textAlign: 'center', marginBottom: 14,
          opacity: phase === 'choice' ? 1 : 0,
          transform: phase === 'choice' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
        }}>
          <h1 style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 'clamp(42px, 8vw, 88px)',
            fontWeight: 900,
            letterSpacing: '0.18em',
            color: '#f0c060',
            margin: 0, lineHeight: 1,
            textShadow: '0 0 40px rgba(240,192,96,0.3)',
          }}>
            ASIT MINZ
          </h1>
          <p style={{
            fontFamily: 'monospace',
            fontSize: 'clamp(9px, 1.3vw, 12px)',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            margin: '10px 0 0',
          }}>
            Infrastructure & Cloud Engineer · DevOps · Bangalore
          </p>
        </div>

        {/* Divider */}
        <div style={{
          width: 48, height: 1,
          background: 'rgba(240,192,96,0.2)',
          margin: '0 auto 36px',
          opacity: phase === 'choice' ? 1 : 0,
          transition: 'opacity 0.6s ease 0.4s',
        }} />

        {/* DUAL BOOT CARDS */}
        <div style={{
          display: 'flex', gap: 16,
          opacity: phase === 'choice' ? 1 : 0,
          transform: phase === 'choice' ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>

          {/* ── GG CARD ── */}
          <div
            onClick={handleGG}
            onMouseEnter={() => setHoveredCard('gg')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              width: 220, cursor: 'pointer',
              background: hoveredCard === 'gg'
                ? 'rgba(0,212,255,0.08)'
                : 'rgba(0,212,255,0.03)',
              border: `1px solid ${hoveredCard === 'gg'
                ? 'rgba(0,212,255,0.5)'
                : 'rgba(0,212,255,0.18)'}`,
              borderRadius: 12,
              padding: '28px 24px 24px',
              transition: 'all 0.2s ease',
              transform: hoveredCard === 'gg' ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow: hoveredCard === 'gg'
                ? '0 12px 40px rgba(0,212,255,0.12)'
                : 'none',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Top glow on hover */}
            {hoveredCard === 'gg' && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.8), transparent)',
              }} />
            )}

            <div style={{ fontSize: 32, marginBottom: 14, display: 'block' }}>🎮</div>
            <div style={{
              fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
              color: '#00d4ff', letterSpacing: '0.18em', marginBottom: 8,
            }}>
              GG MODE
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 10,
              color: 'rgba(0,212,255,0.55)', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              Interactive 3D Experience
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.4)', fontSize: 12,
              lineHeight: 1.6, margin: '0 0 20px', fontFamily: 'monospace',
            }}>
              Drive through a gamified world. Explore zones, knock over letters, discover easter eggs.
            </p>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 5,
            }}>
              {['3D World', 'Physics', 'Audio', 'Fun'].map(t => (
                <span key={t} style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 99,
                  fontFamily: 'monospace', color: '#00d4ff',
                  background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  letterSpacing: '0.06em',
                }}>{t}</span>
              ))}
            </div>
            <div style={{
              marginTop: 20, fontSize: 11, fontFamily: 'monospace',
              color: hoveredCard === 'gg' ? '#00d4ff' : 'rgba(0,212,255,0.4)',
              letterSpacing: '0.1em', transition: 'color 0.2s',
            }}>
              {hoveredCard === 'gg' ? '▶ CLICK TO ENTER' : '▷ CLICK TO ENTER'}
            </div>
          </div>

          {/* ── OG CARD ── */}
          <div
            onClick={handleOG}
            onMouseEnter={() => setHoveredCard('og')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              width: 220, cursor: 'pointer',
              background: hoveredCard === 'og'
                ? 'rgba(240,192,96,0.08)'
                : 'rgba(240,192,96,0.03)',
              border: `1px solid ${hoveredCard === 'og'
                ? 'rgba(240,192,96,0.5)'
                : 'rgba(240,192,96,0.18)'}`,
              borderRadius: 12,
              padding: '28px 24px 24px',
              transition: 'all 0.2s ease',
              transform: hoveredCard === 'og' ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow: hoveredCard === 'og'
                ? '0 12px 40px rgba(240,192,96,0.1)'
                : 'none',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {hoveredCard === 'og' && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(240,192,96,0.8), transparent)',
              }} />
            )}

            <div style={{ fontSize: 32, marginBottom: 14 }}>📋</div>
            <div style={{
              fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
              color: '#f0c060', letterSpacing: '0.18em', marginBottom: 8,
            }}>
              OG MODE
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 10,
              color: 'rgba(240,192,96,0.55)', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              Professional Portfolio
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.4)', fontSize: 12,
              lineHeight: 1.6, margin: '0 0 20px', fontFamily: 'monospace',
            }}>
              Resume, experience, projects, skills. Everything recruiters need in under 60 seconds.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {['Resume', 'Projects', 'Skills', 'Contact'].map(t => (
                <span key={t} style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 99,
                  fontFamily: 'monospace', color: '#f0c060',
                  background: 'rgba(240,192,96,0.1)',
                  border: '1px solid rgba(240,192,96,0.2)',
                  letterSpacing: '0.06em',
                }}>{t}</span>
              ))}
            </div>
            <div style={{
              marginTop: 20, fontSize: 11, fontFamily: 'monospace',
              color: hoveredCard === 'og' ? '#f0c060' : 'rgba(240,192,96,0.4)',
              letterSpacing: '0.1em', transition: 'color 0.2s',
            }}>
              {hoveredCard === 'og' ? '▶ CLICK TO VIEW' : '▷ CLICK TO VIEW'}
            </div>
          </div>
        </div>

        {/* Links */}
        <div style={{
          position: 'absolute', bottom: 24,
          display: 'flex', gap: 24,
          opacity: phase === 'choice' ? 1 : 0,
          transition: 'opacity 0.6s ease 0.8s',
        }}>
          {[
            { label: 'GitHub',   url: 'https://github.com/Asit0007'         },
            { label: 'LinkedIn', url: 'https://linkedin.com/in/asitminz'    },
            { label: 'Email',    url: 'mailto:asitminz007@gmail.com'        },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noreferrer"
              style={{
                fontFamily: 'monospace', fontSize: 10,
                color: 'rgba(255,255,255,0.2)',
                letterSpacing: '0.14em', textDecoration: 'none',
                textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'rgba(240,192,96,0.7)'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.2)'}
            >
              {label}
            </a>
          ))}
        </div>

      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TRADITIONAL PORTFOLIO — OG MODE
// ────────────────────────────────────────────────────────────────────────────
function TraditionalPortfolio({ onBack, onGG }) {
  const [activeSection, setActiveSection] = useState('about')

  const scrollTo = (id) => {
    setActiveSection(id)
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
      {/* Subtle scanlines */}
      <div style={scanlineStyle} />

      {/* ── STICKY NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(5,3,1,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(240,192,96,0.1)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
              fontSize: 10, letterSpacing: '0.1em', padding: '4px 10px',
              borderRadius: 5, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(240,192,96,0.4)'; e.target.style.color = '#f0c060' }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.color = 'rgba(255,255,255,0.4)' }}
          >
            ← BACK
          </button>
          <span style={{ color: 'rgba(240,192,96,0.5)', fontSize: 10, letterSpacing: '0.2em' }}>
            ASIT_MINZ // OG_MODE
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {NAV.map(s => (
            <button key={s} onClick={() => scrollTo(s)} style={{
              background: activeSection === s ? 'rgba(240,192,96,0.1)' : 'transparent',
              border: `1px solid ${activeSection === s ? 'rgba(240,192,96,0.3)' : 'transparent'}`,
              color: activeSection === s ? '#f0c060' : 'rgba(255,255,255,0.25)',
              fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
              padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
              textTransform: 'uppercase', transition: 'all 0.2s',
            }}>{s}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onGG}
            style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff', fontFamily: 'monospace',
              fontSize: 9, letterSpacing: '0.12em', padding: '5px 12px',
              borderRadius: 5, cursor: 'pointer',
            }}
          >
            🎮 GG MODE
          </button>
          
          <a
            href="/resume.pdf"
            download
            style={{
              background: 'rgba(240,192,96,0.1)',
              border: '1px solid rgba(240,192,96,0.3)',
              color: '#f0c060', fontFamily: 'monospace',
              fontSize: 9, letterSpacing: '0.12em', padding: '5px 12px',
              borderRadius: 5, cursor: 'pointer', textDecoration: 'none',
            }}
          >
            ↓ RESUME
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── HERO ── */}
        <section id="og-about" style={{ padding: '72px 0 56px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', flexWrap: 'wrap', gap: 32,
          }}>
            <div>
              <div style={{
                fontSize: 10, color: 'rgba(240,192,96,0.5)',
                letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 16,
              }}>
                $ whoami
              </div>
              <h1 style={{
                fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900,
                color: '#f0c060', letterSpacing: '0.12em',
                margin: 0, lineHeight: 1,
              }}>
                ASIT MINZ
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.5)', fontSize: 13,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                margin: '12px 0 20px', lineHeight: 1.4,
              }}>
                Infrastructure & Cloud Engineer<br />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                  DevOps · SRE · Azure · AWS · Terraform
                </span>
              </p>

              {/* Status badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill color="#10b981">✓ AZ-104 Certified</Pill>
                <Pill color="#10b981">✓ ~4 Years Experience</Pill>
                <Pill color="#f0c060">⚡ Open to Opportunities</Pill>
              </div>

              <p style={{
                color: 'rgba(255,255,255,0.45)', fontSize: 12,
                lineHeight: 1.9, maxWidth: 520, marginTop: 24,
              }}>
                Senior Engineer at Microland with hands-on production experience across
                Windows/Linux server administration, Azure cloud, VMware virtualization,
                and hybrid infrastructure. Building personal DevOps projects in Go, Python,
                Terraform, and Docker. Actively transitioning toward Cloud/DevOps Engineer roles.
              </p>
            </div>

            {/* Quick contact sidebar */}
            <div style={{
              background: 'rgba(240,192,96,0.04)',
              border: '1px solid rgba(240,192,96,0.12)',
              borderRadius: 12, padding: '20px 24px', minWidth: 220,
            }}>
              <div style={{
                fontSize: 9, color: 'rgba(240,192,96,0.4)',
                letterSpacing: '0.2em', marginBottom: 16,
              }}>
                $ contact --quick
              </div>
              {[
                { icon: '📍', label: 'Bangalore, India'          },
                { icon: '📧', label: 'asitminz007@gmail.com'     },
                { icon: '📱', label: '+91-7978004721'             },
              ].map(({ icon, label }) => (
                <div key={label} style={{
                  display: 'flex', gap: 10, marginBottom: 10,
                  color: 'rgba(255,255,255,0.45)', fontSize: 11,
                }}>
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                {[
                  { l: 'GitHub',   u: 'https://github.com/Asit0007'       },
                  { l: 'LinkedIn', u: 'https://linkedin.com/in/asitminz'  },
                ].map(({ l, u }) => (
                  <a key={l} href={u} target="_blank" rel="noreferrer" style={{
                    flex: 1, textAlign: 'center', padding: '6px 0',
                    background: 'rgba(240,192,96,0.08)',
                    border: '1px solid rgba(240,192,96,0.2)',
                    borderRadius: 6, color: '#f0c060',
                    fontSize: 9, textDecoration: 'none',
                    letterSpacing: '0.1em',
                  }}>{l} ↗</a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Divider label="experience" />

        {/* ── EXPERIENCE ── */}
        <section id="og-experience" style={{ padding: '48px 0' }}>
          <SectionLabel>$ git log --work</SectionLabel>

          <TimelineItem
            title="Senior Engineer – Wintel & Virtualization"
            company="Microland Limited"
            location="Bangalore"
            period="Sep 2022 – Present"
            color="#f59e0b"
            tags={['Azure', 'VMware', 'Windows Server', 'Linux', 'PowerShell']}
            points={[
              'Awarded "Super Squad" Certificate by VP Client Delivery Americas (Jan 2025)',
              'Administering hybrid Azure + On-Prem environments for enterprise clients ensuring HA and compliance',
              'Provisioned VMs, VNETs, VDI desktops; maintained VMware golden images for non-persistent pools',
              'Resolved L2/L3 incidents — BSOD, high CPU/memory, RDP failures within SLA',
              'Automated server health checks and patch validation via PowerShell/Bash, reducing manual effort by 20%',
              'Monthly Commvault DR drills validating RPO/RTO targets',
            ]}
          />

          <TimelineItem
            title="Graduate Engineering Trainee"
            company="Microland Limited"
            location="Bangalore"
            period="Mar 2022 – Sep 2022"
            color="#6b7280"
            tags={['Training', 'Networks', 'OS', 'Virtualization']}
            points={[
              'Achieved 80%+ across Computer Networks, Operating Systems, and Virtualization training',
              'Fast-tracked to full engineer duties within 3 months',
            ]}
          />
        </section>

        <Divider label="projects" />

        {/* ── PROJECTS ── */}
        <section id="og-projects" style={{ padding: '48px 0' }}>
          <SectionLabel>$ ls -la ~/projects</SectionLabel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24 }}>
            <ProjectCard
              title="CloudPulse"
              period="May 2025 – Jun 2025"
              color="#0db7ed"
              stack={['Go', 'AWS ECS Fargate', 'Terraform', 'GitHub Actions', 'Docker']}
              points={[
                'Real-time cloud monitoring dashboard with Go REST API backend',
                'Automated AWS EC2 provisioning via Terraform + GitHub Actions CI/CD',
                'HashiCorp Vault KV v2 for secrets, Prometheus + Grafana for metrics',
              ]}
              url="https://github.com/Asit0007"
            />
            <ProjectCard
              title="QuantBot"
              period="2025"
              color="#f59e0b"
              stack={['Python', 'OCI Terraform', 'Docker Compose', 'Cloudflare Tunnel']}
              points={[
                'Automated trading system with 4-service Docker Compose stack',
                'OCI infrastructure: VCN, subnets, Route Tables via Terraform',
                'Zero-port-exposure HTTPS using Cloudflare Tunnel',
              ]}
              url="https://github.com/Asit0007"
            />
            <ProjectCard
              title="Magento DeployKit"
              period="2024"
              color="#10b981"
              stack={['Bash', 'NGINX', 'PHP-FPM', 'Varnish', 'DigitalOcean']}
              points={[
                '7 idempotent Bash scripts for Magento 2 deployment automation',
                '3-layer Varnish/NGINX/PHP-FPM caching architecture',
                'MySQL privilege separation, end-to-end DigitalOcean deployment',
              ]}
              url="https://github.com/Asit0007"
            />
          </div>
        </section>

        <Divider label="skills" />

        {/* ── SKILLS ── */}
        <section id="og-skills" style={{ padding: '48px 0' }}>
          <SectionLabel>$ cat ~/.profile</SectionLabel>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20, marginTop: 24,
          }}>
            <SkillGroup title="☁️ Cloud Platforms" color="#0db7ed" skills={[
              { name: 'Microsoft Azure', level: 92, note: 'AZ-104 Certified' },
              { name: 'AWS',             level: 72, note: 'ECS, EC2, S3, CloudWatch' },
              { name: 'OCI',             level: 65, note: 'Compute, VCN, Terraform' },
              { name: 'DigitalOcean',    level: 68, note: 'Droplets, Spaces' },
            ]} />
            <SkillGroup title="🏗️ Infrastructure" color="#f59e0b" skills={[
              { name: 'Terraform',  level: 80, note: 'Associate WIP' },
              { name: 'Docker',     level: 85, note: 'Compose, ECR' },
              { name: 'VMware',     level: 88, note: 'vSphere, VDI' },
              { name: 'Ansible',    level: 60, note: 'Playbooks' },
            ]} />
            <SkillGroup title="💻 Operating Systems" color="#10b981" skills={[
              { name: 'Linux (RHEL/Ubuntu)', level: 90, note: 'Daily driver' },
              { name: 'Windows Server',      level: 92, note: '2016/2019/2022' },
              { name: 'Active Directory',    level: 85, note: 'GPO, WSUS' },
            ]} />
            <SkillGroup title="⚙️ Scripting & Dev" color="#a855f7" skills={[
              { name: 'PowerShell', level: 85, note: 'Automation' },
              { name: 'Bash/Shell', level: 88, note: 'Scripting' },
              { name: 'Python',     level: 75, note: 'Automation, ML' },
              { name: 'Go',         level: 65, note: 'REST APIs' },
            ]} />
          </div>

          {/* Certifications */}
          <div style={{ marginTop: 32 }}>
            <div style={{
              fontSize: 10, color: 'rgba(240,192,96,0.4)',
              letterSpacing: '0.2em', marginBottom: 14,
            }}>
              $ ls ~/certifications
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { name: 'Azure Administrator Associate', code: 'AZ-104', color: '#0078d4', done: true },
                { name: 'Terraform Associate',           code: 'TA-003', color: '#7B42BC', done: false },
                { name: 'Ansible for Beginners',        code: 'Udemy',  color: '#ec6600', done: true },
                { name: 'Postman Essential',            code: 'LinkedIn', color: '#ef5b25', done: true },
              ].map(({ name, code, color, done }) => (
                <div key={code} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: `${color}12`,
                  border: `1px solid ${color}30`,
                  borderRadius: 8, padding: '8px 14px',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: color,
                    boxShadow: done ? `0 0 6px ${color}` : 'none',
                    opacity: done ? 1 : 0.4,
                  }} />
                  <div>
                    <div style={{ color, fontSize: 11, fontWeight: 700 }}>{code}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{name}</div>
                  </div>
                  {!done && (
                    <span style={{
                      fontSize: 8, color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 99, padding: '1px 6px',
                    }}>IN PROGRESS</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Divider label="contact" />

        {/* ── CONTACT ── */}
        <section id="og-contact" style={{ padding: '48px 0 32px' }}>
          <SectionLabel>$ curl -X POST /api/contact</SectionLabel>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24,
          }}>
            {[
              { icon: '📧', label: 'Email',    value: 'asitminz007@gmail.com', href: 'mailto:asitminz007@gmail.com', color: '#f43f5e' },
              { icon: '💼', label: 'LinkedIn', value: 'linkedin.com/in/asitminz', href: 'https://linkedin.com/in/asitminz', color: '#0ea5e9' },
              { icon: '🐙', label: 'GitHub',   value: 'github.com/Asit0007', href: 'https://github.com/Asit0007', color: '#8b5cf6' },
              { icon: '📱', label: 'Phone',    value: '+91-7978004721', href: 'tel:+917978004721', color: '#10b981' },
            ].map(({ icon, label, value, href, color }) => (
              <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer" style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '14px 16px', borderRadius: 10,
                  background: `${color}08`,
                  border: `1px solid ${color}20`,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.borderColor = `${color}45` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}20` }}
              >
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.15em' }}>{label}</div>
                  <div style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Availability */}
          <div style={{
            marginTop: 24, padding: '16px 20px',
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 8px #10b981', flexShrink: 0,
            }} />
            <div>
              <div style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                Available for Cloud & DevOps roles
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
                Open to full-time positions and freelance gigs · Bangalore or remote
              </div>
            </div>
          </div>

          {/* Enter GG mode CTA */}
          <div style={{
            marginTop: 40, textAlign: 'center', padding: '32px',
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: 12,
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.3)', fontSize: 12,
              marginBottom: 16, letterSpacing: '0.1em',
            }}>
              Want the full experience?
            </p>
            <button
              onClick={onGG}
              style={{
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.4)',
                color: '#00d4ff', fontFamily: 'monospace',
                fontSize: 12, letterSpacing: '0.15em',
                padding: '12px 28px', borderRadius: 8,
                cursor: 'pointer', transition: 'all 0.2s',
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

// ── Small reusable components ─────────────────────────────────────────────────
function Pill({ children, color }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 10px', borderRadius: 99,
      fontFamily: 'monospace', color,
      background: `${color}14`, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function Divider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(240,192,96,0.08)' }} />
      <span style={{
        fontFamily: 'monospace', fontSize: 9,
        color: 'rgba(240,192,96,0.25)', letterSpacing: '0.2em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(240,192,96,0.08)' }} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: 'rgba(240,192,96,0.4)',
      letterSpacing: '0.2em', marginBottom: 24,
    }}>
      {children}
    </div>
  )
}

function TimelineItem({ title, company, location, period, color, tags, points }) {
  return (
    <div style={{
      display: 'flex', gap: 20, marginBottom: 32,
    }}>
      {/* Timeline bar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: color,
          boxShadow: `0 0 8px ${color}`, flexShrink: 0, marginTop: 4,
        }} />
        <div style={{ flex: 1, width: 1, background: `${color}25`, marginTop: 6 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <h3 style={{
            color, fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
            margin: 0, letterSpacing: '0.06em',
          }}>{title}</h3>
          <span style={{
            color: 'rgba(255,255,255,0.25)', fontSize: 10,
            fontFamily: 'monospace', letterSpacing: '0.1em',
          }}>{period}</span>
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.35)', fontSize: 11,
          margin: '3px 0 12px', letterSpacing: '0.08em',
        }}>
          {company} · {location}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {tags.map(t => <Pill key={t} color={color}>{t}</Pill>)}
        </div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {points.map((p, i) => (
            <li key={i} style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 11.5,
              lineHeight: 1.7, display: 'flex', gap: 8, marginBottom: 3,
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
        border: `1px solid ${hov ? color + '40' : color + '18'}`,
        borderRadius: 10, padding: '18px 16px',
        transition: 'all 0.2s', transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hov ? `0 8px 30px ${color}10` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 style={{ color, fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: '0.06em' }}>
          {title}
        </h3>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}>
          {period}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {stack.map(s => <Pill key={s} color={color}>{s}</Pill>)}
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {points.map((p, i) => (
          <li key={i} style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 11,
            lineHeight: 1.7, display: 'flex', gap: 7, marginBottom: 3,
          }}>
            <span style={{ color, flexShrink: 0 }}>▸</span><span>{p}</span>
          </li>
        ))}
      </ul>
      <a href={url} target="_blank" rel="noreferrer" style={{
        display: 'inline-block', marginTop: 14, fontSize: 9,
        color, borderBottom: `1px solid ${color}40`,
        textDecoration: 'none', letterSpacing: '0.1em',
      }}>
        VIEW ON GITHUB ↗
      </a>
    </div>
  )
}

function SkillGroup({ title, color, skills }) {
  return (
    <div style={{
      background: `${color}06`,
      border: `1px solid ${color}15`,
      borderRadius: 10, padding: '16px',
    }}>
      <div style={{
        color, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.1em', marginBottom: 14,
      }}>
        {title}
      </div>
      {skills.map(({ name, level, note }) => (
        <div key={name} style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 5,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{name}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{note}</span>
          </div>
          <div style={{
            height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${level}%`,
              background: `linear-gradient(90deg, ${color}aa, ${color})`,
              borderRadius: 99,
              boxShadow: `0 0 6px ${color}60`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}