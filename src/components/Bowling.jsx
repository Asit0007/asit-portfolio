import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { triggerShake } from '../utils/cameraShake'

// Empty SW quadrant, symmetric opposite the racing circuit (NE, center
// [90,-90] — see Circuit.jsx). Same clearance reasoning: ~127 units from
// the origin, well beyond the tree/rock scatter radius (max ~94) and every
// zone's exclusion box.
const BOWLING_CENTER = [-90, 90]
const RESET_RADIUS   = 34   // reset an abandoned attempt once the player is this far away
const RESET_DELAY_MS = 4000 // after a strike, before pins reset

// Dimensions taken from folio-2025's actual areas.glb and scaled by ~0.875
// (its truck chassis is 3.0×1.8 vs our car's 3.4×1.9, close enough to
// borrow absolute sizes): folio pin h=2.97/r=0.51 → 2.6/0.45; ball r≈0.97
// → 0.85; pin triangle spacing 1.44 lateral / 1.15 per row → 1.26/1.0.
// Like folio, the pins deliberately tower over the car — that's the joke.
const PIN_HEIGHT   = 2.6
const PIN_TOP_R    = 0.2
const PIN_BOTTOM_R = 0.45
const PIN_START_Y  = PIN_HEIGHT / 2

// Standard 10-pin triangle. The alley runs east–west ("horizontal" on the
// map): apex toward +X — the map-center side a car approaching from the
// rest of the world naturally enters from. Real-bowling tight spacing per
// folio rather than the old car-width spread — the ball is now big enough
// to do the plowing.
const PIN_LOCAL_POSITIONS = [
  [0, 0],
  [-1.0, -0.63], [-1.0, 0.63],
  [-2.0, -1.26], [-2.0, 0], [-2.0, 1.26],
  [-3.0, -1.89], [-3.0, -0.63], [-3.0, 0.63], [-3.0, 1.89],
]

// A separate physics ball the car pushes into the pins — matching folio's
// actual mechanic (its ball is "just another dynamic rigid body the
// player's car rolls into," no throw/grab). Like folio, it sits well up
// the lane so there's a run-up before impact.
const BALL_LOCAL   = [12, 0]  // east of the pins, up the lane's run-up
const BALL_RADIUS  = 0.85
const BALL_START_Y = BALL_RADIUS

// The lane — folio flanks its lane with long bumper rails (~0.84 high in
// its world units) that keep ball and pins contained; same here. The rails
// are fixed rigid bodies, the lane floor is visual only (the ground's own
// collider does the physical work).
const LANE_WIDTH       = 7
const LANE_LENGTH      = 24
const LANE_CENTER_X    = 4    // local: lane spans x +16 (entry, east) … -8 (behind pins)
const BUMPER_HEIGHT    = 0.84
const BUMPER_THICKNESS = 0.5

const _up     = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _vPos   = new THREE.Vector3()
const _center = new THREE.Vector3(BOWLING_CENTER[0], 0, BOWLING_CENTER[1])

const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 }
const ZERO_VEC      = { x: 0, y: 0, z: 0 }

function pinWorldPosition([lx, lz]) {
  return [BOWLING_CENTER[0] + lx, PIN_START_Y, BOWLING_CENTER[1] + lz]
}

function ballWorldPosition() {
  return [BOWLING_CENTER[0] + BALL_LOCAL[0], BALL_START_Y, BOWLING_CENTER[1] + BALL_LOCAL[1]]
}

function Ball({ ballRef, position }) {
  return (
    <RigidBody
      ref={ballRef}
      position={position}
      colliders={false}
      linearDamping={0.25}
      angularDamping={0.1}
    >
      {/* One explicit smooth sphere collider. Auto `colliders="ball"` would
          also wrap each cosmetic finger-hole mesh in its own tiny collider —
          three bumps protruding past the surface that made the ball thump
          instead of roll. */}
      <BallCollider args={[BALL_RADIUS]} mass={2.5} restitution={0.35} />
      <mesh>
        <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
        <meshStandardMaterial color="#5a2d82" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Finger holes — three small dark dots, purely cosmetic */}
      {[[0.44, 0.68, 0.24], [0.72, 0.68, -0.24], [0.12, 0.68, -0.6]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#1a0a2a" />
        </mesh>
      ))}
    </RigidBody>
  )
}

function Pin({ pinRef, position }) {
  return (
    <RigidBody
      ref={pinRef}
      position={position}
      colliders="cuboid"
      mass={0.15}
      linearDamping={0.1}
      angularDamping={0.5}
      restitution={0.5}
    >
      <mesh>
        <cylinderGeometry args={[PIN_TOP_R, PIN_BOTTOM_R, PIN_HEIGHT, 10]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.6} />
      </mesh>
      {/* Red neck stripe — the only thing distinguishing this from a plain
          cone, cheap (one extra short cylinder, no collider). */}
      <mesh position={[0, PIN_HEIGHT * 0.22, 0]}>
        <cylinderGeometry args={[0.3, 0.32, 0.28, 10]} />
        <meshStandardMaterial color="#c4154a" roughness={0.5} />
      </mesh>
    </RigidBody>
  )
}

// The lane's boundary rails — visual boundary line + physical containment
// in one, like folio's bumpers.
function Bumpers() {
  const railZ = LANE_WIDTH / 2 + BUMPER_THICKNESS / 2
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

// folio's bowling has a "Restart" interactive point beside the lane; ours
// is a clickable 3D sign (R3F pointer events — also works as a tap on
// mobile, which has no R key equivalent for the pins).
function RestartButton({ onRestart }) {
  const [hovered, setHovered] = useState(false)
  return (
    <group
      position={[BOWLING_CENTER[0] + 8, 0, BOWLING_CENTER[1] - 5.6]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.8, 6]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      <mesh
        position={[0, 2.1, 0]}
        onClick={(e) => { e.stopPropagation(); onRestart() }}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      >
        <boxGeometry args={[2.6, 1.1, 0.16]} />
        <meshStandardMaterial color="#1a0a2a" emissive="#c4154a"
          emissiveIntensity={hovered ? 0.6 : 0.35} roughness={0.5} />
      </mesh>
      {/* Label on both faces — the sign has to be readable no matter which
          way the player circles in, or it reads as "no restart button". */}
      {[[0.1, 0], [-0.1, Math.PI]].map(([z, ry], i) => (
        <Text key={i} position={[0, 2.1, z]} rotation={[0, ry, 0]} fontSize={0.42}
          color={hovered ? '#ffffff' : '#ffe0a0'}
          anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          ↻ RESTART
        </Text>
      ))}
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

  const resetPins = () => {
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
  }

  useFrame(() => {
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
    if (!wonRef.current && anyDown && vehicleRef?.current) {
      try {
        const t = vehicleRef.current.translation()
        _vPos.set(t.x, 0, t.z)
        if (_vPos.distanceTo(_center) > RESET_RADIUS) resetPins()
      } catch (_) {}
    }
  })

  return (
    <group>
      <group position={[BOWLING_CENTER[0], 0, BOWLING_CENTER[1]]}>
        {/* Wooden lane floor — visual only, sits just above the ground */}
        <mesh position={[LANE_CENTER_X, 0.025, 0]}>
          <boxGeometry args={[LANE_LENGTH, 0.02, LANE_WIDTH]} />
          <meshStandardMaterial color="#d9b77c" roughness={0.75} />
        </mesh>
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

      <Bumpers />
      <RestartButton onRestart={resetPins} />

      {PIN_LOCAL_POSITIONS.map((local, i) => (
        <Pin
          key={i}
          pinRef={(body) => { pinRefs.current[i] = body }}
          position={pinWorldPosition(local)}
        />
      ))}

      <Ball ballRef={(body) => { ballRef.current = body }} position={ballWorldPosition()} />
    </group>
  )
}
