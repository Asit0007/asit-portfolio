import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { triggerShake } from '../utils/cameraShake'

// Empty SW quadrant, symmetric opposite the racing circuit (NE, center
// [90,-90] — see Circuit.jsx). Same clearance reasoning: ~127 units from
// the origin, well beyond the tree/rock scatter radius (max ~94) and every
// zone's exclusion box.
const BOWLING_CENTER = [-90, 90]
// The lane now reaches 32 units up-alley (see LANE_X_MAX), so the old
// RESET_RADIUS of 34 sat almost exactly on the entry: lining up a shot from
// the approach would have tripped the "abandoned attempt" reset and stood
// the pins back up under the player. Both radii are now derived from the
// lane's real extent rather than a number that predated it.
// The reset pad — a marker on the ground at the mouth of the alley, which
// the car necessarily drives over on its way in. Touching it raises the
// ENTER prompt; nothing happens until the player actually presses it, so
// driving across the pad mid-run can't wipe an attempt by accident.
// Footprint verified clear of the circuit the same way the lane was: the
// pad's nearest corner sits 7.4 units off the track's outer edge.
const PAD_LOCAL      = [34.5, 0]
const PAD_RADIUS     = 2.6
const PAD_TRIGGER    = 3.9  // pad radius + roughly half a car length
const RESET_RADIUS   = 60   // reset an abandoned attempt once the player is this far away
const RESET_DELAY_MS = 4000 // after a strike, before pins reset

// Dimensions taken from folio-2025's actual areas.glb and scaled by ~0.875
// (its truck chassis is 3.0×1.8 vs our car's 3.4×1.9, close enough to
// borrow absolute sizes): folio pin h=2.97/r=0.51 → 2.6/0.45; ball r≈0.97
// → 0.85; pin triangle spacing 1.44 lateral / 1.15 per row → 1.26/1.0.
// Like folio, the pins deliberately tower over the car — that's the joke.
// A regulation USBC pin is 15" tall, 2.031" across the base, bellies out to
// 4.766" about 4.5" up, pinches to a 1.797" neck, then flares to a ~2.6"
// crown. The old pin was none of that — a plain truncated cone whose base
// WAS its widest point at 0.346 of its height, against a real base of
// 0.135. That silhouette is a skittle, not a bowling pin, and it's what
// made the pin/ball proportion read wrong.
//
// Regulation ball is 8.5" across, so pin height : ball diameter = 1.76 : 1.
// Ours was 1.53 : 1. Keeping BALL_RADIUS at 0.85 and taking the pin to 3.0
// lands on 1.765 : 1 — regulation, and it keeps the "pins tower over the
// car" gag this area was built around rather than shrinking the ball.
const PIN_HEIGHT   = 3.0
const PIN_START_Y  = PIN_HEIGHT / 2

// Profile of one half of the pin, revolved by LatheGeometry: [t, r] where t
// is height as a fraction of PIN_HEIGHT and r is radius in the same unit.
// Digitised from the USBC dimension sheet (inches / 15).
const PIN_PROFILE = [
  [0.000, 0.0677], [0.017, 0.0733], [0.033, 0.0800], [0.067, 0.0947],
  [0.100, 0.1120], [0.133, 0.1280], [0.167, 0.1420], [0.200, 0.1520],
  [0.233, 0.1573], [0.267, 0.1589], [0.300, 0.1587], [0.333, 0.1567],
  [0.367, 0.1527], [0.400, 0.1467], [0.467, 0.1307], [0.533, 0.1120],
  [0.600, 0.0927], [0.667, 0.0760], [0.717, 0.0640], [0.750, 0.0599],
  [0.783, 0.0620], [0.817, 0.0700], [0.850, 0.0787], [0.883, 0.0853],
  [0.907, 0.0867], [0.933, 0.0840], [0.960, 0.0747], [0.983, 0.0567],
  [1.000, 0.0267],
]

// The two red neck bands every real pin carries.
const PIN_STRIPES = [[0.640, 0.690], [0.720, 0.770]]

const PIN_CREAM = new THREE.Color('#f5f0e8')
const PIN_RED   = new THREE.Color('#c4154a')

function radiusAt(t) {
  const P = PIN_PROFILE
  for (let i = 1; i < P.length; i++) {
    if (t <= P[i][0]) {
      const [t0, r0] = P[i - 1]
      const [t1, r1] = P[i]
      return r0 + (r1 - r0) * ((t - t0) / (t1 - t0 || 1))
    }
  }
  return P[P.length - 1][1]
}

// One geometry shared by all ten pins, with the stripes baked in as vertex
// colours. The old pin was body + stripe as two separate meshes, i.e. 20
// draw calls for the rack; this is 10, and the stripe edges are crisp
// because the band boundaries are inserted as real profile points (Lathe
// only creates vertices where the profile has them, so without this the
// colour would smear across the whole neck).
function buildPinGeometry() {
  const ts = new Set(PIN_PROFILE.map(([t]) => t))
  PIN_STRIPES.flat().forEach((t) => ts.add(t))
  const sorted = [...ts].sort((a, b) => a - b)

  const points = sorted.map(
    (t) => new THREE.Vector2(radiusAt(t) * PIN_HEIGHT, (t - 0.5) * PIN_HEIGHT)
  )
  const geo = new THREE.LatheGeometry(points, 14)

  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const inStripe = (t) => PIN_STRIPES.some(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6)
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / PIN_HEIGHT + 0.5
    const c = inStripe(t) ? PIN_RED : PIN_CREAM
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

// Standard 10-pin triangle. The alley runs east–west ("horizontal" on the
// map): apex toward +X — the map-center side a car approaching from the
// rest of the world naturally enters from. Real-bowling tight spacing per
// folio rather than the old car-width spread — the ball is now big enough
// to do the plowing.
// Pin-to-pin spacing 1.75 with rows at 1.75*cos30 = 1.515, an equilateral
// triangle like the real rack. The old 1.26/1.0 was set for a cone whose
// widest point was its base; a pin that bellies to 0.954 across would leave
// only 0.3 of air between neighbours at that spacing and read as a huddle.
// Regulation is 12" between pins on a 42" lane = 0.8 of pin height, which
// here would be 2.4 and put the back row 7.2 wide on a 7-wide lane — so
// this is as close to real as the alley's own width allows.
const PIN_LOCAL_POSITIONS = [
  [0, 0],
  [-1.515, -0.875], [-1.515, 0.875],
  [-3.030, -1.750], [-3.030, 0], [-3.030, 1.750],
  [-4.545, -2.625], [-4.545, -0.875], [-4.545, 0.875], [-4.545, 2.625],
]

// A separate physics ball the car pushes into the pins — matching folio's
// actual mechanic (its ball is "just another dynamic rigid body the
// player's car rolls into," no throw/grab). Like folio, it sits well up
// the lane so there's a run-up before impact.
const BALL_LOCAL   = [20, 0]  // east of the pins, up the lane's run-up
const BALL_RADIUS  = 0.85
const BALL_START_Y = BALL_RADIUS

// The lane — folio flanks its lane with long bumper rails (~0.84 high in
// its world units) that keep ball and pins contained; same here. The rails
// are fixed rigid bodies, the lane floor is visual only (the ground's own
// collider does the physical work).
const LANE_WIDTH       = 7
// Lane extent, in local coords along the alley. -8 is the backstop behind
// the pins; 32 is the entry the car drives in from. Verified numerically
// against the racing circuit before being changed: at this footprint the
// nearest point of the lane sits 11.6 units clear of the track's outer
// edge. x=42 leaves only 2.2, and x=48 overlaps the circuit outright — so
// this is close to the ceiling, not an arbitrary number. Re-run that check
// if you extend it (CHECKPOINT 5 is the constraint; see track.js).
const LANE_X_MIN       = -8
const LANE_X_MAX       = 32
const LANE_LENGTH      = LANE_X_MAX - LANE_X_MIN          // 40, was 24
const LANE_CENTER_X    = (LANE_X_MIN + LANE_X_MAX) / 2    // 12
const GUTTER_WIDTH     = 0.7
const BUMPER_HEIGHT    = 0.84
const BUMPER_THICKNESS = 0.5

// Lane surface detail. The old floor was a single flat box; these are the
// markings that actually make a lane read as a lane.
const PLANK_COUNT   = 15                       // lengthwise boards
// The deck has to start UP-alley of the headpin, not behind it: pins occupy
// local x 0 (headpin) down to -3 (back row), so a boundary at -3.6 put the
// whole rack on the oiled lane with the pale deck stranded behind them.
const PIN_DECK_X    = 1.2                      // paler deck the pins stand on
const FOUL_LINE_X   = 24                       // approach ends / lane begins
const ARROW_X       = 12                       // the 7 aiming darts
const SURFACE_Y     = 0.025
const MARKING_Y     = 0.037                    // above SURFACE_Y, no z-fighting
const GUTTER_Y      = 0.012                    // below it, so gutters read as recessed

const _up     = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _vPos   = new THREE.Vector3()
const _center = new THREE.Vector3(BOWLING_CENTER[0], 0, BOWLING_CENTER[1])
const _padCenter = new THREE.Vector3(
  BOWLING_CENTER[0] + PAD_LOCAL[0], 0, BOWLING_CENTER[1] + PAD_LOCAL[1]
)

const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 }
const ZERO_VEC      = { x: 0, y: 0, z: 0 }

function pinWorldPosition([lx, lz]) {
  return [BOWLING_CENTER[0] + lx, PIN_START_Y, BOWLING_CENTER[1] + lz]
}

function ballWorldPosition() {
  return [BOWLING_CENTER[0] + BALL_LOCAL[0], BALL_START_Y, BOWLING_CENTER[1] + BALL_LOCAL[1]]
}


// ── Lane surface ──────────────────────────────────────────────────────────
// Every marking below is baked into ONE merged, vertex-coloured geometry —
// the same technique Circuit.jsx uses for its 2-draw-call track, and the
// reason a lane with 45 boards, a pin deck, a foul line, 7 aiming darts and
// two gutters still costs a single draw call (DESIGN.md §8.6).
function coloured(geo, hex) {
  const c = new THREE.Color(hex)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

function buildLaneGeometry() {
  const parts = []
  // box(): length along the alley, width across it, centred on (x, z)
  const box = (len, wid, hex, x, y, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(len, 0.02, wid)
    if (rotY) g.rotateY(rotY)
    g.translate(x, y, z)
    parts.push(coloured(g, hex))
  }

  // Boards. Each plank is split into deck / lane / approach rather than
  // overlaid with a second quad, so no two coplanar faces ever z-fight.
  const plankW = LANE_WIDTH / PLANK_COUNT
  const spans = [
    [LANE_X_MIN,  PIN_DECK_X,  ['#efe3c6', '#e6d7b6']], // pin deck — paler
    [PIN_DECK_X,  FOUL_LINE_X, ['#e2c08c', '#d3ad76']], // oiled lane
    [FOUL_LINE_X, LANE_X_MAX,  ['#c6b193', '#b8a184']], // approach — drier, greyer wood
  ]
  for (let i = 0; i < PLANK_COUNT; i++) {
    const z = -LANE_WIDTH / 2 + plankW * (i + 0.5)
    for (const [x0, x1, tones] of spans) {
      box(x1 - x0, plankW, tones[i % 2], (x0 + x1) / 2, SURFACE_Y, z)
    }
  }

  // Foul line, and the darker seam where the deck starts.
  box(0.34, LANE_WIDTH, '#8c2033', FOUL_LINE_X, MARKING_Y, 0)
  box(0.16, LANE_WIDTH, '#a98a55', PIN_DECK_X,  MARKING_Y, 0)

  // The 7 aiming darts, in the standard triangle: the centre one sits
  // furthest down the alley, the outer ones step back toward the bowler.
  for (let k = -3; k <= 3; k++) {
    box(0.42, 0.42, '#8a6134', ARROW_X + Math.abs(k) * 1.5, MARKING_Y, k * 0.82, Math.PI / 4)
  }

  // Gutters, dropped below the playing surface so they read as channels.
  const gz = LANE_WIDTH / 2 + GUTTER_WIDTH / 2
  for (const z of [-gz, gz]) {
    box(LANE_LENGTH, GUTTER_WIDTH, '#2c1d10', LANE_CENTER_X, GUTTER_Y, z)
  }

  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

function Lane() {
  const geo = useMemo(() => buildLaneGeometry(), [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo} position={[BOWLING_CENTER[0], 0, BOWLING_CENTER[1]]}>
      <meshStandardMaterial vertexColors roughness={0.65} />
    </mesh>
  )
}

function Ball({ ballRef, position }) {
  return (
    <RigidBody
      ref={ballRef}
      position={position}
      colliders={false}
      // Lowered from 0.25/0.1 together with the lane going 24 -> 40 units.
      // At the old damping the ball washed off most of its speed before it
      // reached the pins on a lane this long; a bowling ball should carry.
      linearDamping={0.12}
      angularDamping={0.05}
    >
      {/* One explicit smooth sphere collider. Auto `colliders="ball"` would
          also wrap each cosmetic finger-hole mesh in its own tiny collider —
          three bumps protruding past the surface that made the ball thump
          instead of roll. */}
      {/* Lightened with everything else, but by proportionally less than the
          pins — the ball:pin mass ratio actually RISES from 15:1 to 19:1, so
          it scatters them harder than before despite weighing less. */}
      <BallCollider args={[BALL_RADIUS]} mass={0.85} restitution={0.35} />
      <mesh>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        {/* Polyurethane-ball finish: near-mirror, barely metallic. */}
        <meshStandardMaterial color="#3f1a63" roughness={0.12} metalness={0.35} />
      </mesh>
      {/* Finger holes. The old version was three spheres sitting ON the
          surface, which read as bumps rather than holes — and, being convex,
          caught the light exactly the wrong way. These are dark cylinders
          sunk along the radius so their rim is flush and the inside is in
          shadow: the thumb hole apart, two finger holes together, the real
          asymmetric layout. */}
      {[[0.30, 0, 0.135], [-0.19, 0.27, 0.108], [-0.19, -0.27, 0.108]].map(([hx, hz, r], i) => {
        const surfaceY = Math.sqrt(BALL_RADIUS * BALL_RADIUS - hx * hx - hz * hz)
        return (
          <mesh key={i} position={[hx, surfaceY - 0.10, hz]}>
            <cylinderGeometry args={[r, r * 0.86, 0.24, 12]} />
            <meshStandardMaterial color="#150822" roughness={0.95} />
          </mesh>
        )
      })}
    </RigidBody>
  )
}

function Pin({ pinRef, position, geometry }) {
  return (
    <RigidBody
      ref={pinRef}
      position={position}
      // Hull, not cuboid. A box around a bellied pin collides at its widest
      // point all the way down, so pins bounced off each other's invisible
      // corners near the base; the hull follows the real silhouette.
      colliders="hull"
      // A pin's job is to tumble. angularDamping at 0.5 was the real
      // culprit here rather than the mass — it bled off spin the instant
      // the pin started to topple, so pins slumped over in place instead
      // of cartwheeling off the deck.
      mass={0.045}
      linearDamping={0.06}
      angularDamping={0.12}
      restitution={0.5}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.42} />
      </mesh>
    </RigidBody>
  )
}

// The lane's boundary rails — visual boundary line + physical containment
// in one, like folio's bumpers.
function Bumpers() {
  const railZ = LANE_WIDTH / 2 + GUTTER_WIDTH + BUMPER_THICKNESS / 2
  return (
    <>
      {[-railZ, railZ].map((z, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid"
          position={[BOWLING_CENTER[0] + LANE_CENTER_X, BUMPER_HEIGHT / 2, BOWLING_CENTER[1] + z]}>
          <mesh>
            <boxGeometry args={[LANE_LENGTH, BUMPER_HEIGHT, BUMPER_THICKNESS]} />
            <meshStandardMaterial color="#c4154a" roughness={0.55} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

// The reset pad. Flat disc + ring + a ↻ lying on the ground, plus a soft
// vertical beam so it still reads from across the desert at the shallow
// angle the follow-cam actually looks from — a ground decal alone is close
// to invisible from a car.
function ResetPad({ matRef, beamRef }) {
  return (
    <group position={[_padCenter.x, 0, _padCenter.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[PAD_RADIUS, 40]} />
        <meshStandardMaterial
          ref={matRef}
          color="#1c0a12" emissive="#c4154a" emissiveIntensity={0.28} roughness={0.5}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[PAD_RADIUS * 0.87, PAD_RADIUS, 40]} />
        <meshStandardMaterial color="#ffe0a0" emissive="#f0c060" emissiveIntensity={0.55} />
      </mesh>
      <Text position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={2.6}
        color="#ffe0a0" anchorX="center" anchorY="middle"
        outlineWidth={0.05} outlineColor="#2a0a16">
        ↻
      </Text>
      <mesh position={[0, 2.1, 0]} ref={beamRef}>
        <cylinderGeometry args={[PAD_RADIUS * 0.52, PAD_RADIUS * 0.66, 4.2, 18, 1, true]} />
        <meshBasicMaterial
          color="#c4154a" transparent opacity={0.12}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default function Bowling({ vehicleRef }) {
  const pinRefs          = useRef(PIN_LOCAL_POSITIONS.map(() => null))
  const ballRef           = useRef(null)
  const wonRef            = useRef(false)
  const resetPendingRef   = useRef(false)
  const resetTimeoutRef   = useRef(null)
  const [showStrike, setShowStrike] = useState(false)
  const padMatRef  = useRef(null)
  const beamRef    = useRef(null)
  const pinGeo     = useMemo(() => buildPinGeometry(), [])
  useEffect(() => () => pinGeo.dispose(), [pinGeo])

  const resetPins = useCallback(() => {
    PIN_LOCAL_POSITIONS.forEach((local, i) => {
      const body = pinRefs.current[i]
      if (!body) return
      const [x, y, z] = pinWorldPosition(local)
      body.setTranslation({ x, y, z }, true)
      body.setRotation(IDENTITY_ROT, true)
      body.setLinvel(ZERO_VEC, true)
      body.setAngvel(ZERO_VEC, true)
    })
    if (ballRef.current) {
      const [x, y, z] = ballWorldPosition()
      ballRef.current.setTranslation({ x, y, z }, true)
      ballRef.current.setRotation(IDENTITY_ROT, true)
      ballRef.current.setLinvel(ZERO_VEC, true)
      ballRef.current.setAngvel(ZERO_VEC, true)
    }
    wonRef.current = false
    resetPendingRef.current = false
    setShowStrike(false)
  }, [])

  // Published for BowlingHUD, which lives outside the Canvas and so cannot
  // hold a ref into the R3F tree. Same bridge pattern as window.__resetCar
  // (App.jsx) and window.__carPosition (Whispers.jsx).
  useEffect(() => {
    window.__resetBowling = resetPins
    return () => {
      if (window.__resetBowling === resetPins) delete window.__resetBowling
      // Never leave the button stranded on screen after unmount.
      if (useGameStore.getState().bowlingResetPrompt) useGameStore.setState({ bowlingResetPrompt: false })
    }
  }, [resetPins])

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    // Distance first, and outside the resetPending guard below: during the
    // 4s strike celebration the guard returns early, and if proximity were
    // computed after it the reset button would blink out at exactly the
    // moment the player is most likely to want it.
    let dist = Infinity
    if (vehicleRef?.current) {
      try {
        const t = vehicleRef.current.translation()
        _vPos.set(t.x, 0, t.z)
        dist = _vPos.distanceTo(_center)
      } catch (_) {}
    }
    // Touching the pad is what raises the prompt — not merely being near the
    // lane. Written only on the edge, never per-frame: a setState every
    // frame would re-render the whole React tree 60x a second.
    const onPad = _vPos.distanceTo(_padCenter) < PAD_TRIGGER
    if (onPad !== useGameStore.getState().bowlingResetPrompt) {
      useGameStore.setState({ bowlingResetPrompt: onPad })
    }

    // Pad glow follows the same exponential lerp the camera uses, so it is
    // frame-rate independent (DESIGN.md §5), with a slow breath while armed.
    if (padMatRef.current) {
      const pulse = onPad ? 1.15 + Math.sin(elapsed * 4) * 0.25 : 0.28
      const k = 1 - Math.exp(-9 * delta)
      padMatRef.current.emissiveIntensity += (pulse - padMatRef.current.emissiveIntensity) * k
    }
    if (beamRef.current) {
      const target = onPad ? 0.3 : 0.12
      const k = 1 - Math.exp(-9 * delta)
      beamRef.current.material.opacity += (target - beamRef.current.material.opacity) * k
    }

    if (resetPendingRef.current) return

    let allDown = true
    let anyDown = false
    for (let i = 0; i < pinRefs.current.length; i++) {
      const body = pinRefs.current[i]
      if (!body) { allDown = false; continue }
      const rot = body.rotation()
      _quat.set(rot.x, rot.y, rot.z, rot.w)
      _up.set(0, 1, 0).applyQuaternion(_quat)
      const isDown = _up.y < 0.5
      if (isDown) anyDown = true
      else allDown = false
    }

    if (!wonRef.current && allDown) {
      // Strike — folio's exact pattern: a `won` flag gates this to fire
      // once per attempt. The in-world celebration below fires every
      // strike; the one-time achievement toast is wired separately via
      // strikeCount in the store (AchievementSystem.jsx watches it).
      wonRef.current = true
      resetPendingRef.current = true
      setShowStrike(true)
      triggerShake(0.3)
      const s = useGameStore.getState()
      useGameStore.setState({ strikeCount: s.strikeCount + 1 })
      clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = setTimeout(resetPins, RESET_DELAY_MS)
      return
    }

    // Abandoned attempt — some pins disturbed but not a strike, and the
    // player has driven far enough away that resetting won't be visible/
    // jarring. Gives the next visitor a fresh set without needing a key.
    if (!wonRef.current && anyDown && dist > RESET_RADIUS) resetPins()
  })

  return (
    <group>
      <group position={[BOWLING_CENTER[0], 0, BOWLING_CENTER[1]]}>
        {/* Titles face +X — down the lane toward the entry side */}
        <Text position={[-1.5, 5.4, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={1.2}
          color="#f5f0e8" anchorX="center" anchorY="middle" outlineWidth={0.07} outlineColor="#000">
          🎳 BOWLING
        </Text>
        {showStrike && (
          <Text position={[-1.5, 4.2, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={1.8}
            color="#c4154a" anchorX="center" anchorY="middle" outlineWidth={0.09} outlineColor="#fff">
            STRIKE!
          </Text>
        )}
      </group>

      <Lane />
      <ResetPad matRef={padMatRef} beamRef={beamRef} />
      <Bumpers />

      {PIN_LOCAL_POSITIONS.map((local, i) => (
        <Pin
          key={i}
          pinRef={(body) => { pinRefs.current[i] = body }}
          position={pinWorldPosition(local)}
          geometry={pinGeo}
        />
      ))}

      <Ball ballRef={(body) => { ballRef.current = body }} position={ballWorldPosition()} />
    </group>
  )
}
