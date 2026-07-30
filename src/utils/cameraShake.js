// Shared between RockScatter (trigger) and Vehicle's camera update (apply).
// The car's RigidBody has enabledRotations=[false, true, false] — it can't
// physically pitch/roll over a bump, so a real suspension wobble never
// reaches the camera on its own. This fakes that feedback instead.
let shakeStart = 0
let shakeDuration = 0
let shakeMag = 0

export function triggerShake(magnitude = 0.18, durationMs = 260) {
  shakeStart = performance.now()
  shakeDuration = durationMs
  shakeMag = magnitude
}

// Mutates and returns `vec3` with a decaying random jitter added.
export function applyShake(vec3) {
  const t = (performance.now() - shakeStart) / shakeDuration
  if (t < 0 || t >= 1) return vec3
  const mag = shakeMag * (1 - t)
  vec3.x += (Math.random() * 2 - 1) * mag
  vec3.y += (Math.random() * 2 - 1) * mag * 0.6
  vec3.z += (Math.random() * 2 - 1) * mag
  return vec3
}
