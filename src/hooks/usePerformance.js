import { useState, useEffect, useRef } from 'react'

export function isMobileDevice() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent)
}

// Measures actual FPS and returns quality tier
// tier 0 = low (mobile/weak), 1 = medium, 2 = high (desktop)
export function usePerformanceTier() {
  const [tier, setTier] = useState(null)
  const frames = useRef([])
  const raf    = useRef()

  useEffect(() => {
    if (isMobileDevice()) { setTier(0); return }

    let count = 0
    const measure = (t) => {
      frames.current.push(t)
      if (frames.current.length > 60) frames.current.shift()
      count++
      if (count > 90) {
        const diffs = []
        for (let i = 1; i < frames.current.length; i++)
          diffs.push(frames.current[i] - frames.current[i-1])
        const avgMs = diffs.reduce((a,b) => a+b, 0) / diffs.length
        const fps   = 1000 / avgMs
        setTier(fps > 50 ? 2 : fps > 30 ? 1 : 0)
        cancelAnimationFrame(raf.current)
        return
      }
      raf.current = requestAnimationFrame(measure)
    }
    raf.current = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return tier
}

export const TIER_CONFIG = {
  0: { // Mobile / weak GPU
    maxTrees:        20,
    maxProps:        6,
    dpr:             [1, 1],
    fog:             80,
    antialias:       false,
    physicsStep:     1/30,
  },
  1: { // Medium
    maxTrees:        50,
    maxProps:        14,
    dpr:             [1, 1.5],
    fog:             150,
    antialias:       false,
    physicsStep:     1/60,
  },
  2: { // High / desktop
    maxTrees:        100,
    maxProps:        22,
    dpr:             [1, 2],
    fog:             300,
    antialias:       true,
    physicsStep:     1/60,
  },
}