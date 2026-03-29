import { Howl } from 'howler'

let ctx         = null
let engine      = null
let bgMusic     = null
let initialized = false
let lastBrake   = 0
let lastCollide = 0

export function initAudio() {
  if (initialized) return
  initialized = true

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()

    // ── Engine: two layered oscillators ────────────────────────────────────
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc2.type = 'square'
    osc1.frequency.value = 52
    osc2.frequency.value = 104

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320

    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.025

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc1.start()
    osc2.start()
    engine = { osc1, osc2, gain: gainNode, filter }

    // ── Background music (optional) ────────────────────────────────────────
    // Add public/sounds/bg.mp3 — free tracks at pixabay.com/music
    bgMusic = new Howl({
      src: ['/sounds/bg.mp3'],
      loop:   true,
      volume: 0.22,
      onloaderror: () => { bgMusic = null },
    })
    bgMusic.play()

  } catch (_) {}
}

export function updateEngine(speed) {
  if (!engine || !ctx) return
  try {
    const freq = 48 + speed * 6.5
    engine.osc1.frequency.setTargetAtTime(freq,     ctx.currentTime, 0.08)
    engine.osc2.frequency.setTargetAtTime(freq * 2, ctx.currentTime, 0.08)
    const vol = 0.018 + Math.min(speed * 0.003, 0.04)
    engine.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.08)
  } catch (_) {}
}

export function playCollision(speed = 5) {
  if (!ctx) return
  const now = Date.now()
  if (now - lastCollide < 250) return  // debounce 250ms
  lastCollide = now

  try {
    const intensity = Math.min(Math.max((speed - 3) / 14, 0), 1)
    if (intensity <= 0) return

    const frames = Math.floor(ctx.sampleRate * 0.18)
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data   = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.5)
    }

    const src = ctx.createBufferSource()
    src.buffer = buf

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 250 + intensity * 900

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(intensity * 0.55, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

    src.connect(lp)
    lp.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  } catch (_) {}
}

export function playBrake() {
  if (!ctx) return
  const now = Date.now()
  if (now - lastBrake < 400) return  // debounce 400ms
  lastBrake = now

  try {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.055, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

export function playZoneChime() {
  if (!ctx) return
  try {
    // C major arpeggio
    ;[523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq

      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.1, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  } catch (_) {}
}

export function setMusicVolume(v) {
  bgMusic?.volume(v)
}

export function toggleMusic() {
  if (!bgMusic) return
  bgMusic.playing() ? bgMusic.pause() : bgMusic.play()
}