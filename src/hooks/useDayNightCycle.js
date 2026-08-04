import { useState, useEffect } from 'react'
import * as THREE from 'three'

// Time-of-day driven by the visitor's actual local clock (like folio-2025's
// Date.now()-derived day cycle) rather than a fast arbitrary loop — a resume
// site should feel like "it's evening where you are," not a game gimmick.
// Four keyframe presets at 0h/6h/12h/18h, smoothly interpolated. The 12h
// (noon) preset is an exact match of this project's original fixed palette
// (Lights.jsx/Sky.jsx/Scene.jsx fog) so midday visitors see no change.
const PRESETS = [
  { // 0h — night
    ambient:  { color: '#4a5a8a', intensity: 0.35 },
    sun:      { color: '#8fa8dd', intensity: 0.4 },
    fill:     { color: '#33447a', intensity: 0.25 },
    hemi:     { sky: '#3a4a7a', ground: '#1a1030', intensity: 0.35 },
    fog:      '#1a1830',
    sky:      { sunPosition: [40, -8, -60], turbidity: 6, rayleigh: 0.4 },
  },
  { // 6h — dawn
    ambient:  { color: '#ffb99a', intensity: 0.7 },
    sun:      { color: '#ff9d6c', intensity: 1.4 },
    fill:     { color: '#7a8fcc', intensity: 0.35 },
    hemi:     { sky: '#ffb488', ground: '#5a3020', intensity: 0.55 },
    fog:      '#f2825a',
    sky:      { sunPosition: [40, 2, -60], turbidity: 9, rayleigh: 0.8 },
  },
  { // 12h — noon (= original fixed palette, unchanged)
    ambient:  { color: '#ffe5b4', intensity: 1.0 },
    sun:      { color: '#ffcc88', intensity: 2.2 },
    fill:     { color: '#aaccff', intensity: 0.45 },
    hemi:     { sky: '#ffe0a0', ground: '#c8640a', intensity: 0.7 },
    fog:      '#f0a050',
    sky:      { sunPosition: [40, 8, -60], turbidity: 12, rayleigh: 1.2 },
  },
  { // 18h — dusk
    ambient:  { color: '#ff8a5c', intensity: 0.8 },
    sun:      { color: '#ff6a3c', intensity: 1.6 },
    fill:     { color: '#6a5a9a', intensity: 0.35 },
    hemi:     { sky: '#ff7a4a', ground: '#7a2a10', intensity: 0.6 },
    fog:      '#c85838',
    sky:      { sunPosition: [40, 3, -60], turbidity: 14, rayleigh: 1.6 },
  },
]

const _colorA = new THREE.Color()
const _colorB = new THREE.Color()

function lerpColor(a, b, t) {
  return _colorA.set(a).lerp(_colorB.set(b), t).getStyle()
}

function lerpVec3(a, b, t) {
  return [
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  ]
}

function computePalette() {
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  const segment = Math.floor(hour / 6) % 4
  const t = (hour % 6) / 6
  const lo = PRESETS[segment]
  const hi = PRESETS[(segment + 1) % 4]

  return {
    ambient: {
      color: lerpColor(lo.ambient.color, hi.ambient.color, t),
      intensity: THREE.MathUtils.lerp(lo.ambient.intensity, hi.ambient.intensity, t),
    },
    sun: {
      color: lerpColor(lo.sun.color, hi.sun.color, t),
      intensity: THREE.MathUtils.lerp(lo.sun.intensity, hi.sun.intensity, t),
    },
    fill: {
      color: lerpColor(lo.fill.color, hi.fill.color, t),
      intensity: THREE.MathUtils.lerp(lo.fill.intensity, hi.fill.intensity, t),
    },
    hemi: {
      sky: lerpColor(lo.hemi.sky, hi.hemi.sky, t),
      ground: lerpColor(lo.hemi.ground, hi.hemi.ground, t),
      intensity: THREE.MathUtils.lerp(lo.hemi.intensity, hi.hemi.intensity, t),
    },
    fog: lerpColor(lo.fog, hi.fog, t),
    skybox: {
      sunPosition: lerpVec3(lo.sky.sunPosition, hi.sky.sunPosition, t),
      turbidity: THREE.MathUtils.lerp(lo.sky.turbidity, hi.sky.turbidity, t),
      rayleigh: THREE.MathUtils.lerp(lo.sky.rayleigh, hi.sky.rayleigh, t),
    },
  }
}

// Time-of-day doesn't need per-frame updates — recomputed on a coarse
// interval instead of every render.
export default function useDayNightCycle() {
  const [palette, setPalette] = useState(computePalette)

  useEffect(() => {
    const id = setInterval(() => setPalette(computePalette()), 30000)
    return () => clearInterval(id)
  }, [])

  return palette
}
