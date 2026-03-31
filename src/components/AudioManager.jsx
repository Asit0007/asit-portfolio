import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useGameStore from '../store/useGameStore'
import { updateEngine, playZoneChime } from '../audio'

// FIX: Remove useEffect entirely.
// useEffect inside a component that lives inside <Canvas> can cause
// the "Hooks can only be used within the Canvas component" error on
// iOS/iPad because React's reconciler runs effects in a different
// timing context than R3F's render loop.
// Instead, track zone changes inside useFrame using a ref — this is
// safe, synchronous, and works correctly on all platforms.

export default function AudioManager() {
  const prevZoneId = useRef(null)

  useFrame(() => {
    const { vehicleBody, gameStarted, activeZone } = useGameStore.getState()

    // ── Engine pitch ────────────────────────────────────────────────────────
    if (vehicleBody && gameStarted) {
      try {
        const lv    = vehicleBody.linvel()
        const speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z)
        updateEngine(speed)
      } catch (_) {}
    }

    // ── Zone entry chime ────────────────────────────────────────────────────
    if (!gameStarted) return
    const id = activeZone?.id ?? null
    if (id !== prevZoneId.current) {
      prevZoneId.current = id
      if (id) playZoneChime()
    }
  })

  return null
}