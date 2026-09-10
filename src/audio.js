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

// ── Tyre-on-gravel bed ─────────────────────────────────────────────────────
// Broadband noise on a permanent loop, with the gain and the filter corner
// ridden from Vehicle.jsx's surface-roughness figure. Synthesising it costs
// one buffer and one filter; a sample would cost a download, and this is a
// 15 MB-budget project (see the payload pass in CLAUDE.md).
//
// Follows the same rule as every other sound here (DESIGN.md 7): loudness
// and brightness scale with the physics, not with the input — faster over
// rougher ground is louder and brighter, and standing still is silent.
function initGravel() {
  if (!ctx) return
  try {
    const frames = Math.floor(ctx.sampleRate * 1.5)
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate)
    const d      = buf.getChannelData(0)
    // White noise alone hisses. Mixing in a one-pole-smoothed copy of it
    // adds low-frequency body underneath the hiss, which is what turns it
    // from radio static into stones under a tyre.
    let smooth = 0
    for (let i = 0; i < frames; i++) {
      const w = Math.random() * 2 - 1
      smooth = 0.6 * smooth + 0.4 * w
      d[i] = w * 0.55 + smooth * 0.85
    }

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop   = true

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 0.7

    const gain = ctx.createGain()
    gain.gain.value = 0

    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
    src.start()
    gravel = { src, lp, gain }
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

export function updateGravel(level = 0, speed = 0) {
  if (!gravel || !ctx) return
  const l = level > 1 ? 1 : level < 0 ? 0 : level
  if (l === 0 && lastGravel === 0) return
  const now = performance.now()
  // A fade to silence always goes through, so the bed can never be left
  // running by a rate limit.
  if (l !== 0 && now - lastGravelAt < GRAVEL_MIN_GAP) return
  lastGravelAt = now
  lastGravel = l
  try {
    const t = ctx.currentTime
    gravel.gain.gain.setTargetAtTime(l * (0.035 + Math.min(speed * 0.004, 0.055)), t, 0.05)
    gravel.lp.frequency.setTargetAtTime(350 + speed * 55 + l * 500, t, 0.08)
    // A touch of pitch with speed, so the grain rate tracks the road rather
    // than sitting at one fixed texture the whole way across a patch.
    gravel.src.playbackRate.setTargetAtTime(0.8 + Math.min(speed / 22, 0.7), t, 0.1)
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