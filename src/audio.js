import { Howl } from 'howler'

// ── Playlist — add as many files as you want ──────────────────────────────
const PLAYLIST = [
  '/sounds/bg.mp3',
  '/sounds/bg1.mp3',
  '/sounds/bg2.mp3',
  '/sounds/bg3.mp3',
  '/sounds/bg4.mp3',
  '/sounds/bg5.mp3',
  '/sounds/bg6.mp3',
].filter(Boolean)

let ctx         = null
let engine      = null
let gravel      = null
let lastGravel  = -1
let lastGravelAt = 0
let initialized = false
let lastBrake   = 0
let lastCollide = 0
let musicEnabled  = true
let currentTrack  = 0
let currentHowl   = null
let shuffledPlaylist = []

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getTrackDisplayName(src) {
  if (!src) return 'No track'
  const name = src.split('/').pop().replace(/\.(mp3|ogg|wav)$/i, '')
  return name.replace(/[-_]/g, ' ').toUpperCase()
}

export function getCurrentTrackName() {
  return getTrackDisplayName(shuffledPlaylist[currentTrack])
}

export function isMusicPlaying() {
  return musicEnabled && currentHowl?.playing()
}

function playNextTrack() {
  if (!musicEnabled || shuffledPlaylist.length === 0) return
  if (currentHowl) { currentHowl.stop(); currentHowl.unload(); currentHowl = null }
  currentTrack = (currentTrack + 1) % shuffledPlaylist.length
  if (currentTrack === 0) shuffledPlaylist = shuffle([...PLAYLIST])
  loadAndPlay(shuffledPlaylist[currentTrack])
}

function loadAndPlay(src) {
  currentHowl = new Howl({
    src: [src], volume: 0.22,
    // Stream through an <audio> element instead of Howler's default Web
    // Audio path. The default (html5: false) XHRs the whole file as an
    // arraybuffer and runs decodeAudioData over it before a single note
    // plays — our tracks are 3.2-4.5 MB and decode to ~50 MB of PCM, on
    // the main thread, at the exact moment the visitor clicks into the
    // world. Streaming starts near-instantly and decodes incrementally.
    // The SFX below stay on Web Audio, where the low latency matters.
    html5: true,
    onend: playNextTrack,
    onloaderror: () => { console.warn(`Audio: could not load ${src}`); playNextTrack() },
  })
  currentHowl.play()
  // Notify UI of track change
  window.__currentTrack = getTrackDisplayName(src)
}

function startPlaylist() {
  if (!musicEnabled || shuffledPlaylist.length === 0) return
  currentTrack = Math.floor(Math.random() * shuffledPlaylist.length)
  loadAndPlay(shuffledPlaylist[currentTrack])
}

export function initAudio() {
  if (initialized) return
  initialized = true
  shuffledPlaylist = shuffle([...PLAYLIST])

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    osc1.type = 'sawtooth'; osc2.type = 'square'
    osc1.frequency.value = 52; osc2.frequency.value = 104

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'; filter.frequency.value = 320

    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.02

    osc1.connect(filter); osc2.connect(filter)
    filter.connect(gainNode); gainNode.connect(ctx.destination)
    osc1.start(); osc2.start()
    engine = { osc1, osc2, gain: gainNode, filter }
  } catch (_) {}

  initGravel()

  startPlaylist()
}

// ── Tyre-on-gravel ─────────────────────────────────────────────────────────
// Three layers, because a tyre on loose stone is three sounds, not one:
//
//   body    the low roar of the whole contact patch   — lowpassed noise bed
//   grit    the continuous hiss of the fine stuff     — bandpassed noise bed
//   stones  individual pebbles struck and thrown      — scheduled grains
//
// This used to be the body layer alone, and that is why it read as a wash
// rather than as gravel. A noise bed is a TEXTURE, and texture says
// "surface"; what says "stones" is discrete transients, which cannot be got
// out of a looping buffer at any gain or filter setting — the loop has no
// events in it, only colour. So the third layer schedules real ones.
//
// The bed also gave itself away by repeating. A 1.5 s buffer looped under a
// low filter has an audible period — the ear locks onto the same 1.5 s of
// noise coming round again and hears a pulse that isn't in the physics. The
// buffer is longer now, and the two beds read it at unrelated rates so they
// never come round together.
//
// Still synthesis, not samples: one buffer and a handful of filters, where a
// gravel sample would cost a download on a 15 MB budget (see the payload
// pass in CLAUDE.md).
//
// Follows the same rule as every other sound here (DESIGN.md 7): loudness
// and brightness scale with the physics, not with the input — faster over
// rougher ground is louder, brighter and busier, and standing still is
// silent.

// Long enough that the repeat stops being a rhythm. ~750 KB at 48 kHz, once.
const GRAVEL_BED_SECONDS = 4

// Where the thrown stones land in the stereo field, and roughly how big each
// one sounds. Fixed lanes rather than a filter per grain: a grain is then two
// throwaway nodes instead of four, and the pitch/pan pairing is scrambled
// across the lanes so a run of stones doesn't sweep predictably left to right.
const STONE_Q = 1.1
const STONE_LANES = [
  { freq: 1150, pan: -0.72 },
  { freq: 3100, pan: -0.28 },
  { freq: 1750, pan:  0.55 },
  { freq: 4200, pan: -0.50 },
  { freq: 2400, pan:  0.20 },
  { freq: 1400, pan:  0.80 },
]

function noiseBuffer(seconds, shape) {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
  const d = buf.getChannelData(0)
  shape(d, frames)
  return buf
}

function initGravel() {
  if (!ctx) return
  try {
    // White noise alone hisses. Mixing in a one-pole-smoothed copy of it
    // adds low-frequency body underneath the hiss, which is what turns it
    // from radio static into stones under a tyre.
    const bed = noiseBuffer(GRAVEL_BED_SECONDS, (d, frames) => {
      let smooth = 0
      for (let i = 0; i < frames; i++) {
        const w = Math.random() * 2 - 1
        smooth = 0.6 * smooth + 0.4 * w
        d[i] = w * 0.55 + smooth * 0.85
      }
    })

    // Grain source: bright and unsmoothed. These get their weight from the
    // lane filter and their shape from the envelope, so the raw material
    // wants to be as broadband as possible.
    const chip = noiseBuffer(0.25, (d, frames) => {
      for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1
    })

    const layer = (rate, offset, filter) => {
      const src = ctx.createBufferSource()
      src.buffer = bed
      src.loop = true
      src.playbackRate.value = rate
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      // Start each layer at its own point in the buffer, so the two are never
      // reading the same samples even for the first pass.
      src.start(0, offset)
      return { src, gain }
    }

    const bodyLp = ctx.createBiquadFilter()
    bodyLp.type = 'lowpass'; bodyLp.frequency.value = 400; bodyLp.Q.value = 0.7
    const body = layer(1, 0, bodyLp)

    // Deliberately not a whole-number ratio to the body's rate: the point is
    // that the two loops never line up again.
    const gritBp = ctx.createBiquadFilter()
    gritBp.type = 'bandpass'; gritBp.frequency.value = 2200; gritBp.Q.value = 0.75
    const grit = layer(1.37, GRAVEL_BED_SECONDS * 0.41, gritBp)

    // Lanes stay connected for the life of the page; only the grains that
    // pass through them are created and thrown away.
    //
    // Each lane carries a MAKEUP GAIN, and it is not optional. A bandpass
    // passes only its own bandwidth out of the grain's full-spectrum noise,
    // so the narrower the lane the quieter the stone — measured off the
    // running graph, Q 1.9 was throwing away about 84% of every grain's
    // amplitude and putting the stones back underneath the bed they were
    // meant to cut through. sqrt(nyquist / bandwidth) is the amplitude that
    // loss costs, so undoing it here lets the caller's `amp` mean the peak
    // that actually comes out, the same in every lane regardless of where
    // the lane sits.
    const nyquist = ctx.sampleRate / 2
    const lanes = STONE_LANES.map(({ freq, pan }) => {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = freq
      // Also wider than it was. Q 1.9 rang: a stone struck is a click with a
      // hint of pitch, not a tuned pluck.
      bp.Q.value = STONE_Q
      const makeup = ctx.createGain()
      makeup.gain.value = Math.min(Math.sqrt(nyquist / (freq / STONE_Q)), 8)
      bp.connect(makeup)
      let tail = makeup
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner()
        p.pan.value = pan
        makeup.connect(p)
        tail = p
      }
      tail.connect(ctx.destination)
      return bp
    })

    gravel = { body, grit, bodyLp, gritBp, chip, lanes, debt: 0 }
  } catch (_) {}
}

// One pebble. Two throwaway nodes through a permanent lane.
const STONE_MAX_VOICES = 24
let stoneVoices = 0

function playStone(at, amp) {
  if (stoneVoices >= STONE_MAX_VOICES) return
  // Its own try/catch, not the caller's: one grain that fails to schedule
  // must not take the two beds' gain ramps down with it.
  try {
    const { chip, lanes } = gravel
    const lane = lanes[(Math.random() * lanes.length) | 0]
    const dur  = 0.030 + Math.random() * 0.045

    const src = ctx.createBufferSource()
    src.buffer = chip
    // A different slice of the chip each time, and a different rate, so no
    // two stones are the same stone.
    src.playbackRate.value = 0.75 + Math.random() * 0.9
    const g = ctx.createGain()
    // Attack, then decay to a FIFTIETH of the peak rather than to silence.
    //
    // The ratio is what sets an exponential ramp's rate, so ramping all the
    // way down to 0.0001 packs a 60 dB fall into `dur` and the grain is over
    // in about five milliseconds however long `dur` says it is. Measured, it
    // gave a high sample peak on a barely-raised short-window envelope: a
    // click, which is what a burst of static sounds like, not a stone. 34 dB
    // across the same window decays at a rate a struck pebble actually has.
    // The short tail afterwards only exists so the voice reaches silence
    // without a step at its end.
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), at + 0.0015)
    g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002) * 0.02, at + dur)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.008)

    src.connect(g); g.connect(lane)
    src.onended = () => {
      stoneVoices--
      try { src.disconnect(); g.disconnect() } catch (_) {}
    }
    // Counted only once the voice is actually running: incrementing before
    // start() would leak the slot for good if start() threw.
    src.start(at, Math.random() * 0.15, dur + 0.012)
    stoneVoices++
  } catch (_) {}
}

// `level` is 0..1 roughness, `speed` is the car's ground speed. Safe to call
// every frame — it early-outs once the bed has already been faded to silence.
// Rate-limited on purpose. Called from the vehicle's frame loop, this would
// otherwise schedule three AudioParam ramps every frame — 180 a second, on a
// graph whose own time constants are 50-100ms, so 170 of them are describing
// a curve the previous one was already drawing. Every scheduled event is
// also work for the audio thread, and starving that thread produces exactly
// the kind of general "the site feels laggy" that never shows up in a frame
// counter. 20 updates a second is far finer than the ear can follow here.
const GRAVEL_MIN_GAP = 50   // ms

// Stones per second at full roughness. Speed does most of the work: a tyre
// crawling over gravel ticks, and the same tyre at speed roars.
//
// Deliberately SPARSE. The first pass ran these at 34 a second, and measuring
// the output showed why that was wrong: at ~30 ms a grain, thirty-four a
// second keeps about two sounding at all times, and stones that always
// overlap stop being stones — they average back into exactly the wash the
// beds were already providing. Fewer and louder is what reads as individual
// pebbles, and the continuous part of the sound is the beds' job anyway.
const STONE_RATE_BASE  = 1.5
const STONE_RATE_SPEED = 0.65
const STONE_RATE_MAX   = 18

export function updateGravel(level = 0, speed = 0) {
  if (!gravel || !ctx) return
  const l = level > 1 ? 1 : level < 0 ? 0 : level
  if (l === 0 && lastGravel === 0) return
  const now = performance.now()
  // A fade to silence always goes through, so the beds can never be left
  // running by a rate limit.
  if (l !== 0 && now - lastGravelAt < GRAVEL_MIN_GAP) return
  // The gap that just elapsed is also the window the next batch of stones is
  // scheduled into, so the grain rate stays honest whatever the frame rate is
  // doing. Clamped because a backgrounded tab would otherwise come back and
  // dump a second's worth of pebbles into one instant.
  const gapMs = lastGravelAt ? Math.min(now - lastGravelAt, 250) : GRAVEL_MIN_GAP
  lastGravelAt = now
  lastGravel = l
  try {
    const t = ctx.currentTime
    const fast = Math.min(speed / 18, 1)

    // Body: the roar. Dark, and darker still when the car is slow.
    //
    // The two beds are quieter than the old single bed was, on purpose. The
    // budget didn't grow, the balance moved: measured off the running graph,
    // the bed sat at 0.024 RMS while a stone peaked at 0.015-0.039, so the
    // events were UNDER the wash they were supposed to cut through and the
    // whole thing averaged back out to a hiss. Beds down, stones up, same
    // total loudness, completely different sound.
    gravel.body.gain.gain.setTargetAtTime(
      l * (0.018 + Math.min(speed * 0.0022, 0.030)), t, 0.05)
    gravel.bodyLp.frequency.setTargetAtTime(350 + speed * 55 + l * 500, t, 0.08)
    // A touch of pitch with speed, so the texture tracks the road rather
    // than sitting at one fixed grain the whole way across a patch.
    gravel.body.src.playbackRate.setTargetAtTime(0.8 + Math.min(speed / 22, 0.7), t, 0.1)

    // Grit: the fine stuff. This is the band the old single-layer bed had no
    // energy in at all, which is most of why it sounded like wind.
    gravel.grit.gain.gain.setTargetAtTime(
      l * (0.007 + Math.min(speed * 0.0015, 0.019)), t, 0.05)
    gravel.gritBp.frequency.setTargetAtTime(1900 + speed * 95 + l * 400, t, 0.08)
    gravel.grit.src.playbackRate.setTargetAtTime(1.37 + Math.min(speed / 30, 0.5), t, 0.1)

    // Stones. Carried as a fractional debt so a low rate still fires
    // occasionally instead of rounding to nothing every window.
    if (l === 0) { gravel.debt = 0; return }
    const rate = Math.min(l * (STONE_RATE_BASE + speed * STONE_RATE_SPEED), STONE_RATE_MAX)
    gravel.debt += rate * (gapMs / 1000)
    const window = gapMs / 1000
    // Loud enough to be an EVENT against the beds rather than another
    // ingredient in them — several times the bed's RMS at the peak of a
    // grain, which is what a stone hitting a wheel arch actually sounds like.
    const amp = l * (0.030 + fast * 0.070)
    while (gravel.debt >= 1) {
      gravel.debt -= 1
      // Scattered across the window rather than landing on its edges — evenly
      // spaced grains would be a machine-gun, which is a rhythm the road does
      // not have.
      playStone(t + Math.random() * window, amp * (0.5 + Math.random() * 0.8))
    }
  } catch (_) {}
}

export function updateEngine(speed) {
  if (!engine || !ctx) return
  try {
    const freq = 48 + speed * 6.5
    engine.osc1.frequency.setTargetAtTime(freq,     ctx.currentTime, 0.08)
    engine.osc2.frequency.setTargetAtTime(freq * 2, ctx.currentTime, 0.08)
    const vol = 0.015 + Math.min(speed * 0.003, 0.04)
    engine.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.08)
  } catch (_) {}
}

export function playCollision(speed = 5) {
  if (!ctx) return
  const now = Date.now()
  if (now - lastCollide < 250) return
  lastCollide = now
  try {
    const intensity = Math.min(Math.max((speed - 3) / 14, 0), 1)
    if (intensity <= 0) return
    const frames = Math.floor(ctx.sampleRate * 0.2)
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data   = buf.getChannelData(0)
    for (let i = 0; i < frames; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.5)
    const src  = ctx.createBufferSource(); src.buffer = buf
    const lp   = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 250 + intensity * 900
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(intensity * 0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
    src.start()
  } catch (_) {}
}

// Bigger, lower and longer than playCollision: a noise burst under a
// pitch-dropping sine thump. Same synthesis-not-samples rule as the gravel
// bed — a real explosion sample would cost a download on a 15 MB budget.
export function playExplosion() {
  if (!ctx) return
  try {
    const t = ctx.currentTime

    // Body: filtered noise with a fast attack and a long tail.
    const frames = Math.floor(ctx.sampleRate * 0.9)
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate)
    const d      = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.2)
    }
    const src = ctx.createBufferSource(); src.buffer = buf
    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1800, t)
    lp.frequency.exponentialRampToValueAtTime(160, t + 0.7)
    const ng  = ctx.createGain()
    ng.gain.setValueAtTime(0.32, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
    src.connect(lp); lp.connect(ng); ng.connect(ctx.destination)
    src.start(t)

    // Thump: the low end the noise alone can't carry.
    const osc = ctx.createOscillator(); const og = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.35)
    og.gain.setValueAtTime(0.34, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    osc.connect(og); og.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.5)
  } catch (_) {}
}

export function playBrake() {
  if (!ctx) return
  const now = Date.now()
  if (now - lastBrake < 400) return
  lastBrake = now
  try {
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

export function playZoneChime() {
  if (!ctx) return
  try {
    ;[523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.08, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.5)
    })
  } catch (_) {}
}

export function skipTrack() {
  playNextTrack()
}

export function toggleMusic() {
  musicEnabled = !musicEnabled
  if (!musicEnabled) {
    currentHowl?.pause()
  } else {
    if (initialized) {
      if (currentHowl) currentHowl.play()
      else startPlaylist()
    }
  }
  return musicEnabled
}

export function getMusicEnabled() { return musicEnabled }