import useGameStore from '../store/useGameStore'

export default function ZoneOverlay() {
  const activeZone = useGameStore((s) => s.activeZone)

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
          border: '1px solid rgba(240,180,80,0.28)',
          borderRadius: 14,
          padding: '14px 30px',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 900,
            letterSpacing: '0.18em', color: '#f0c060',
            textTransform: 'uppercase',
          }}>
            Asit Minz
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>
            Infrastructure & Cloud Engineer · Bangalore
          </p>
          <p style={{
            color: 'rgba(255,220,100,0.35)', fontSize: 10,
            marginTop: 8, letterSpacing: '0.12em',
          }}>
            DRIVE NORTH · EAST · WEST TO EXPLORE
          </p>
        </div>
      </div>
    )
  }

  if (!activeZone?.content) return null

  const { content, color, label } = activeZone

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center',
      paddingRight: 20, zIndex: 30,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 290,
        background: 'rgba(8,4,1,0.85)',
        backdropFilter: 'blur(18px)',
        borderRadius: 14,
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeft: `3px solid ${color}`,
        padding: '18px 18px 18px 20px',
        pointerEvents: 'auto',
        boxShadow: `0 0 50px ${color}20`,
      }}>
        <div style={{
          display: 'inline-block',
          background: `${color}20`,
          border: `1px solid ${color}40`,
          borderRadius: 5, padding: '2px 10px',
          fontSize: 10, color,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          {label}
        </div>

        <h2 style={{
          color: '#fff', fontSize: 14, fontWeight: 700,
          lineHeight: 1.35, marginBottom: 3,
        }}>
          {content.title}
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.32)', fontSize: 11, marginBottom: 13,
        }}>
          {content.company}
        </p>

        <ul style={{
          listStyle: 'none', display: 'flex',
          flexDirection: 'column', gap: 7, marginBottom: 14,
        }}>
          {content.points.map((point, i) => (
            <li key={i} style={{
              display: 'flex', gap: 8,
              color: 'rgba(255,255,255,0.72)',
              fontSize: 11.5, lineHeight: 1.5,
            }}>
              <span style={{ color, flexShrink: 0, marginTop: 2 }}>▸</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {content.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: 10, padding: '2px 8px',
              borderRadius: 99, fontFamily: 'monospace',
              background: `${color}15`, color,
              border: `1px solid ${color}30`,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}