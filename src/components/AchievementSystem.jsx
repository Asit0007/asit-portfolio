import { useEffect, useRef, useState } from 'react'
import useGameStore, { ZONES } from '../store/useGameStore'
import { setVisitedZones, getAchieved, setAchieved } from '../utils/achievementStorage'
import AchievementToast from './AchievementToast'

const TRACKED_ZONES = ['cloud', 'projects', 'hobbies', 'contact']

// Detection + toast queue for the light exploration/achievement layer.
// Deliberately small next to folio-2025's system (no cosmetic unlocks, no
// confetti, no multi-confirm reset) — the goal here is nudging portfolio
// visitors toward all the resume sections, not building a game.
export default function AchievementSystem() {
  const activeZone   = useGameStore((s) => s.activeZone)
  const visitedZones = useGameStore((s) => s.visitedZones)
  const raceState    = useGameStore((s) => s.raceState)
  const bestLapTime  = useGameStore((s) => s.bestLapTime)
  const strikeCount  = useGameStore((s) => s.strikeCount)

  const [queue, setQueue]     = useState([])
  const [current, setCurrent] = useState(null)
  const achievedRef    = useRef(new Set(getAchieved()))
  const isFirstBestRef = useRef(true)

  const unlock = (id, title) => {
    if (achievedRef.current.has(id)) return
    achievedRef.current.add(id)
    setAchieved([...achievedRef.current])
    setQueue((q) => [...q, { id, title }])
  }

  // Zone visits — first time reaching each resume section, plus a bonus
  // once all four have been found.
  useEffect(() => {
    const id = activeZone?.id
    if (!id || id === 'start' || visitedZones.includes(id)) return
    const next = [...visitedZones, id]
    useGameStore.setState({ visitedZones: next })
    setVisitedZones(next)
    unlock(`zone-${id}`, `Found: ${ZONES[id].label}`)
    if (TRACKED_ZONES.every((z) => next.includes(z))) {
      unlock('full-explorer', 'Full Explorer — all sections found')
    }
  }, [activeZone, visitedZones])

  // First lap ever completed.
  useEffect(() => {
    if (raceState === 'finished') unlock('first-lap', 'First Lap Completed')
  }, [raceState])

  // A personal-record lap time — one-time unlock, distinct from
  // LapTimerHUD's "NEW BEST!" inline readout (which re-shows every
  // improvement); this is "you set a record at all", not per-event spam.
  // Skips the initial hydration-from-storage value on mount.
  useEffect(() => {
    if (isFirstBestRef.current) { isFirstBestRef.current = false; return }
    if (bestLapTime != null) unlock('new-best', 'New Best Lap Time')
  }, [bestLapTime])

  // Bowling strike — the in-world "STRIKE!" celebration in Bowling.jsx
  // fires every time (replayable fun); this achievement is one-time only.
  useEffect(() => {
    if (strikeCount > 0) unlock('strike', '🎳 STRIKE!')
  }, [strikeCount])

  // Advance the queue — only one toast on screen at a time.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue((q) => q.slice(1))
    }
  }, [queue, current])

  if (!current) return null
  return <AchievementToast key={current.id} title={current.title} onDone={() => setCurrent(null)} />
}
