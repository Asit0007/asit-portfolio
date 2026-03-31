import { Howl } from 'howler'

// ── Playlist — add as many files as you want ──────────────────────────────
const PLAYLIST = [
  '/sounds/bg1.mp3',
  '/sounds/bg2.mp3',
  '/sounds/bg3.mp3',
  '/sounds/bg4.mp3',
  '/sounds/bg5.mp3',
  '/sounds/bg6.mp3',
].filter(Boolean)

let ctx         = null
let engine      = null
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

  startPlaylist()
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