import { useRef, forwardRef, Suspense, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'
import { playCollision, playBrake, updateGravel } from '../audio'
import {
  applyShake, applyShakeRotation, updateShake, triggerShake, shakeNoise,
} from '../utils/cameraShake'
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
// Was 26. That was the actual cause of the stoppie, and no amount of
// inertia or bias tuning could hide it: at 26 the car shed 39.7 u/s in
// 430ms over 7.4 units, about 92 u/s^2 or 4.6g. Nothing with wheels stops
// like that, and the pitch impulse that comes with it put the nose 78
// degrees down. At 6 a clean stop from 19.8 u/s takes ~300-365ms over 3
// units (~55-67 u/s^2) and the nose dips 8.7 degrees — inside the ~9 the
// suspension can absorb on its own, so the rear stays planted. Braking
// still feels immediate; it just no longer outruns the tyres.
const BRAKE_FORCE          = 6
// Fraction of BRAKE_FORCE the FRONT axle gets. Full force on both axles
// pitched the car up over its front wheels — a stoppie — whenever reverse
// was stabbed at speed, worst of all coming off boost at ~38 u/s.
//
// Rear-biasing fixes that by being self-limiting: braking transfers weight
// onto the nose, which unloads the rear, so the rear brake's grip fades at
// exactly the moment the tail starts to come up. A front-biased brake does
// the opposite — it bites hardest precisely when the rear is lightest. Real
// cars do bias forward (~70/30), but they have anti-dive suspension
// geometry and a far lower centre of mass than this chassis, whose CoM sits
// above the contact patches with nothing but PITCH_INERTIA resisting it.
const BRAKE_BIAS_FRONT     = 0.35
// Brake pressure ramps in instead of slamming to full in a single frame.
// This is what actually causes the stoppie: statically the car cannot lift
// at all — total brake force is ~35 against a rear-lift threshold of ~112
// (m*g*d = 40*1.4 against a CoM only ~0.5 up) — so it was never a force
// problem, it was an IMPULSE problem. A step input straight to full brake
// hands PITCH_INERTIA the whole change in one tick, and the nose snaps
// down far enough to bottom the front suspension and flick the tail up.
// Spreading the same peak force over ~0.2s removes the spike and costs
// nothing in stopping distance. Real pedals build pressure this way too.
const BRAKE_RAMP_UP        = 55    // force units per second, building
const BRAKE_RAMP_DOWN      = 300   // released fast, so it never feels laggy

// Anti-dive. This chassis has no anti-dive suspension geometry, so once the
// nose does start to drop there is nothing but PITCH_INERTIA to stop it.
// A corrective torque proportional to how far it has pitched stands in for
// that missing geometry. Deadzoned so ordinary brake dive still reads, and
// capped so it can never launch the car the other way.
const ANTI_DIVE_DEADZONE   = 0.035 // ~2 degrees of nose-down before it acts
const ANTI_DIVE_GAIN       = 145
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
const PITCH_INERTIA  = 14   // local X — resists wheelie/stoppie (was 9; 9 still let a hard stop reach 31 deg nose-down)
const YAW_INERTIA    = 2.6  // local Y — steering turn-in response
const ROLL_INERTIA   = 1.2  // local Z — cornering lean / bump response
// Dropped from -0.05. Braking torque is force x CoM HEIGHT, so the moment
// arm is the most direct lever on dive there is: at -0.05 the CoM sat ~0.50
// above the contact patches, and every braking newton got that much leverage
// to rotate the car about its front axle. At -0.20 it is ~0.35, cutting the
// pitch torque ~30% for free. Also a real muscle car's mass sits low.
const CHASSIS_COM    = { x: 0, y: -0.12, z: 0 }

// ── Camera ──────────────────────────────────────────────────────────────────
// Camera sits at +Z (south) relative to car
// Car faces -Z (north) → _fwd = (0,0,-1)
// W pressed → car moves in -Z → moves north → away from camera → FORWARD ✓
const CAM_OFFSET = new THREE.Vector3(8, 18, 20)
const CAM_LERP   = 3.5
// The camera's AIM is smoothed separately from its position, and only
// vertically. Horizontally it tracks the car exactly, or the car drifts off
// centre; vertically it must not, because the chassis bobs on its
// suspension over every bump and the look-at target is what sets the whole
// frame's orientation. At ~30 units back, half a suspension stroke swings
// the view about a tenth of a degree — per frame, in a random direction,
// which is precisely what "the camera isn't smooth" looks like. Flat ground
// hid this completely: before there was rough ground to drive on, the car's
// y never moved.
const LOOK_Y_LERP = 4

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
const _lat    = new THREE.Vector3()

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
// car-1.glb is a single Draco mesh on one texture-atlas material, so its
// lamps are painted into the texture and there is no per-lamp material to
// make emissive. These are lamp units laid over those painted lenses.
//
// The first pass put one flat emissive slab on each end. They read as
// aftermarket parts bolted to the bumper, because that is essentially what
// they were: rectangular, oversized, and standing proud of the bodywork.
// Period muscle cars are the opposite — QUAD ROUND headlamps sunk into the
// front fascia behind a dark bezel, and vertical TRI-BAR tail lamps
// recessed into the rear panel. Both are modelled that way now, and both
// are pulled ~0.07 back from the body's extremes so the bezel sits in the
// panel instead of hovering off it.
//
// Positions are chassis-local and come from the model's own bounds, not the
// collider's: the collider is 1.8 x 3.4 but the bodywork is 2.38 x 4.94
// (glTF POSITION accessor, then the -0.25 y offset and the PI y-rotation
// the primitive is mounted with). Extents: x +-1.19, y -0.49..1.21,
// nose z -2.47, tail z +2.47. Sizing off the collider buries them.
const LAMP_X        = 0.66
const LAMP_Y_FRONT  = 0.32
const LAMP_Z_FRONT  = -2.40
const LAMP_Y_REAR   = 0.52
const LAMP_Z_REAR   = 2.40
const HEAD_RADIUS   = 0.125
const HEAD_SPLIT    = 0.16   // half the gap between each pair's two lamps

// Tail idle must be BOTH a dim emissive and a dark base colour. The lens
// used to idle bright red, so flaring it just clipped an already-saturated
// channel and the brake did nothing visible even though the material was
// measurably changing. Dark red at 0.18 -> full glow at 6.0 is a jump you
// cannot miss.
const TAIL_IDLE     = 0.18
const TAIL_BRAKING  = 6.0

// Bump feedback: a jump in the chassis' vertical velocity within one frame
// means a wheel just rode up something. The rock colliders kick the body
// directly (EnvironmentModels.jsx), but small stones are only ever touched
// by the wheel raycasts, never by the chassis collider, so they'd otherwise
// pass under the car in total silence.
const BUMP_DV       = 1.1

// ── Surface roughness ──────────────────────────────────────────────────────
// Read straight off the wheels. wheelContactPoint(i).y is the height of
// whatever each tyre is standing on this frame, so the frame-to-frame change
// in it IS the profile of the surface being driven over — no collision
// events, no material tags, no per-surface bookkeeping. Summed across the
// four wheels and divided by the distance the car actually covered, it
// becomes a slope: dimensionless, and identical at 30 fps and 60 fps, where
// a raw per-frame height delta would read twice as rough at half the frame
// rate.
//
// Averaged over the wheels actually touching the ground, not summed, so the
// figure is a per-tyre slope. That matters at the edge of a patch: with two
// wheels on gravel and two on sand the average halves, and the car rumbles
// half as hard, which is the correct answer. A sum would instead report the
// same roughness for two rough wheels as for four half-rough ones.
//
// The divisor is the distance the chassis ACTUALLY moved since the previous
// sample, not speed x frame delta. Those two disagree the moment the render
// loop and the physics step drift apart — a backgrounded tab, a dropped
// frame, a slow device — and the slope is then wrong by exactly that ratio,
// which silently retunes the whole effect. Differencing the position makes
// the measurement true at any frame rate, and means this can be tuned from
// a log taken anywhere.
//
// Sand, asphalt and the circuit are all one flat collider here, so this
// reads exactly 0 on them — measured in the running game, not assumed. That
// clean zero is what makes the constant below safe to set low.
//
// And it IS deliberately low. Tracing a wheel's line across the heightfield
// offline puts the per-tyre slope near 0.04; logging the same crossing in
// the running game puts it nearer 0.28, because the contact point is not a
// point sliding along fixed geometry — the chassis pitches and rolls, the
// ray origins move with it, and each hit lands somewhere slightly different.
// Rather than pick a threshold that only works if one of those two numbers
// is right, 0.10 sits below both, so gravel reads strongly either way. The
// cost is that the roughest and mildest gravel feel similar, which is a
// cheap price when gravel is the only rough surface in the world — and
// partial contact still grades down, because the average is per tyre.
//
// One known limit: past ~25 u/s a wheel covers more than a whole 0.42 cell
// of the gravel heightfield per frame, so consecutive samples stop being
// correlated and the figure under-reads — a boost run over gravel rumbles
// at about two thirds of a cruise. Fixing it would mean teaching this file
// the heightfield's cell size, which is a worse trade than the error.
const ROUGH_FULL_SLOPE = 0.10  // per-tyre slope counting as full rumble
const ROUGH_RELEASE    = 7     // per second, once the wheels find smooth ground
const ROUGH_MIN_SPEED  = 1.5   // below this the slope figure is division noise
const ROUGH_FADE_SPEED = 11    // rumble is at full strength from here up

// ── Where the vibration is shown ──────────────────────────────────────────
// On the CAR, not on the camera. Shaking the camera moves the sky, the road
// and the horizon along with the car, which reads as a fault in the display
// rather than as a vehicle on a rough surface; the car is the thing on the
// gravel, so the car is the thing that shakes and the camera holds the shot
// level (cameraShake.js keeps only discrete impacts).
//
// Two layers do it:
//
// 1. A real torque on the chassis. Random but zero-mean, so it can never
//    push the car anywhere — it only shakes it in place. Weighted onto
//    roll, which has by far the softest inertia (1.2 against pitch's 14)
//    and so shows the most for the least disturbance. Kept modest: this
//    goes through the physics, and a raycast vehicle with full rotation
//    freedom can trip itself over if it is shoved hard enough.
const CHATTER_TORQUE = 3.6

// 2. A cosmetic judder on the bodywork, applied to a group INSIDE the rigid
//    body so it cannot touch handling at all — the collider and the wheel
//    raycasts stay exactly where physics put them, and only the visible
//    shell moves. This layer carries most of the effect, because the honest
//    amount of body movement is invisible from here: at this camera
//    distance the car is ~22 px per world unit, and a real car juddering on
//    gravel moves its body a centimetre or two, which is a fifth of a
//    pixel. So it is exaggerated on purpose, the same way the whole world
//    is stylised.
//
//    Rotation does the heavy lifting again — tilting the roofline reads far
//    more strongly than sliding the whole shape a pixel sideways.
//    These five are the dial. Turn them down together for a subtler shimmy,
//    up for a rougher one; nothing else has to change, and none of it can
//    affect how the car drives. Measured on an ordinary crossing the rumble
//    runs about 0.65, which puts the roll swing near +-3 degrees.
const BODY_SHAKE_FREQ  = 18     // Hz
const BODY_SHAKE_Y     = 0.070  // world units at full rumble
const BODY_SHAKE_XZ    = 0.028
const BODY_SHAKE_ROLL  = 0.070  // rad, ~4 degrees
const BODY_SHAKE_PITCH = 0.048
const BODY_SHAKE_YAW   = 0.020

// Gravel tugs at the steering. Smooth noise rather than per-frame random, so
// the car wanders as if the tyres were following ruts instead of buzzing on
// the spot; ~1 degree at full rumble against a 24-degree lock, which is felt
// without ever becoming a fight for control.
const STEER_NIBBLE = 0.019
const NIBBLE_FREQ  = 6   // Hz

// Two round lenses merged into one geometry, so a pair costs one draw call.
function quadLampGeometry(radius, depth) {
  const parts = [-HEAD_SPLIT, HEAD_SPLIT].map((dx) => {
    const g = new THREE.CylinderGeometry(radius, radius, depth, 16)
    g.rotateX(Math.PI / 2)   // barrel axis along Z, lens facing the road
    g.translate(dx, 0, 0)
    return g
  })
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

// Three vertical bars merged into one geometry — the Mustang tail-lamp
// signature, and one material means the brake flare drives all three.
function triBarGeometry() {
  const parts = [-0.105, 0, 0.105].map((dx) => {
    const g = new THREE.BoxGeometry(0.085, 0.20, 0.045)
    g.translate(dx, 0, 0)
    return g
  })
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

// ── Wheels ────────────────────────────────────────────────────────────────
// car-1.glb is a single Draco mesh on one atlas material (one node, one
// mesh — checked), so its wheels are painted into the bodywork exactly like
// its lamps were. There is nothing in the model to rotate. These are real
// wheels laid over those painted ones, and Rapier already knows everything
// they need: wheelRotation gives the rolling angle, wheelSteering the front
// toe, and wheelSuspensionLength where the hub currently sits under the
// chassis. All three come free from the vehicle controller that is already
// running — the car has simply never drawn them.
//
// The roll angle is integrated here rather than read from the controller.
// Rapier documents wheelRotation(i) as "the wheel's current rotation angle
// on its axle", but in this build it does not accumulate: driving 29.5
// units — about 82 radians of roll — moved the reported angle by 0.1. So
// the angle comes from the one number that is unarguably right, the speed
// the car is actually travelling over the ground, divided by the radius the
// eye can see. Using the VISUAL radius rather than the physics one is
// deliberate: it makes the tread track the ground exactly, where the
// slightly smaller physics radius would read as a faint permanent slip.
//
// Negative because the car's forward is -Z: rotating a point at the top of
// the wheel about local +X sends it toward +Z, so rolling forward is the
// other way round.
//
// ── Jumbo alloys ──────────────────────────────────────────────────────────
// Where the model's own wheels are was MEASURED, not guessed. Binning the
// body's vertices below y=-0.28 on the outer flank gives two clean clusters
// with nothing at all between them — front centroid z=-1.50, rear z=+1.37.
// The physics axles sit at ∓1.40, so the front wheel was being drawn 0.10
// BEHIND its own arch, which is what made it look bolted on wrong.
//
// The fix is not to move the axles. Their wheelbase was stretched past the
// bodywork on purpose (see WHEEL_POSITIONS) for leverage against pitching,
// and moving it would change how the car drives. Instead the visual wheels
// get their own offset from the physics ones — the two were never the same
// thing and only looked it by coincidence.
// x is aligned to the painted wheel's own centre (±0.964, measured), not
// pushed outboard. That alignment is what stops the painted tyre swinging
// into view at full lock: off-centre by even 0.056, its far corner reaches
// 0.320 from our axle at 24 degrees of steer and would need a 0.64-wide
// wheel to stay hidden; centred, the same corner reaches only 0.268.
const WHEEL_VIS_OFFSET = [
  { x: -0.014, z: -0.10 },  // front-left
  { x:  0.014, z: -0.10 },  // front-right
  { x: -0.014, z: -0.03 },  // rear-left
  { x:  0.014, z: -0.03 },  // rear-right
]

// Jumbo, and deliberately proud of the arches: a 1.04 diameter on a 4.94
// body is about a fifth of the car's length where a stock muscle car is
// nearer a seventh. The bodywork is NOT raised to clear them, so they bulge
// past the arch line — a hot rod stance, and the reason they now bury the
// painted wheels underneath instead of merely overlapping them.
const WHEEL_VIS_RADIUS = 0.52
// Wide enough to keep the painted tyre buried through FULL steering lock.
// The painted wheel doesn't turn — it is part of the bodywork — so at 24
// degrees its corners swing out from behind ours. Measured against its real
// footprint (0.32 wide, radius 0.30) it needs 0.537, but the radius is the
// one figure the mesh won't give cleanly — the arch geometry sits in the
// same bins as the tyre, and the plausible range runs to 0.34, which would
// need 0.57. 0.60 covers the whole range instead of the midpoint of it.
// Fat, but that is what a drag radial looks like, and it is the whole
// reason the wheel stops showing its seams at lock.
const WHEEL_VIS_WIDTH  = 0.60
// The controller puts the hub exactly WHEEL_RADIUS above the ground, so
// drawing a bigger wheel there would sink the difference into the asphalt.
// This lifts the visual hub so the tread sits on the road. Physics is
// untouched: same axles, same radius, same suspension, same handling.
const VIS_LIFT = WHEEL_VIS_RADIUS - WHEEL_RADIUS

// Tyre, rim dish, five spokes and a hub cap, merged into one vertex-coloured
// geometry — so a whole alloy wheel is still ONE draw call and all four
// share a single material.
//
// The spokes are what make it read as an alloy rather than a black disc.
// They also give the eye something to track: a smooth wheel looks stationary
// however fast it turns, which was half of why the old ones looked fake.
// Rim/tyre proportions are deliberately low-profile — a big dish inside a
// thin sidewall is what "alloy" looks like at a glance.
const SPOKE_COUNT = 5

// Lifts the visible shell — bodywork and lamps together — off the wheels a
// touch, so the jumbo tyres don't look like they are swallowing the arches.
// Cosmetic only: it moves the drawn car, never the collider, the axles or
// the suspension, so the ride height the physics uses is untouched and the
// car drives exactly as before.
const BODY_LIFT = 0.07

function wheelGeometry() {
  const R = WHEEL_VIS_RADIUS, W = WHEEL_VIS_WIDTH
  const parts = []
  const paint = (g, r, gr, b) => {
    const n = g.attributes.position.count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gr; c[i * 3 + 2] = b }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    parts.push(g)
  }

  paint(new THREE.CylinderGeometry(R, R, W, 22), 0.035, 0.033, 0.031)          // tyre
  paint(new THREE.CylinderGeometry(R * 0.72, R * 0.72, W * 1.02, 18), 0.70, 0.69, 0.66) // dish

  // Spokes radiate in the wheel's own plane. Built before the final
  // rotateZ, so the barrel axis is still Y and the face plane is XZ.
  const rIn = R * 0.18, rOut = R * 0.70
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const g = new THREE.BoxGeometry(rOut - rIn, W * 1.04, R * 0.17)
    g.translate((rIn + rOut) / 2, 0, 0)
    g.rotateY((i / SPOKE_COUNT) * Math.PI * 2)
    paint(g, 0.80, 0.79, 0.76)
  }

  paint(new THREE.CylinderGeometry(R * 0.19, R * 0.19, W * 1.08, 12), 0.20, 0.19, 0.18) // hub cap

  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  // Barrel axis along X so the wheel rolls about its own local X.
  merged.rotateZ(Math.PI / 2)
  return merged
}
const WHEEL_GEO = wheelGeometry()

const HEAD_LENS_GEO  = quadLampGeometry(HEAD_RADIUS, 0.05)
const HEAD_BEZEL_GEO = quadLampGeometry(HEAD_RADIUS + 0.032, 0.055)
const TAIL_BAR_GEO   = triBarGeometry()

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
  const wheelGroundY = useRef([null, null, null, null])
  const roughRef     = useRef(0)
  const prevPos      = useRef(null)
  // The smoothed camera position BEFORE shake is added. Kept apart from
  // camera.position on purpose — see the camera block for why reading the
  // rendered position back is a feedback loop.
  const camBase      = useRef(null)
  const lookY        = useRef(null)
  const bodyShakeRef = useRef()
  const wheelRefs    = useRef([])
  const wheelSpin    = useRef(0)
  const brakePress  = useRef(0)
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
    _fwd.set(0, 0, -1).applyQuaternion(_quat)
    // Sign of the un-flattened forward vector's y: negative = nose down.
    // Grabbed before setY(0) below, which is what the steering/camera want.
    const noseY = _fwd.y
    _fwd.setY(0).normalize()
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

    // One ramped pressure drives both hard-brake paths below.
    const wantsHardBrake = brake || (backward && fwdSpeed > 0.5)
    brakePress.current += THREE.MathUtils.clamp(
      (wantsHardBrake ? BRAKE_FORCE : 0) - brakePress.current,
      -BRAKE_RAMP_DOWN * dt,
      BRAKE_RAMP_UP * dt,
    )
    const bp = brakePress.current

    if (backward && fwdSpeed > 0.5) {
      // Moving forward, pressing reverse → brake to a stop first instead
      // of instantly reversing direction.
      brakeRear  = bp
      brakeFront = bp * BRAKE_BIAS_FRONT
    } else if (forward) {
      engineForce = FORWARD_SIGN * (canBoost ? BOOST_ENGINE_FORCE : ENGINE_FORCE) / (1 + overflow)
    } else if (backward && fwdSpeed > -MAX_REV_SPEED) {
      engineForce = -FORWARD_SIGN * REVERSE_ENGINE_FORCE
    }

    if (brake) {
      brakeRear  = bp
      brakeFront = bp * BRAKE_BIAS_FRONT
    } else if (!forward && !backward) {
      // Idle "engine braking" only comes through the driven wheels in a real
      // RWD car — applying it to the front wheels too was pitching the nose
      // down hard (a "stoppie") when coasting off the accelerator at speed.
      //
      // Stays on the rear in both directions — engine braking reaches the
      // road through the driven wheels whichever way the car is rolling.
      // Only the magnitude changes: see IDLE_BRAKE_REVERSE above for why
      // the same number bites roughly 40% harder going backwards.
      brakeRear = Math.max(bp, fwdSpeed < -0.5 ? IDLE_BRAKE_REVERSE : IDLE_BRAKE)
    }

    // Steering — smoothed so a tapped key eases toward full lock instead of
    // snapping there instantly (the mobile wheel feeds analog values through
    // the same lerp, which just makes it track faster).
    steer.current = THREE.MathUtils.lerp(
      steer.current, steerInput, 1 - Math.exp(-STEER_LERP_SPEED * dt)
    )
    // roughRef still holds LAST frame's value here — the roughness block
    // below can only run after updateVehicle() has produced this frame's
    // wheel contacts. One frame of lag on a 6 Hz wander is not observable.
    const steerAngle = steer.current * STEER_MAX
      + shakeNoise(state.clock.elapsedTime * NIBBLE_FREQ, 17)
        * STEER_NIBBLE * roughRef.current

    for (const i of STEERED_WHEELS) {
      controller.setWheelSteering(i, steerAngle)
      controller.setWheelBrake(i, brakeFront)
    }
    for (const i of DRIVEN_WHEELS) {
      controller.setWheelEngineForce(i, engineForce)
      controller.setWheelBrake(i, brakeRear)
    }

    // ── Anti-dive ─────────────────────────────────────────────────────────
    // Applied AFTER the vehicle step, so it corrects the pitch the brake
    // just produced rather than being overwritten by it. Torque about the
    // car's own lateral axis: rotating positively about local +X lifts the
    // nose (forward is -Z, so y' = +sin(theta)). Proportional to how far
    // past the deadzone it has dived, and clamped, so it can only ever damp
    // the dive — never drive the car nose-up on its own.
    if (bp > 1 && noseY < -ANTI_DIVE_DEADZONE && lastSpeed.current > 3) {
      const dive = Math.min(-noseY - ANTI_DIVE_DEADZONE, 0.45)
      const k = dive * ANTI_DIVE_GAIN * dt
      _lat.set(1, 0, 0).applyQuaternion(_quat)
      body.applyTorqueImpulse({ x: _lat.x * k, y: _lat.y * k, z: _lat.z * k }, true)
    }

    controller.updateVehicle(dt)

    // Both the roughness read and the contact-shadow fade below need these;
    // guarded once because older rapier builds ship the controller without
    // the per-wheel query methods.
    const canQueryWheels =
      typeof controller.wheelIsInContact === 'function' &&
      typeof controller.wheelContactPoint === 'function'

    // ── Bump feedback ─────────────────────────────────────────────────────
    // Reads the suspension's own reaction rather than any collision event,
    // so it fires for anything the wheels ride over, rocks included.
    const dvy = lv.y - prevVy.current
    prevVy.current = lv.y
    // Rough ground clears BUMP_DV several times a second, so on gravel this
    // was firing a fresh camera impulse continuously — reintroducing exactly
    // the camera rumble that was deliberately moved onto the car. Gravel is
    // already represented by the body judder below; this channel is for
    // one-off events (landing a jump, clipping a boulder), so it stands down
    // once the wheels report a rough surface.
    if (dvy > BUMP_DV && lastSpeed.current > 3 && roughRef.current < 0.25) {
      triggerShake(Math.min(dvy / 7, 0.32), 220)
    }

    // ── Surface roughness → vibration ─────────────────────────────────────
    // See ROUGH_FULL_SLOPE above for what is being measured and why it is
    // divided by distance rather than by time.
    let stepSum = 0
    let contacts = 0
    if (canQueryWheels) {
      for (let i = 0; i < 4; i++) {
        if (!controller.wheelIsInContact(i)) { wheelGroundY.current[i] = null; continue }
        const cp = controller.wheelContactPoint(i)
        if (!cp) { wheelGroundY.current[i] = null; continue }
        contacts++
        const prev = wheelGroundY.current[i]
        wheelGroundY.current[i] = cp.y
        // A wheel that was airborne last frame has no previous height to
        // difference against — landing is a bump, not a rough surface, and
        // BUMP_DV above already covers it.
        if (prev !== null) stepSum += Math.abs(cp.y - prev)
      }
    }
    const here = body.translation()
    const prevP = prevPos.current
    const travelled = prevP
      ? Math.hypot(here.x - prevP.x, here.z - prevP.z)
      : 0
    if (prevP) { prevP.x = here.x; prevP.z = here.z }
    else prevPos.current = { x: here.x, z: here.z }
    const roughTarget = (contacts > 0 && lastSpeed.current > ROUGH_MIN_SPEED && travelled > 1e-4)
      ? Math.min((stepSum / contacts / travelled) / ROUGH_FULL_SLOPE, 1)
      : 0
    // Instant attack, smoothed release: the first stone is felt on the frame
    // it is hit, but the rumble doesn't strobe off in the gaps between them.
    roughRef.current = roughTarget > roughRef.current
      ? roughTarget
      : roughRef.current + (roughTarget - roughRef.current) * (1 - Math.exp(-ROUGH_RELEASE * dt))
    // Exponential decay approaches zero without ever arriving, and a
    // roughness of 1e-8 is still not zero to everything downstream — the
    // gravel bed below would keep scheduling Web Audio ramps on every frame
    // for the rest of the session. Snap the tail off.
    if (roughRef.current < 0.002) roughRef.current = 0

    // Crawling over gravel is a series of individual clonks, not a
    // vibration; the rumble has to earn its intensity from road speed.
    const rumble = roughRef.current *
      THREE.MathUtils.smoothstep(lastSpeed.current, ROUGH_MIN_SPEED, ROUGH_FADE_SPEED)

    if (rumble > 0.01) {
      const k = rumble * CHATTER_TORQUE * dt
      body.applyTorqueImpulse({
        x: (Math.random() - 0.5) * k * 0.30,
        y: (Math.random() - 0.5) * k * 0.12,
        z: (Math.random() - 0.5) * k,
      }, true)
    }

    // Cosmetic judder on the shell. Smoothstepped so a whisper of roughness
    // stays a whisper — a linear map made the faintest ground texture read
    // as a real vibration. Written every frame including at zero, or the
    // bodywork would stay frozen at whatever offset it had when the car
    // rolled back onto smooth ground.
    const shell = bodyShakeRef.current
    if (shell) {
      const a = rumble * rumble * (3 - 2 * rumble)
      const t = state.clock.elapsedTime * BODY_SHAKE_FREQ
      shell.position.set(
        shakeNoise(t, 21) * BODY_SHAKE_XZ * a,
        BODY_LIFT + shakeNoise(t, 22) * BODY_SHAKE_Y * a,
        shakeNoise(t, 23) * BODY_SHAKE_XZ * a,
      )
      shell.rotation.set(
        shakeNoise(t, 24) * BODY_SHAKE_PITCH * a,
        shakeNoise(t, 25) * BODY_SHAKE_YAW   * a,
        shakeNoise(t, 26) * BODY_SHAKE_ROLL  * a,
      )
    }
    // Called unconditionally, including with 0 — the gravel bed is a
    // permanently running noise source whose gain is ridden, so skipping the
    // call on smooth ground would leave it stuck at its last level.
    updateGravel(gameStarted ? rumble : 0, lastSpeed.current)

    // ── Brake lights ──────────────────────────────────────────────────────
    // `backward` while still rolling forwards is the brake-to-stop case
    // handled above, so it lights the lamps too — same as lifting off and
    // stabbing the brake would in a real car.
    // Lit whenever a brake input is HELD, not only while the car still
    // happens to be rolling forwards. The old `backward && fwdSpeed > 0.5`
    // cut the lamps the instant the car crossed into reverse, so holding
    // the down arrow flashed them off mid-press. Down-arrow is this game's
    // brake pedal — it brakes to a stop before it ever reverses — so it
    // lights them for as long as it is held, which is what a car does.
    const braking = brake || backward
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
      if (canQueryWheels) {
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

    // ── Wheels ────────────────────────────────────────────────────────────
    // Deliberately NOT children of the judder group above: the bodywork
    // shivers on rough ground, the wheels are the thing actually touching
    // it. Keeping them out of that group means the shell shakes over planted
    // wheels, which is what a car does — and it is more convincing than
    // moving both together.
    // Signed, so reversing rolls them backwards and braking slows them; and
    // it keeps running while airborne, because the car is still travelling.
    wheelSpin.current -= (fwdSpeed / WHEEL_VIS_RADIUS) * dt
    if (canQueryWheels) {
      for (let i = 0; i < 4; i++) {
        const w = wheelRefs.current[i]
        if (!w) continue
        const conn = WHEEL_POSITIONS[i]
        const off  = WHEEL_VIS_OFFSET[i]
        // Ride height: the hub hangs below its chassis mounting point by
        // however far the suspension is currently extended.
        const susp = controller.wheelSuspensionLength(i)
        w.position.set(
          conn.x + off.x,
          conn.y - (typeof susp === 'number' && isFinite(susp) ? susp : SUSPENSION_REST_LENGTH)
            + VIS_LIFT,
          conn.z + off.z,
        )
        w.rotation.y = controller.wheelSteering(i) || 0
        w.children[0].rotation.x = wheelSpin.current
      }
    }

    // Camera — always follows car; still no hard zone override (the
    // billboard needs a fairly consistent approach angle to stay face-on),
    // just a brief additive bias below that decays on its own.
    // Zoom scales continuously with speed rather than a binary boost swap —
    // boost already raises lastSpeed toward TOP_SPEED_BOOST, so it pulls the
    // camera back further through this curve without a special case.
    const pos = body.translation()
    _carPos.set(pos.x, pos.y, pos.z)
    if (!camBase.current) camBase.current = state.camera.position.clone()
    _cam.copy(camBase.current)
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
    // Bank the SMOOTHED position before the shake goes on. Reading
    // camera.position back at the top of the next frame instead — which is
    // what this used to do — feeds the shake offset into its own smoothing
    // filter: the lerp starts from an already-displaced point, displaces it
    // again, and the error integrates. White noise mostly cancelled itself
    // out through that loop, which is why it was survivable before; smooth
    // noise is correlated frame to frame, so it accumulates into a slow
    // wander that reads as the camera never quite settling.
    camBase.current.copy(_cam)

    updateShake(dt)
    applyShake(_cam)
    state.camera.position.copy(_cam)

    // Aim: exact horizontally, damped vertically (see LOOK_Y_LERP).
    const wantY = pos.y + 0.5
    if (lookY.current === null) lookY.current = wantY
    lookY.current += (wantY - lookY.current) * (1 - Math.exp(-LOOK_Y_LERP * dt))
    _look.set(pos.x, lookY.current, pos.z)
    state.camera.lookAt(_look)
    // After lookAt, never before — lookAt writes the full orientation and
    // would overwrite any roll added ahead of it.
    applyShakeRotation(state.camera)
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

      {/* Outer group steers, inner mesh rolls — two axes that must not fight
          each other, so they get a level of nesting each. */}
      {WHEEL_POSITIONS.map((w, i) => (
        <group
          key={`wh${i}`}
          ref={(g) => { wheelRefs.current[i] = g }}
          position={[w.x + WHEEL_VIS_OFFSET[i].x, w.y, w.z + WHEEL_VIS_OFFSET[i].z]}
        >
          <mesh geometry={WHEEL_GEO}>
            <meshLambertMaterial vertexColors flatShading />
          </mesh>
        </group>
      ))}

      {/* Everything visible hangs off this group, and nothing physical does.
          The frame loop judders it over rough ground (BODY_SHAKE_* above);
          because the collider above is a sibling and not a child, none of
          that reaches the simulation — the shell shivers, the car drives
          exactly as it did. Lamps are inside it too, or they would hang in
          the air while the bodywork moved out from under them. */}
      <group ref={bodyShakeRef}>
        {HAS_GLTF ? (
          <Suspense fallback={<BoxCar />}>
            <GLTFCar />
          </Suspense>
        ) : (
          <BoxCar />
        )}

        {/* Headlamps — quad round, sunk behind a dark bezel. Two lenses per
            side are merged into one geometry, so each pair is one draw call. */}
        {[-LAMP_X, LAMP_X].map((x) => (
          <group key={`hl${x}`} position={[x, LAMP_Y_FRONT, LAMP_Z_FRONT]}>
            {/* Bezel sits a touch behind and 0.032 wider, so a dark ring shows
                round each lens and the unit reads as set INTO the fascia. */}
            <mesh geometry={HEAD_BEZEL_GEO} position={[0, 0, 0.007]}>
              <meshStandardMaterial color="#0d0b09" roughness={0.35} metalness={0.75} />
            </mesh>
            {/* Warm, and deliberately not blown out — the old 1.7 on a near
                white emissive clipped every channel, which is exactly what
                made these look like flat paper cut-outs. */}
            <mesh geometry={HEAD_LENS_GEO}>
              <meshStandardMaterial
                color="#fff4dd"
                emissive="#ffd89a"
                emissiveIntensity={1.05}
                toneMapped={false}
                roughness={0.1}
              />
            </mesh>
          </group>
        ))}

        {/* Tail lamps — three vertical bars per side in a recessed housing.
            Materials are collected so the frame loop can flare them. */}
        {[-LAMP_X, LAMP_X].map((x, i) => (
          <group key={`tl${x}`} position={[x, LAMP_Y_REAR, LAMP_Z_REAR]}>
            {/* Housing behind the bars — the tail faces +Z, so "behind" is -Z. */}
            <mesh position={[0, 0, -0.009]}>
              <boxGeometry args={[0.40, 0.27, 0.05]} />
              <meshStandardMaterial color="#0d0b09" roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh geometry={TAIL_BAR_GEO}>
              <meshStandardMaterial
                ref={(m) => { if (m) tailMats.current[i] = m }}
                color="#4a0d05"
                emissive="#ff2008"
                emissiveIntensity={TAIL_IDLE}
                toneMapped={false}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}
      </group>
    </RigidBody>
    </>
  )
}

const Vehicle = forwardRef(VehicleInner)
export default Vehicle
