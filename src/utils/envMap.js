import * as THREE from 'three'

// ── A reflection environment for the car only ─────────────────────────────
// The car is the one object on screen with glass and chrome, and with no
// environment to reflect those materials resolve to flat shaded colour —
// the windscreen reads as painted-on plastic.
//
// This is deliberately NOT assigned to `scene.environment`. The scene is
// fill-rate bound (measured: 4.0 MP -> 49 fps, 1.5 MP -> 60 fps at identical
// draw calls), so adding a PMREM sample to every fragment of a full-screen
// 400x400 ground plane would spend the frame budget on the surface that
// benefits least. Scoped to the car's materials, the cost lands on a few
// thousand pixels.
//
// Generated procedurally rather than loaded: the 2026-08-20 payload pass cut
// public/ from 31 MB to 15 MB, and an HDR download would hand a chunk of
// that back for one reflection.

const _cache = new WeakMap()

function gradientEquirect() {
  // 2:1 equirectangular. Tiny on purpose — PMREM blurs it into roughness
  // mips anyway, so resolution past this buys nothing.
  const W = 128, H = 64
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0.00, '#9dc0e8')  // zenith — cool sky
  g.addColorStop(0.42, '#ffd9a0')  // horizon haze, matching the fog band
  g.addColorStop(0.52, '#f0a050')  // fog colour exactly, at the horizon line
  g.addColorStop(1.00, '#d4762c')  // sand bounce from below
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Cached per renderer: one PMREM pass at first use, then reused. Keyed on
// the renderer so a recreated WebGL context builds a fresh one rather than
// handing back a texture that belongs to the dead context.
export function getCarEnvMap(gl) {
  if (!gl) return null
  const hit = _cache.get(gl)
  if (hit) return hit
  try {
    const equirect = gradientEquirect()
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const rt = pmrem.fromEquirectangular(equirect)
    pmrem.dispose()
    equirect.dispose()
    _cache.set(gl, rt.texture)
    return rt.texture
  } catch (_) {
    // Same graceful-degradation contract as the API helpers: no reflection
    // is a cosmetic loss, never a broken car.
    return null
  }
}
