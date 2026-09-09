// Camera shake and vibration. Two independent channels feed one camera
// offset:
//
//   IMPULSE  discrete hits — a boulder clipped, a bowling strike, a wheel
//            dropping off something. Fed by triggerShake() and decaying on
//            its own over a few hundred ms.
//   RUMBLE   sustained surface vibration — the tyres chattering across a
//            gravel patch. Fed every frame by addRumble() for as long as it
//            lasts, and falling away fast the moment the feeding stops.
//
// Both are sampled from smooth value noise rather than Math.random(). White
// noise is uncorrelated frame to frame, so it reads as television static
// stapled over the viewport; a real camera on a shaking mount traces a
// continuous path through space. Sampling one continuous noise curve at a
// fixed frequency gives that path, and it is frame-rate independent for
// free — 30 fps samples the same curve half as often, it doesn't get a
// different curve.
//
// The ROTATIONAL output is what actually sells this. The follow-cam sits
// ~30 units back, where a 0.15-unit positional nudge is about three pixels;
// half a degree of roll swings the entire frame. Position alone is why the
// old white-noise version read as a glitch rather than as a bump.

// ── Noise ───────────────────────────────────────────────────────────────────
function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453123
  return s - Math.floor(s)
}

// Value noise in -1..1, C1-continuous via the smoothstep fade. `seed` picks
// an independent curve, so each axis can wander without tracking the others.
export function shakeNoise(t, seed = 0) {
  const x = t + seed * 71.3
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = hash(i + seed * 311.7)
  const b = hash(i + 1 + seed * 311.7)
  return (a + (b - a) * u) * 2 - 1
}

// Two octaves — the second adds the grain that makes a rumble feel like
// stones rather than a sine wobble, without pushing the base frequency up
// where a 60 Hz frame can no longer resolve it.
function grain(t, seed) {
  return shakeNoise(t, seed) * 0.72 + shakeNoise(t * 2.37, seed + 40) * 0.28
}

// ── Tuning ──────────────────────────────────────────────────────────────────
const IMPULSE_FREQ = 9    // Hz
// High enough to buzz, low enough that a 60 Hz frame still gets ~3.5 samples
// per cycle. Past roughly 20 Hz the sampling aliases and the coherent noise
// collapses back into the white-noise mush this replaced.
const RUMBLE_FREQ    = 17
const RUMBLE_RELEASE = 8      // per second, once addRumble() stops feeding

// Peak positional offset in world units at full rumble, and peak rotation in
// radians. 0.016 rad is ~0.9 degrees of roll — clearly felt, still under
// DESIGN.md's <=0.3 shake ceiling in spirit.
const RUMBLE_POS   = 0.13
const RUMBLE_ROLL  = 0.016
const RUMBLE_PITCH = 0.009
const RUMBLE_YAW   = 0.005

// Rotation an impulse gets, per unit of its positional magnitude. A typical
// triggerShake(0.16) therefore rolls the camera ~0.01 rad at its peak.
const IMPULSE_ROLL  = 0.065
const IMPULSE_PITCH = 0.040
const IMPULSE_YAW   = 0.025

// ── State ───────────────────────────────────────────────────────────────────
let clock        = 0
let impulse      = 0   // 0..1 envelope
let impulsePeak  = 0   // magnitude the envelope scales
let impulseRate  = 4   // envelope units per second
let rumble       = 0   // 0..1

const offset = { x: 0, y: 0, z: 0 }
const rot    = { pitch: 0, yaw: 0, roll: 0 }

// A discrete hit. Only overrides the current impulse if it is actually
// bigger, so a big jolt is never cut short by a small one landing behind it.
export function triggerShake(magnitude = 0.18, durationMs = 260) {
  if (magnitude > impulsePeak * impulse) {
    impulsePeak = magnitude
    impulse     = 1
  }
  impulseRate = 1000 / durationMs
}

// Sustained vibration, 0..1. Call every frame while the surface is rough —
// this takes the loudest feeder rather than summing, so several sources
// can't stack into nausea.
export function addRumble(level) {
  if (level > rumble) rumble = level > 1 ? 1 : level
}

export function getRumble() { return rumble }

// Advances both channels and computes this frame's offsets. Must run once
// per frame, before applyShake()/applyShakeRotation() read them.
export function updateShake(dt) {
  const d = dt > 0.05 ? 0.05 : dt
  clock += d

  impulse = Math.max(0, impulse - impulseRate * d)
  // Squared falloff: a hit lands hard and then gets out of the way, instead
  // of trailing a long low-amplitude shimmer.
  const imp = impulsePeak * impulse * impulse

  rumble = Math.max(0, rumble - RUMBLE_RELEASE * d)
  // Smoothstepped so a whisper of roughness stays a whisper — a linear map
  // made the faintest ground texture register as a real vibration.
  const rum = rumble * rumble * (3 - 2 * rumble)

  const ti = clock * IMPULSE_FREQ
  const tr = clock * RUMBLE_FREQ

  offset.x = imp * shakeNoise(ti, 0) + rum * RUMBLE_POS * grain(tr, 3)
  offset.y = (imp * shakeNoise(ti, 1) + rum * RUMBLE_POS * grain(tr, 4)) * 0.6
  offset.z = imp * shakeNoise(ti, 2) + rum * RUMBLE_POS * grain(tr, 5)

  rot.roll  = imp * IMPULSE_ROLL  * shakeNoise(ti, 6) + rum * RUMBLE_ROLL  * grain(tr, 9)
  rot.pitch = imp * IMPULSE_PITCH * shakeNoise(ti, 7) + rum * RUMBLE_PITCH * grain(tr, 10)
  rot.yaw   = imp * IMPULSE_YAW   * shakeNoise(ti, 8) + rum * RUMBLE_YAW   * grain(tr, 11)
}

// Mutates and returns `vec3` with this frame's positional shake added.
export function applyShake(vec3) {
  vec3.x += offset.x
  vec3.y += offset.y
  vec3.z += offset.z
  return vec3
}

// Rotational shake. Apply AFTER camera.lookAt() — lookAt writes the whole
// orientation, so anything added before it is thrown away.
export function applyShakeRotation(camera) {
  if (rot.roll === 0 && rot.pitch === 0 && rot.yaw === 0) return
  camera.rotateX(rot.pitch)
  camera.rotateY(rot.yaw)
  camera.rotateZ(rot.roll)
}
