import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'
import { triggerShake } from '../utils/cameraShake'

// Empty SW quadrant, symmetric opposite the racing circuit (NE, center
// [90,-90] — see Circuit.jsx). Same clearance reasoning: ~127 units from
// the origin, well beyond the tree/rock scatter radius (max ~94) and every
// zone's exclusion box.
const BOWLING_CENTER = [-90, 90]
const RESET_RADIUS   = 30   // reset an abandoned attempt once the player is this far away
const RESET_DELAY_MS = 4000 // after a strike, before pins reset

// Standard 10-pin triangle (apex toward -Z — the side a car approaching
// from the rest of the map naturally enters from), spaced to roughly match
// the car's width so a pass through the middle plows several pins at once.
const PIN_LOCAL_POSITIONS = [
  [0, 0],
  [-0.9, 1.8], [0.9, 1.8],
  [-1.8, 3.6], [0, 3.6], [1.8, 3.6],
  [-2.7, 5.4], [-0.9, 5.4], [0.9, 5.4], [2.7, 5.4],
]
const PIN_HEIGHT  = 1.1
const PIN_START_Y = PIN_HEIGHT / 2

// A separate physics ball the car pushes into the pins — matching folio's
// actual mechanic (its ball is "just another dynamic rigid body the
// player's car rolls into," no throw/grab), rather than the car hitting
// pins directly. Placed in front of the apex pin, on the side a car
// entering from the rest of the map naturally approaches from.
const BALL_LOCAL = [0, -2.5]
const BALL_RADIUS = 0.35
const BALL_START_Y = BALL_RADIUS

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
      colliders="ball"
      mass={1.5}
      linearDamping={0.25}
      angularDamping={0.1}
      restitution={0.35}
    >
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
        <meshStandardMaterial color="#5a2d82" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Finger holes — three small dark dots, purely cosmetic */}
      {[[0.18, 0.28, 0.1], [0.3, 0.28, -0.1], [0.05, 0.28, -0.25]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.05, 6, 6]} />
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
      mass={0.05}
      linearDamping={0.3}
      angularDamping={0.3}
      restitution={0.1}
    >
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.22, PIN_HEIGHT, 8]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.6} />
      </mesh>
      {/* Red stripe near the top — the only thing distinguishing this from
          a plain cone, cheap (one extra short cylinder, no collider). */}
      <mesh position={[0, PIN_HEIGHT * 0.22, 0]}>
        <cylinderGeometry args={[0.185, 0.19, 0.12, 8]} />
        <meshStandardMaterial color="#c4154a" roughness={0.5} />
      </mesh>
    </RigidBody>
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 2.7]}>
          <ringGeometry args={[7, 8, 32]} />
          <meshStandardMaterial color="#c4154a" transparent opacity={0.18}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Text position={[0, 4, 2.7]} fontSize={1} color="#f5f0e8"
          anchorX="center" anchorY="middle" outlineWidth={0.06} outlineColor="#000">
          🎳 BOWLING
        </Text>
        {showStrike && (
          <Text position={[0, 3.5, 2.7]} fontSize={1.6} color="#c4154a"
            anchorX="center" anchorY="middle" outlineWidth={0.08} outlineColor="#fff">
            STRIKE!
          </Text>
        )}
      </group>

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
