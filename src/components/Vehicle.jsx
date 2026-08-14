import { useRef, forwardRef, Suspense, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'
import { playCollision, playBrake } from '../audio'
import { applyShake } from '../utils/cameraShake'

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

// ── GLTF car — rotation.y = PI flips model to face -Z (north) ───────────────
// Most car GLB models face +Z by default. Our physics pushes in -Z.
// Rotating 180° around Y makes the visual match the physics direction.
function GLTFCar() {
  const { scene } = useGLTF('/models/car-1.glb')
  const cloned = scene.clone()
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
      return { forward: false, backward: false, left: false, right: false, brake: false, boost: false }
    }
    const k = getKeys()
    const j = props.joystick || {}
    return {
      forward:  k[Controls.forward]  || j.forward  || false,
      backward: k[Controls.backward] || j.backward || false,
      left:     k[Controls.left]     || j.left     || false,
      right:    k[Controls.right]    || j.right    || false,
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

    const { forward, backward, left, right, brake, boost } = getInput()
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
      brakeRear = IDLE_BRAKE
    }

    // Steering — smoothed so a tapped key eases toward full lock instead of
    // snapping there instantly.
    const steerDir = (left ? 1 : 0) - (right ? 1 : 0)
    steer.current = THREE.MathUtils.lerp(
      steer.current, steerDir, 1 - Math.exp(-STEER_LERP_SPEED * dt)
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
    </RigidBody>
  )
}

const Vehicle = forwardRef(VehicleInner)
export default Vehicle
