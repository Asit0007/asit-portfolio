import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useGameStore from '../store/useGameStore'
import { updateEngine, playZoneChime } from '../audio'

export default function AudioManager() {
  const vehicleBody = useGameStore((s) => s.vehicleBody)
  const gameStarted = useGameStore((s) => s.gameStarted)
  const activeZone  = useGameStore((s) => s.activeZone)
  const prevZoneId  = useRef(null)

  // Zone entry chime
  useEffect(() => {
    if (!gameStarted) return
    const id = activeZone?.id
    if (id && id !== prevZoneId.current) {
      prevZoneId.current = id
      playZoneChime()
    } else if (!id) {
      prevZoneId.current = null
    }
  }, [activeZone, gameStarted])

  // Engine pitch — runs every frame
  useFrame(() => {
    if (!vehicleBody || !gameStarted) return
    try {
      const lv = vehicleBody.linvel()
      const speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z)
      updateEngine(speed)
    } catch (_) {}
  })

  return null
}