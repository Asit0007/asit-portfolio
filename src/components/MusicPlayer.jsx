import { useState, useEffect } from 'react'
import { toggleMusic, skipTrack, getMusicEnabled } from '../audio'

export default function MusicPlayer() {
  const [playing, setPlaying]   = useState(true)
  const [track,   setTrack]     = useState('')
  const [visible, setVisible]   = useState(false)

  // Poll track name and playing state
  useEffect(() => {
    const id = setInterval(() => {
      setTrack(window.__currentTrack || '')
      setPlaying(getMusicEnabled())
    }, 500)
    return () => clearInterval(id)
  }, [])

  const handleToggle = () => {
    const on = toggleMusic()
    setPlaying(on)
  }

  const handleSkip = () => {
    skipTrack()
    setTimeout(() => setTrack(window.__currentTrack || ''), 200)
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, left: 20,
        zIndex: 35,
        display: 'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Track info — shows on hover */}
      {visible && track && (
        <div style={{
          background: 'rgba(8,4,0,0.82)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(240,180,80,0.2)',
          borderRadius: 8,
          padding: '5px 10px',
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'rgba(240,192,96,0.8)',
          letterSpacing: '0.08em',
          maxWidth: 160,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}>
          {playing ? '♪' : '—'} {track}
        </div>
      )}

      {/* Skip button */}
      {visible && (
        <button
          onClick={handleSkip}
          title="Skip track"
          style={{
            width: 32, height: 32,
            background: 'rgba(8,4,0,0.75)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(240,180,80,0.18)',
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(240,192,96,0.6)', fontSize: 12,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,192,96,0.5)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(240,180,80,0.18)'}
        >
          ⏭
        </button>
      )}

      {/* Play/Pause button — always visible */}
      <button
        onClick={handleToggle}
        title={playing ? 'Mute music (M)' : 'Play music (M)'}
        style={{
          width: 36, height: 36,
          background: playing
            ? 'rgba(240,192,96,0.1)'
            : 'rgba(8,4,0,0.75)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${playing
            ? 'rgba(240,192,96,0.35)'
            : 'rgba(240,180,80,0.18)'}`,
          borderRadius: 9, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,192,96,0.55)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = playing
          ? 'rgba(240,192,96,0.35)'
          : 'rgba(240,180,80,0.18)'}
      >
        {playing ? '🎵' : '🔇'}
      </button>
    </div>
  )
}