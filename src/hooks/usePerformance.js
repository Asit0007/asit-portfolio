import { useState, useEffect, useRef } from 'react'

export function isMobileDevice() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent)
}

// Measures actual FPS and returns quality tier
// tier 0 = low (mobile/weak), 1 = medium, 2 = high (desktop)
//
// `active` gates when sampling starts — pass `gameStarted`. This used to
// measure on mount, which put the whole sample window on top of the boot
// screen while the 2 MB rapier chunk, the GLBs and the first physics steps
// were all still landing. That is load-time jank, not steady-state
// performance, and a capable desktop could be pinned to tier 0 for the rest
// of the session on the strength of it — losing 80% of its trees, its
// antialiasing, and its DPR. It also can't work at all now that the canvas
// runs frameloop="demand" until the game starts: there are no frames to
// sample until `active` flips.
export function usePerformanceTier(active = true) {
  const [tier, setTier] = useState(null)
  const frames = useRef([])
  const raf    = useRef()

  useEffect(() => {
    if (isMobileDevice()) { setTier(0); return }
    if (!active) return

    let cancelled = false

    // Let the first render burst, the reveal transition and the initial
    // physics settle pass before believing anything the clock says.
    const settle = setTimeout(() => {
      if (cancelled) return
      let warmup = 20
      let count  = 0

      const measure = (t) => {
        if (cancelled) return
        if (warmup > 0) { warmup--; raf.current = requestAnimationFrame(measure); return }

        frames.current.push(t)
        if (frames.current.length > 60) frames.current.shift()
        count++

        if (count > 90) {
          const diffs = []
          for (let i = 1; i < frames.current.length; i++)
            diffs.push(frames.current[i] - frames.current[i - 1])
          const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length
          const fps   = 1000 / avgMs
          setTier(fps > 50 ? 2 : fps > 30 ? 1 : 0)
          return
        }
        raf.current = requestAnimationFrame(measure)
      }
      raf.current = requestAnimationFrame(measure)
    }, 1500)

    return () => {
      cancelled = true
      clearTimeout(settle)
      cancelAnimationFrame(raf.current)
    }
  }, [active])

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
