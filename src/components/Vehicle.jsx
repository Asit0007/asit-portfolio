import { useRef, forwardRef, Suspense, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'
import { playCollision, playBrake } from '../audio'
import { applyShake, triggerShake } from '../utils/cameraShake'
import { getCarEnvMap } from '../utils/envMap'
import { shadowTexture, DROP_X, DROP_Z, LEAN, SHADOW_Y } from './GroundShadows'

// ── Tuning — starting values for Rapier's raycast vehicle controller.
// Gravity here is [0,-20,0] (2x real-world). Tuned for a low, wide American
// muscle-car stance (not folio-2025's tall monster-truck/SUV proportions):
// low ride height + stiffer suspension + wider track for rollover
// resistance, moderate (not maximal) tire grip since a raycast vehicle with
// full rotation freedom can "trip" and flip on its own tires if grip is too
// high relative to how hard it corners. ─────────────────────────────────────
// Engine/brake force is a real force divided by mass to get acceleration —
// at mass=2 the original 140/300/60 values worked out to ~3.5g of horizontal
// acceleration (140/2=70 units/s² against 20 units/s² gravity), which will
// wheelie/stoppie *any* vehicle once rotation isn't locked. Retuned to a
// much more sane ~0.6-1g range.
const ENGINE_FORCE         = 32
const BOOST_ENGINE_FORCE   = 65
const REVERSE_ENGINE_FORCE = 22
const BRAKE_FORCE          = 26
const IDLE_BRAKE           = 3
// Reverse needs a much softer idle brake to coast down at the same RATE.
// Rapier's setWheelBrake is a brake torque, not a plain force, so it can
// effectively lock the wheel and hand deceleration over to tire friction —
// which is why 3 behaves nothing like the ~3 u/s^2 that force/mass implies.
// Measured coast-down over the same 8 -> 4 speed window: forward 14.7
// u/s^2, reverse with the same 3 about 21-33, reverse with none about 6.
// 1.0 lands reverse inside forward's own run-to-run spread, so letting go
// of reverse rolls to a stop instead of grabbing. Retune by measuring the
// 6->2 window in both directions, not by feel — the run-to-run variance is
// wide enough (forward alone measured 17.9 and 24.4 back to back) that a
// single run will happily justify any number you like.
const IDLE_BRAKE_REVERSE   = 1.0
const TOP_SPEED            = 20
const TOP_SPEED_BOOST      = 38
const MAX_REV_SPEED        = 12
const STEER_MAX            = 0.42  // radians, front-wheel toe angle — slightly
                                    // tighter than a first pass, wide-track
                                    // muscle cars don't turn on a dime
const STEER_LERP_SPEED     = 10

// Rapier's engine-force sign convention depends on wheel axle/direction setup
// below — if the car drives backwards on "forward" input, flip this to -1.
const FORWARD_SIGN = 1

const WHEEL_RADIUS            = 0.36
const SUSPENSION_REST_LENGTH  = 0.24  // low ride height
const SUSPENSION_STIFFNESS    = 75    // stiffer — less body roll mid-corner
const SUSPENSION_COMPRESSION  = 5.0
const SUSPENSION_RELAXATION   = 3.6
const MAX_SUSPENSION_TRAVEL   = 0.22  // short travel to match the low stance
const MAX_SUSPENSION_FORCE    = 500
const FRICTION_SLIP           = 1.6   // moderate grip — high grip + full
                                       // rotation freedom trips the car into
                                       // a rollover during hard cornering
const SIDE_FRICTION_STIFFNESS = 3.2

// Wheel chassis-connection points (chassis-local space) — a slightly longer
// wheelbase than the BoxCar fallback's visual wheel positions (z:±1.1) on
// purpose: more distance between front/rear contact patches gives more
// leverage resisting pitch (nose-up/nose-down), directly fighting
// wheelie/stoppie on top of the mass-properties override below. Front pair
// (0,1) steers, rear pair (2,3) is driven (RWD). Wide track (x:±0.95) for
// rollover resistance. Car faces -Z (front), matching the rest of this
// file's existing "-Z is forward" convention.
const WHEEL_POSITIONS = [
  { x: -0.95, y: -0.25, z: -1.4 }, // front-left
  { x:  0.95, y: -0.25, z: -1.4 }, // front-right
  { x: -0.95, y: -0.25, z:  1.4 }, // rear-left
  { x:  0.95, y: -0.25, z:  1.4 }, // rear-right
]
const STEERED_WHEELS = [0, 1]
const DRIVEN_WHEELS   = [2, 3]

// Mass + a custom principal angular inertia (overriding what Rapier would
// auto-compute from the collider) — deliberately anisotropic: much higher
// resistance to PITCH (local X axis — the wheelie/stoppie rotation) than to
// yaw or roll, so the chassis still leans/bounces naturally over rocks and
// corners but can't rotate end-over-end from engine/brake torque alone.
const CHASSIS_MASS   = 2
const PITCH_INERTIA  = 9    // local X — resists wheelie/stoppie
const YAW_INERTIA    = 2.6  // local Y — steering turn-in response
const ROLL_INERTIA   = 1.2  // local Z — cornering lean / bump response
const CHASSIS_COM    = { x: 0, y: -0.05, z: 0 } // matches the collider position below

// ── Camera ──────────────────────────────────────────────────────────────────
// Camera sits at +Z (south) relative to car
// Car faces -Z (north) → _fwd = (0,0,-1)
// W pressed → car moves in -Z → moves north → away from camera → FORWARD ✓
const CAM_OFFSET = new THREE.Vector3(8, 18, 20)
const CAM_LERP   = 3.5

// Continuous speed-based zoom replaces the old binary boost/non-boost
// offset swap — boost already raises speed toward TOP_SPEED_BOOST, so it
// naturally produces a bigger offset through this curve without a special case.
const ZOOM_SPEED_MIN = 5
const ZOOM_SPEED_MAX = 38 // matches TOP_SPEED_BOOST
const ZOOM_NEAR       = 0.85
const ZOOM_FAR        = 1.35

// Brief camera bias on entering a zone — NOT folio's locked cinematic shot
// (this game's zones are passive/proximity-triggered, driving never pauses,
// so a hard camera takeover would fight the core interaction model). Just a
// few seconds of extra height/distance blended into the existing follow-cam
// lerp for a slight "establishing" look, decaying back to normal on its own
// — nothing to release, no state machine, safe even if the player keeps
// driving straight through it.
const ZONE_BIAS_OFFSET   = new THREE.Vector3(0, 4, 4)
const ZONE_BIAS_DURATION = 2000 // ms

// ── Set true when your car.glb exists in /public/models/ ────────────────────
const HAS_GLTF = true

const _fwd    = new THREE.Vector3()
const _vel    = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _cam    = new THREE.Vector3()
const _look   = new THREE.Vector3()
const _ideal  = new THREE.Vector3()
const _carPos = new THREE.Vector3()

// ── Contact shadow (see GroundShadows.jsx for why blobs, not shadow maps) ──
// Roughly the chassis footprint (collider half-extents 0.9 x 1.7) with a
// margin, since a soft blob that stops exactly at the bodywork reads as a
// hard edge. Length runs along the car's forward axis.
const CAR_SHADOW_W = 2.9
const CAR_SHADOW_L = 5.0
// Height used to lean the blob away from the sun — the body's centre of
// mass, not the roof, so the shadow stays tucked under the car.
const CAR_SHADOW_H = 0.75
// The ground is a single flat plane at y=0 (World.jsx), so the blob never
// needs to be projected onto varying terrain — a fixed height just above
// the sand is exact everywhere. Sits above the static blobs so the car's
// own shadow wins where it overlaps a tree's, and 0.02 clear of them puts
// it over the circuit kerbs (0.088) too. At the old 0.03 it was BELOW the
// road surface (0.06), so the car's shadow silently disappeared the whole
// time it was driving on asphalt — see the decal stack in GroundShadows.
const CAR_SHADOW_Y = SHADOW_Y + 0.02

// ── Lamps ─────────────────────────────────────────────────────────────────
// car-1.glb is a single mesh on a single texture-atlas material, so its
// lamps are painted into the texture and there is no per-lamp material to
// make emissive. These are emissive panels laid over those painted lenses.
//
// Positions are chassis-local and MUST come from the model's own bounds,
// not the collider's: the collider is a 1.8 x 3.4 box but the bodywork is
// 2.38 x 4.94 (glTF POSITION accessor min/max, then the -0.25 y offset and
// the PI y-rotation the primitive is mounted with). Sizing these off the
// collider put them 0.75 deep inside the bodywork, completely invisible.
// Model-local extents after that mount: x +-1.19, y -0.49..1.21,
// nose z = -2.47, tail z = +2.47.
//
// The y values were then dialled in against the model: a temporary bright
// green emissive proved the panels render and sit proud of the bodywork,
// but landed 0.13 low, straddling the chrome bumper instead of the painted
// lens. Red-on-red made that invisible, which is why the brake flare
// appeared to do nothing even while the material was measurably going
// 0.25 -> 5.0. Re-check with that green trick if these ever drift.
const HEADLIGHT_X   = 0.72
// 0.28, not the tail's 0.55: this bodywork is a wedge and the nose is far
// lower than the deck. At 0.40 the lamps cleared the bonnet line and read
// as two white bars floating over the front wings from the chase camera,
// which is the only angle this game ever shows.
const HEADLIGHT_POS = [0.28, -2.42]   // [y, z]
const TAILLIGHT_X   = 0.72
const TAILLIGHT_POS = [0.55, 2.45]    // [y, z]
// Tail lamps idle dim and flare under braking, like real running lights.
// TAIL_IDLE has to stay low: emissive #ff1c08 is already saturated in the
// red channel by ~0.9, so idling there and flaring to 5.0 produced a
// measurable change (verified 0.9 -> 5.0 on the live material) that was
// invisible on screen — both ends clipped to the same red. At 0.25 the
// lamp sits at a deep rgb(135,~0,~0) and the brake flare reads as an
// obvious jump to full.
const TAIL_IDLE     = 0.25
const TAIL_BRAKING  = 5.0
// Bump feedback: a jump in the chassis' vertical velocity within one frame
// means a wheel just rode up something. The rock colliders kick the body
// directly (EnvironmentModels.jsx), but small stones are only ever touched
// by the wheel raycasts, never by the chassis collider, so they'd otherwise
// pass under the car in total silence.
const BUMP_DV       = 1.1

// ── GLTF car — rotation.y = PI flips model to face -Z (north) ───────────────
// Most car GLB models face +Z by default. Our physics pushes in -Z.
// Rotating 180° around Y makes the visual match the physics direction.
function GLTFCar() {
  const { scene } = useGLTF('/models/car-1.glb')
  const gl = useThree((st) => st.gl)
  // Was cloning on every render; memoised so the traversal below runs once
  // and doesn't rebuild the car's material set behind itself.
  const cloned = useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    const envMap = getCarEnvMap(gl)
    if (!envMap) return
    const owned = []
    cloned.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return
      if (!('envMap' in o.material)) return
      // Object3D.clone() shares material references with the cached GLTF, so
      // assigning straight onto o.material would mutate drei's useGLTF cache
      // and leak into any future clone of this model.
      o.material = o.material.clone()
      o.material.envMap = envMap
      // Restrained on purpose: this is a stylised desert diorama, not a
      // showroom render. Enough to put a horizon line in the glass.
      o.material.envMapIntensity = 0.55
      o.material.needsUpdate = true
      owned.push(o.material)
    })
    // These clones are ours, not drei's cache — nothing else will free them.
    return () => owned.forEach((m) => m.dispose())
  }, [cloned, gl])

  return (
    <primitive
      object={cloned}
      scale={1}
      position={[0, -0.25, 0]}
      rotation={[0, Math.PI, 0]}  // ← THE KEY FIX: flip to face -Z
    />
  )
}

// ── BoxCar — all parts oriented so front faces -Z (north) ───────────────────
// Hood/headlights at -Z = front (drives away from camera)
// Cab/taillights at +Z = back (faces camera which sits at +Z)
function BoxCar() {
  return (
    <>
      {/* Main body */}
      <mesh>
        <boxGeometry args={[1.8, 0.5, 3.4]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.5} roughness={0.25} />
      </mesh>

      {/* Hood — raised panel at FRONT (-Z) */}
      <mesh position={[0, 0.28, -0.8]}>
        <boxGeometry args={[1.7, 0.06, 1.4]} />
        <meshStandardMaterial color="#00bde0" metalness={0.4} roughness={0.3} />
      </mesh>

      {/* Cab — passenger section at BACK (+Z) */}
      <mesh position={[0, 0.52, 0.5]}>
        <boxGeometry args={[1.3, 0.5, 1.6]} />
        <meshStandardMaterial color="#0099bb" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Windshield — front face of cab (-Z side) */}
      <mesh position={[0, 0.54, -0.28]}>
        <boxGeometry args={[1.26, 0.44, 0.06]} />
        <meshStandardMaterial color="#88ddff" transparent opacity={0.45}
          roughness={0} metalness={0.1} />
      </mesh>

      {/* Rear window — back of cab (+Z side) */}
      <mesh position={[0, 0.54, 1.28]}>
        <boxGeometry args={[1.26, 0.38, 0.05]} />
        <meshStandardMaterial color="#66bbdd" transparent opacity={0.35}
          roughness={0} metalness={0.1} />
      </mesh>

      {/* Roof rack — on top of cab */}
      <mesh position={[0, 0.79, 0.5]}>
        <boxGeometry args={[1.1, 0.06, 1.4]} />
        <meshStandardMaterial color="#007799" roughness={0.6} />
      </mesh>

      {/* Wheels */}
      {WHEEL_POSITIONS.map(({ x, y, z }, i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.28, 0.52, 0.52]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}

      {/* HEADLIGHTS at FRONT = -Z (points north, away from camera) */}
      {[[-0.55, 0.05, -1.71], [0.55, 0.05, -1.71]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.32, 0.2, 0.05]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
        </mesh>
      ))}

      {/* Grille — at front -Z */}
      <mesh position={[0, -0.05, -1.71]}>
        <boxGeometry args={[1.0, 0.12, 0.04]} />
        <meshStandardMaterial color="#004466" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* TAILLIGHTS at BACK = +Z (faces camera, player sees these when driving forward) */}
      {[[-0.55, 0.05, 1.71], [0.55, 0.05, 1.71]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.3, 0.18, 0.05]} />
          <meshStandardMaterial color="#ff2200" emissive="#ff1100" emissiveIntensity={1.5} />
        </mesh>
      ))}

      {/* Rear bumper at +Z */}
      <mesh position={[0, -0.12, 1.71]}>
        <boxGeometry args={[1.6, 0.14, 0.06]} />
        <meshStandardMaterial color="#007799" roughness={0.5} />
      </mesh>
    </>
  )
}

function VehicleInner(props, ref) {
  const { world }   = useRapier()
  const bodyRef     = useRef()
  const vehicleRef  = useRef(null)
  const shadowRef   = useRef()
  const tailMats    = useRef([])
  const prevVy      = useRef(0)
  // Shared with every static blob in GroundShadows.jsx — one texture on the
  // GPU, and the car's contact shading matches the world's by construction.
  const carShadowTex = useMemo(() => shadowTexture(), [])
  const steer       = useRef(0)
  const bodySet     = useRef(false)
  const lastSpeed   = useRef(0)
  const prevBrake   = useRef(false)
  const nosRef      = useRef(100)
  const lastZoneRef      = useRef(null)
  const zoneBiasStartRef = useRef(-Infinity)
  const [, getKeys] = useKeyboardControls()

  // Create the raycast vehicle controller once the chassis body exists.
  // The controller stays internal to this component — every other file
  // (Zones, MapOverlay, App, AudioManager) reads translation()/
  // linvel() off the plain chassis RigidBody, exactly as before.
  useEffect(() => {
    if (!bodyRef.current) return

    // Overrides Rapier's auto-computed (isotropic) inertia from the collider
    // with an anisotropic one — see PITCH_INERTIA/YAW_INERTIA/ROLL_INERTIA
    // above for why.
    bodyRef.current.setAdditionalMassProperties(
      CHASSIS_MASS,
      CHASSIS_COM,
      { x: PITCH_INERTIA, y: YAW_INERTIA, z: ROLL_INERTIA },
      { x: 0, y: 0, z: 0, w: 1 },
      true
    )

    const controller = world.createVehicleController(bodyRef.current)

    WHEEL_POSITIONS.forEach((pos) => {
      controller.addWheel(pos, { x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 },
        SUSPENSION_REST_LENGTH, WHEEL_RADIUS)
    })
    for (let i = 0; i < WHEEL_POSITIONS.length; i++) {
      controller.setWheelSuspensionStiffness(i, SUSPENSION_STIFFNESS)
      controller.setWheelSuspensionCompression(i, SUSPENSION_COMPRESSION)
      controller.setWheelSuspensionRelaxation(i, SUSPENSION_RELAXATION)
      controller.setWheelMaxSuspensionTravel(i, MAX_SUSPENSION_TRAVEL)
      controller.setWheelMaxSuspensionForce(i, MAX_SUSPENSION_FORCE)
      controller.setWheelFrictionSlip(i, FRICTION_SLIP)
      controller.setWheelSideFrictionStiffness(i, SIDE_FRICTION_STIFFNESS)
    }

    vehicleRef.current = controller
    return () => {
      vehicleRef.current = null
      world.removeVehicleController(controller)
    }
  }, [world])

  const getInput = () => {
    // While a text field is focused (comment input, leaderboard name),
    // keyboard state must not drive the car — WASD/arrows/space would
    // steer and brake underneath the user's typing.
    const el = typeof document !== 'undefined' ? document.activeElement : null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
      return { forward: false, backward: false, steer: 0, brake: false, boost: false }
    }
    const k = getKeys()
    const j = props.joystick || {}
    // Steering is analog (-1..1, +1 = left). Priority: keyboard (digital
    // ±1) → mobile steering wheel (window.__mobileSteer — bypasses the
    // store because it changes every touchmove; see MobileControls.jsx) →
    // legacy joystick booleans.
    const kSteer = (k[Controls.left] ? 1 : 0) - (k[Controls.right] ? 1 : 0)
    const wheel  = typeof window !== 'undefined' ? (window.__mobileSteer || 0) : 0
    const jSteer = (j.left ? 1 : 0) - (j.right ? 1 : 0)
    return {
      forward:  k[Controls.forward]  || j.forward  || false,
      backward: k[Controls.backward] || j.backward || false,
      steer:    Math.max(-1, Math.min(1, kSteer || wheel || jSteer)),
      brake:    k[Controls.brake]    || j.brake    || false,
      boost:    k[Controls.boost]    || j.boost    || false,
    }
  }

  useFrame((state, delta) => {
    if (!bodyRef.current || !vehicleRef.current) return
    const body       = bodyRef.current
    const controller = vehicleRef.current
    const dt         = Math.min(delta, 0.05)

    if (!bodySet.current) {
      bodySet.current = true
      useGameStore.getState().setVehicleBody(body)
    }
    if (ref) ref.current = body

    if (typeof window !== 'undefined' && window.__resetCar) {
      window.__resetCar = false
      body.setTranslation({ x: 0, y: 2.5, z: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    }

    const { forward, backward, steer: steerInput, brake, boost } = getInput()
    const gameStarted = useGameStore.getState().gameStarted

    if (brake && !prevBrake.current && gameStarted) playBrake()
    prevBrake.current = brake

    // NOS management
    const canBoost = boost && forward && nosRef.current > 0 && gameStarted
    if (canBoost) {
      nosRef.current = Math.max(0, nosRef.current - dt * 35)
    } else if (!boost) {
      nosRef.current = Math.min(100, nosRef.current + dt * 12)
    }
    if (typeof window !== 'undefined') {
      window.__nosLevel   = nosRef.current
      window.__isBoosting = canBoost
    }

    // Forward basis + current speed — used for the soft speed cap, reverse
    // gating, camera follow, and collision-sound loudness.
    const rot = body.rotation()
    _quat.set(rot.x, rot.y, rot.z, rot.w)
    _fwd.set(0, 0, -1).applyQuaternion(_quat).setY(0).normalize()
    const lv = body.linvel()
    _vel.set(lv.x, lv.y, lv.z)
    const fwdSpeed = _fwd.dot(_vel)
    lastSpeed.current = Math.sqrt(lv.x * lv.x + lv.z * lv.z)

    // Engine force — soft speed cap via force attenuation (force fades out
    // as speed passes the target, rather than hard-clamping velocity, which
    // would fight the vehicle controller's own solver).
    const topSpeed = canBoost ? TOP_SPEED_BOOST : TOP_SPEED
    const overflow = Math.max(0, lastSpeed.current - topSpeed)

    let engineForce = 0
    let brakeFront  = 0
    let brakeRear   = 0

    if (backward && fwdSpeed > 0.5) {
      // Moving forward, pressing reverse → brake to a stop first instead
      // of instantly reversing direction.
      brakeFront = brakeRear = BRAKE_FORCE
    } else if (forward) {
      engineForce = FORWARD_SIGN * (canBoost ? BOOST_ENGINE_FORCE : ENGINE_FORCE) / (1 + overflow)
    } else if (backward && fwdSpeed > -MAX_REV_SPEED) {
      engineForce = -FORWARD_SIGN * REVERSE_ENGINE_FORCE
    }

    if (brake) {
      brakeFront = brakeRear = BRAKE_FORCE
    } else if (!forward && !backward) {
      // Idle "engine braking" only comes through the driven wheels in a real
      // RWD car — applying it to the front wheels too was pitching the nose
      // down hard (a "stoppie") when coasting off the accelerator at speed.
      //
      // Stays on the rear in both directions — engine braking reaches the
      // road through the driven wheels whichever way the car is rolling.
      // Only the magnitude changes: see IDLE_BRAKE_REVERSE above for why
      // the same number bites roughly 40% harder going backwards.
      brakeRear = fwdSpeed < -0.5 ? IDLE_BRAKE_REVERSE : IDLE_BRAKE
    }

    // Steering — smoothed so a tapped key eases toward full lock instead of
    // snapping there instantly (the mobile wheel feeds analog values through
    // the same lerp, which just makes it track faster).
    steer.current = THREE.MathUtils.lerp(
      steer.current, steerInput, 1 - Math.exp(-STEER_LERP_SPEED * dt)
    )
    const steerAngle = steer.current * STEER_MAX

    for (const i of STEERED_WHEELS) {
      controller.setWheelSteering(i, steerAngle)
      controller.setWheelBrake(i, brakeFront)
    }
    for (const i of DRIVEN_WHEELS) {
      controller.setWheelEngineForce(i, engineForce)
      controller.setWheelBrake(i, brakeRear)
    }

    controller.updateVehicle(dt)

    // ── Bump feedback ─────────────────────────────────────────────────────
    // Reads the suspension's own reaction rather than any collision event,
    // so it fires for anything the wheels ride over, rocks included.
    const dvy = lv.y - prevVy.current
    prevVy.current = lv.y
    if (dvy > BUMP_DV && lastSpeed.current > 3) {
      triggerShake(Math.min(dvy / 7, 0.32), 220)
    }

    // ── Brake lights ──────────────────────────────────────────────────────
    // `backward` while still rolling forwards is the brake-to-stop case
    // handled above, so it lights the lamps too — same as lifting off and
    // stabbing the brake would in a real car.
    const braking = brake || (backward && fwdSpeed > 0.5)
    const tailTarget = braking ? TAIL_BRAKING : TAIL_IDLE
    const tailK = 1 - Math.exp(-20 * dt)
    for (const m of tailMats.current) {
      if (m) m.emissiveIntensity += (tailTarget - m.emissiveIntensity) * tailK
    }

    // ── Contact shadow ────────────────────────────────────────────────────
    // Kept outside the RigidBody and driven from here rather than parented
    // to the chassis: as a child it would inherit the body's roll and pitch
    // and tilt off the ground with every bump.
    const shadow = shadowRef.current
    if (shadow) {
      const sp = body.translation()
      shadow.position.set(
        sp.x + DROP_X * CAR_SHADOW_H * LEAN,
        CAR_SHADOW_Y,
        sp.z + DROP_Z * CAR_SHADOW_H * LEAN,
      )
      // Euler XYZ applies Z first, so rotation.z spins the quad inside its
      // own plane before rotation.x lays it flat. After that flattening the
      // plane's local +y points along world -z, so aligning local +y with
      // the car's forward vector needs atan2(-fwd.x, -fwd.z).
      shadow.rotation.set(-Math.PI / 2, 0, Math.atan2(-_fwd.x, -_fwd.z))

      // Fade and shrink with airtime. Rapier reports per-wheel ground
      // contact, which is exact and free here — deriving it from chassis
      // height would need a rest-height constant that drifts the moment the
      // suspension tuning above changes.
      let grounded = 4
      if (typeof controller.wheelIsInContact === 'function') {
        grounded = 0
        for (let i = 0; i < 4; i++) if (controller.wheelIsInContact(i)) grounded++
      }
      const g = grounded / 4
      shadow.material.opacity = 0.25 + g * 0.75
      shadow.scale.set(
        CAR_SHADOW_W * (1 + (1 - g) * 0.35),
        CAR_SHADOW_L * (1 + (1 - g) * 0.35),
        1,
      )
      shadow.visible = g > 0.01
    }

    // Camera — always follows car; still no hard zone override (the
    // billboard needs a fairly consistent approach angle to stay face-on),
    // just a brief additive bias below that decays on its own.
    // Zoom scales continuously with speed rather than a binary boost swap —
    // boost already raises lastSpeed toward TOP_SPEED_BOOST, so it pulls the
    // camera back further through this curve without a special case.
    const pos = body.translation()
    _carPos.set(pos.x, pos.y, pos.z)
    _cam.copy(state.camera.position)
    const zoomT = THREE.MathUtils.smoothstep(lastSpeed.current, ZOOM_SPEED_MIN, ZOOM_SPEED_MAX)
    const zoom  = THREE.MathUtils.lerp(ZOOM_NEAR, ZOOM_FAR, zoomT)
    _ideal.copy(_carPos).addScaledVector(CAM_OFFSET, zoom)

    // On freshly entering a zone (not leaving one), blend in a decaying
    // extra height/distance bias for a brief "establishing" look.
    const activeZoneId = useGameStore.getState().activeZone?.id ?? null
    if (activeZoneId !== lastZoneRef.current) {
      lastZoneRef.current = activeZoneId
      if (activeZoneId) zoneBiasStartRef.current = performance.now()
    }
    const zoneBiasT = 1 - (performance.now() - zoneBiasStartRef.current) / ZONE_BIAS_DURATION
    if (zoneBiasT > 0) _ideal.addScaledVector(ZONE_BIAS_OFFSET, zoneBiasT)

    _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP * dt))
    applyShake(_cam)
    state.camera.position.copy(_cam)
    _look.set(pos.x, pos.y + 0.5, pos.z)
    state.camera.lookAt(_look)
  })

  return (
    <>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={carShadowTex}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    <RigidBody
      ref={bodyRef}
      position={[0, 2.5, 0]}
      colliders={false}
      mass={CHASSIS_MASS}
      linearDamping={0.05}
      angularDamping={4}
      ccd={true}
      restitution={0.2}
      onCollisionEnter={() => {
        if (lastSpeed.current > 4 && useGameStore.getState().gameStarted)
          playCollision(lastSpeed.current)
      }}
    >
      {/* Sized/positioned to stay clear of the wheels' own ground contact —
          the wheel raycasts (connection y=-0.25, reaching further down by
          suspensionRestLength+radius) need to be the only thing touching
          the ground under normal driving. If this collider reached as low
          as the wheels' contact patch, the two ground-contact mechanisms
          would fight each other (the body resting on this collider directly,
          independent of and inconsistent with the suspension). */}
      <CuboidCollider args={[0.9, 0.3, 1.7]} position={[0, -0.05, 0]} />
      {HAS_GLTF ? (
        <Suspense fallback={<BoxCar />}>
          <GLTFCar />
        </Suspense>
      ) : (
        <BoxCar />
      )}

      {/* Headlights. A single emissive panel read as a flat white sticker
          pasted on the nose: one blown-out face, no housing, no falloff.
          Three parts fix that for two extra draw calls each, which this
          scene has room for — it is fill-bound, not draw-call bound.

          toneMapped={false} on the emitters keeps them reading as light
          sources rather than being pulled back down by ACES like paint. */}
      {[-HEADLIGHT_X, HEADLIGHT_X].map((x) => (
        <group key={`hl${x}`} position={[x, HEADLIGHT_POS[0], HEADLIGHT_POS[1]]}>
          {/* Bezel — a hair behind and wider all round, so a dark rim shows
              and the lamp reads as set INTO the wing rather than stuck on. */}
          <mesh position={[0, 0, 0.006]}>
            <boxGeometry args={[0.50, 0.21, 0.05]} />
            <meshStandardMaterial color="#15110d" roughness={0.45} metalness={0.5} />
          </mesh>
          {/* Lens — warmer and dimmer than before. The old 1.7 on a near
              white emissive clipped every channel, which is exactly why it
              looked like flat paper; 1.15 on a warm amber keeps colour in
              it. */}
          <mesh>
            <boxGeometry args={[0.42, 0.13, 0.055]} />
            <meshStandardMaterial
              color="#fff3d6"
              emissive="#ffd89a"
              emissiveIntensity={1.15}
              toneMapped={false}
              roughness={0.12}
            />
          </mesh>
          {/* Hot core — a small bright centre inside the lens. Real lamps
              are brightest at the filament and fall off to the edge; one
              uniform face is what made these look printed on. */}
          <mesh position={[0, 0, -0.014]}>
            <boxGeometry args={[0.20, 0.055, 0.035]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff4dc"
              emissiveIntensity={2.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Tail lights — materials are collected so the frame loop can flare
          them under braking. */}
      {[-TAILLIGHT_X, TAILLIGHT_X].map((x, i) => (
        <group key={`tl${x}`} position={[x, TAILLIGHT_POS[0], TAILLIGHT_POS[1]]}>
          {/* Matching bezel, mirrored: the tail faces +Z, so "behind" is -Z. */}
          <mesh position={[0, 0, -0.006]}>
            <boxGeometry args={[0.56, 0.22, 0.05]} />
            <meshStandardMaterial color="#15110d" roughness={0.45} metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.48, 0.14, 0.055]} />
            <meshStandardMaterial
              ref={(m) => { if (m) tailMats.current[i] = m }}
              color="#ff2f18"
              emissive="#ff1c08"
              emissiveIntensity={TAIL_IDLE}
              toneMapped={false}
              roughness={0.25}
            />
          </mesh>
        </group>
      ))}
    </RigidBody>
    </>
  )
}

const Vehicle = forwardRef(VehicleInner)
export default Vehicle
