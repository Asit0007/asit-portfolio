import { useState, useEffect, useRef } from 'react'

export function isMobileDevice() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent)
}

// The one place the tier boundaries live, so the opening measurement and the
// watchdog below can never drift apart.
function tierForFps(fps) {
  return fps > 50 ? 2 : fps > 30 ? 1 : 0
}

// Let the first render burst, the reveal transition and the initial physics
// settle pass before believing anything the clock says.
const SETTLE_MS     = 1500
const WARMUP_FRAMES = 20
const FIRST_SAMPLE  = 90

// ── Watchdog ────────────────────────────────────────────────────────────────
// The opening measurement used to be the whole story: sample once, pick a
// tier, never look again. That is fine when it guesses right and unfixable
// when it guesses wrong — a machine handed tier 2 it cannot sustain stayed
// there for the rest of the visit, and the only cure was for the visitor to
// reload and hope the next roll of the dice went better.
//
// So the sampling never stops now. If the frame rate settles into a band
// that would have chosen a LOWER tier than the one in use, the tier steps
// down and the world thins out to match. That is the actual repair; a
// message asking the visitor to refresh is not, because refreshing changes
// nothing about the GPU, the window size, the battery saver or the twelve
// other tabs that are the usual causes.
//
// It only ever steps DOWN. Recovering upward sounds fairer and behaves far
// worse: quality that climbs back the moment the frame rate improves will
// oscillate around the boundary, and a world that visibly rebuilds itself
// every few seconds is more distracting than one that is simply a notch
// simpler than it could have been.
const WINDOW_FRAMES = 60      // rolling sample, ~1s at 60fps
const CONFIRM_MS    = 3000    // how long a verdict must hold before acting
// A downgrade rebuilds instanced meshes and the gravel heightfields, which
// costs one hitch. Judging performance during that hitch would cascade
// straight down to tier 0.
const COOLDOWN_MS   = 4000

// A gap this long is not a slow frame, it is a stall — an alt-tab, a GC
// pause, a chunk landing, the debugger opening. Feeding it into a frame-rate
// average downgrades machines that are performing perfectly well.
const MAX_SANE_FRAME_MS = 200

// Bottom of the road: already at the simplest tier and still not coping.
// Nothing left to take away, so this is the one case worth telling the
// visitor about, and the useful offer is the plain resume, not a refresh.
const STRUGGLE_FPS = 20
const STRUGGLE_MS  = 6000

// The decision core, pulled out of the effect so it is a plain state machine
// over (fps, now) with no browser in it — which is the only way the timing
// here gets checked, since reproducing a sustained 22 fps in a real browser
// on demand is not something a test can do.
export function createWatchdog(tier) {
  let lowSince = 0
  let strugSince = 0
  let cooldownTill = 0

  return {
    tier,
    downgraded: false,
    struggling: false,

    // Call once the rolling window is full. Returns true if anything changed.
    sample(fps, now) {
      if (now < cooldownTill) return false
      let changed = false

      if (this.tier > 0 && tierForFps(fps) < this.tier) {
        if (!lowSince) lowSince = now
        else if (now - lowSince > CONFIRM_MS) {
          lowSince = 0
          cooldownTill = now + COOLDOWN_MS
          this.tier -= 1
          this.downgraded = true
          changed = true
        }
      } else {
        lowSince = 0
      }

      if (this.tier === 0 && fps < STRUGGLE_FPS) {
        if (!strugSince) strugSince = now
        else if (now - strugSince > STRUGGLE_MS && !this.struggling) {
          this.struggling = true
          changed = true
        }
      } else {
        strugSince = 0
      }

      return changed
    },

    // A downgrade rebuilds instanced meshes and gravel heightfields. Judging
    // performance during that hitch would cascade straight to tier 0.
    hold(now) { cooldownTill = now + COOLDOWN_MS },
  }
}

// Returns { tier, downgraded, struggling }.
//   tier        current quality tier, or null before the first verdict
//   downgraded  the watchdog has stepped the tier down at least once
//   struggling  at the lowest tier and still below STRUGGLE_FPS
//
// `active` gates when sampling starts — pass `gameStarted`. Measuring on
// mount put the whole sample window on top of the boot screen while the 2 MB
// rapier chunk, the GLBs and the first physics steps were all still landing.
// That is load-time jank, not steady-state performance, and a capable
// desktop could be pinned to tier 0 for the rest of the session on the
// strength of it. It also cannot work at all now that the canvas runs
// frameloop="demand" until the game starts: there are no frames to sample
// until `active` flips.
export function usePerformanceTier(active = true) {
  const [tier,       setTier]       = useState(null)
  const [downgraded, setDowngraded] = useState(false)
  const [struggling, setStruggling] = useState(false)

  // Everything the loop mutates lives in refs, so a tier change doesn't tear
  // down and restart the very loop that decided it.
  const raf    = useRef()
  const frames = useRef([])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    // Mobile skips the opening measurement — the UA is a better signal than
    // any 90 frames sampled through a thermal-throttled first second — but
    // still runs the watchdog below, because tier 0 on a weak phone is
    // exactly where the struggling notice earns its keep.
    const mobile = isMobileDevice()
    const dog = createWatchdog(mobile ? 0 : null)
    if (mobile) setTier(0)

    let warmup  = WARMUP_FRAMES
    let opening = mobile ? 0 : FIRST_SAMPLE
    let last    = 0

    const publish = () => {
      setTier(dog.tier)
      setDowngraded(dog.downgraded)
      setStruggling(dog.struggling)
    }

    const start = setTimeout(() => {
      if (cancelled) return

      const measure = (t) => {
        if (cancelled) return
        raf.current = requestAnimationFrame(measure)

        const prev = last
        last = t
        if (!prev) return
        // A backgrounded tab reports one enormous frame, or none at all.
        // Neither says anything about how fast this machine is.
        if (document.hidden) { frames.current.length = 0; return }
        const dt = t - prev
        if (dt > MAX_SANE_FRAME_MS) { frames.current.length = 0; return }
        if (warmup > 0) { warmup--; return }

        const buf = frames.current
        buf.push(dt)
        if (buf.length > WINDOW_FRAMES) buf.shift()
        const fps = () => 1000 / (buf.reduce((a, b) => a + b, 0) / buf.length)

        // ── Opening verdict ──────────────────────────────────────────────
        if (opening > 0) {
          if (--opening === 0) {
            dog.tier = tierForFps(fps())
            dog.hold(t)
            publish()
          }
          return
        }

        if (buf.length < WINDOW_FRAMES) return
        if (dog.sample(fps(), t)) {
          buf.length = 0
          publish()
        }
      }

      raf.current = requestAnimationFrame(measure)
    }, SETTLE_MS)

    return () => {
      cancelled = true
      clearTimeout(start)
      cancelAnimationFrame(raf.current)
    }
  }, [active])

  return { tier, downgraded, struggling }
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
    // Capped at 1.5, not 2. Measured on an M1 against production: the scene
    // is fill-rate bound, not geometry or draw-call bound — at 4.03 MP it
    // ran 49.5 fps, and at 1.52 MP it ran a locked 60 with the same 170ish
    // draw calls and the same 44k triangles. A retina desktop at dpr 2 was
    // therefore never actually hitting 60. Pixels are the budget here, so
    // this is the single highest-leverage number in the file; raise it back
    // to 2 only alongside a real reduction in shaded area.
    dpr:             [1, 1.5],
    fog:             300,
    antialias:       true,
    physicsStep:     1/60,
  },
}
