import { useRef, forwardRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'

// ── Tuning ────────────────────────────────────────────────────────────────────
const MAX_SPEED     = 20
const MAX_REV_SPEED = 8
const ACCEL_FORCE   = 30
const REV_FORCE     = 18     // ← dedicated reverse force, stronger than before
const BRAKE_DAMPING = 0.88
const COAST_DAMPING = 0.995  // very gentle — car glides nicely
const LATERAL_GRIP  = 0.80
const STEER_SPEED   = 2.4
// ── Camera — Bruno style ──────────────────────────────────────────────────────
const CAM_HEIGHT    = 14     // how high above the car
const CAM_DIST      = 14     // how far behind the car
const CAM_LOOK_AHEAD = 2     // look slightly ahead of car center
const CAM_LERP      = 4      // spring smoothness — lower = dreamier
// ─────────────────────────────────────────────────────────────────────────────

const _fwd    = new THREE.Vector3()
const _right  = new THREE.Vector3()
const _vel    = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _cam    = new THREE.Vector3()
const _look   = new THREE.Vector3()
const _ideal  = new THREE.Vector3()

function VehicleInner(props, ref) {
  const bodyRef  = useRef()
  const steer    = useRef(0)
  const bodySet  = useRef(false)
  const [, getKeys] = useKeyboardControls()

  const getInput = () => {
    const k = getKeys()
    const j = props.joystick || {}
    return {
      forward:  k[Controls.forward]  || j.forward  || false,
      backward: k[Controls.backward] || j.backward || false,
      left:     k[Controls.left]     || j.left     || false,
      right:    k[Controls.right]    || j.right    || false,
      brake:    k[Controls.brake]    || j.brake    || false,
    }
  }

  useFrame((state, delta) => {
    if (!bodyRef.current) return
    const body = bodyRef.current
    const dt   = Math.min(delta, 0.05)

    // Register body in store once
    if (!bodySet.current) {
      bodySet.current = true
      useGameStore.getState().setVehicleBody(body)
    }
    if (ref) ref.current = body

    const { forward, backward, left, right, brake } = getInput()

    // ── 1. World-space forward/right ─────────────────────────────────────────
    const rot = body.rotation()
    _quat.set(rot.x, rot.y, rot.z, rot.w)
    _fwd  .set(0, 0, -1).applyQuaternion(_quat).setY(0).normalize()
    _right.set(1, 0,  0).applyQuaternion(_quat).setY(0).normalize()

    // ── 2. Current velocity ───────────────────────────────────────────────────
    const lv = body.linvel()
    _vel.set(lv.x, lv.y, lv.z)

    const fwdSpeed = _fwd.dot(_vel)
    const latSpeed = _right.dot(_vel)

    // ── 3. Kill lateral drift ─────────────────────────────────────────────────
    _vel.addScaledVector(_right, -latSpeed * (1 - LATERAL_GRIP))

    // ── 4. Forward acceleration ───────────────────────────────────────────────
    if (forward && fwdSpeed < MAX_SPEED) {
      _vel.addScaledVector(_fwd, ACCEL_FORCE * dt)
    }

    // ── 5. Reverse — FIXED: simple direct force, no Math.min clamping ────────
    if (backward) {
      if (fwdSpeed > 0.5) {
        // Still moving forward — brake hard first
        _vel.x *= 0.85
        _vel.z *= 0.85
      } else if (fwdSpeed > -MAX_REV_SPEED) {
        // Apply reverse thrust directly
        _vel.addScaledVector(_fwd, -REV_FORCE * dt)
      }
    }

    // ── 6. Braking / coasting ─────────────────────────────────────────────────
    if (brake) {
      _vel.x *= BRAKE_DAMPING
      _vel.z *= BRAKE_DAMPING
    } else if (!forward && !backward) {
      _vel.x *= COAST_DAMPING
      _vel.z *= COAST_DAMPING
    }

    // ── 7. Speed cap ──────────────────────────────────────────────────────────
    const horizSq = _vel.x * _vel.x + _vel.z * _vel.z
    const maxSq   = MAX_SPEED * MAX_SPEED
    if (horizSq > maxSq) {
      const inv = MAX_SPEED / Math.sqrt(horizSq)
      _vel.x *= inv
      _vel.z *= inv
    }

    // ── 8. Apply velocity ─────────────────────────────────────────────────────
    body.setLinvel({ x: _vel.x, y: _vel.y, z: _vel.z }, true)

    // ── 9. Steering ───────────────────────────────────────────────────────────
    const speedFactor = Math.min(Math.abs(fwdSpeed) / 5, 1)
    const steerDir    = (left ? 1 : 0) - (right ? 1 : 0)
    const steerSign   = fwdSpeed < -0.3 ? -1 : 1

    steer.current = THREE.MathUtils.lerp(
      steer.current,
      steerDir * speedFactor,
      1 - Math.exp(-10 * dt)
    )
    body.setAngvel(
      { x: 0, y: steer.current * STEER_SPEED * steerSign, z: 0 },
      true
    )

    // ── 10. Bruno-style camera ────────────────────────────────────────────────
    // High angle, slightly behind and above — isometric feel
    // Camera position is NOT behind the car's facing direction
    // but at a FIXED world angle with slight follow lag
    const pos   = body.translation()
    const speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z)

    // Ideal camera: above and slightly behind the car in world space
    // The slight -_fwd offset makes it feel like it follows direction of travel
    _ideal.set(
      pos.x - _fwd.x * CAM_DIST * 0.5,
      pos.y + CAM_HEIGHT,
      pos.z - _fwd.z * CAM_DIST * 0.5
    )

    // Smooth spring follow
    _cam.copy(state.camera.position)
    _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP * dt))
    state.camera.position.copy(_cam)

    // Look slightly ahead of the car — Bruno's camera looks at ground ahead
    _look.set(
      pos.x + _fwd.x * CAM_LOOK_AHEAD,
      pos.y,
      pos.z + _fwd.z * CAM_LOOK_AHEAD
    )
    state.camera.lookAt(_look)
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 2.0, 0]}
      colliders="cuboid"
      mass={1}
      linearDamping={0}
      angularDamping={6}
      enabledRotations={[false, true, false]}
      ccd={true}
    >
      {/* Car body */}
      <mesh castShadow>
        <boxGeometry args={[1.8, 0.5, 3.4]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.5} roughness={0.25} />
      </mesh>
      {/* Cab */}
      <mesh castShadow position={[0, 0.52, -0.3]}>
        <boxGeometry args={[1.3, 0.45, 1.8]} />
        <meshStandardMaterial color="#0099bb" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 0.53, 0.62]}>
        <boxGeometry args={[1.28, 0.42, 0.05]} />
        <meshStandardMaterial
          color="#88ddff" transparent opacity={0.4}
          roughness={0} metalness={0}
        />
      </mesh>
      {/* Wheels */}
      {[
        [-0.95, -0.18,  1.1],
        [ 0.95, -0.18,  1.1],
        [-0.95, -0.18, -1.1],
        [ 0.95, -0.18, -1.1],
      ].map(([x, y, z], i) => (
        <mesh key={i} castShadow position={[x, y, z]}>
          <boxGeometry args={[0.25, 0.5, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}
      {/* Headlights */}
      {[[-0.5, 0, 1.72], [0.5, 0, 1.72]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.3, 0.18, 0.05]} />
          <meshStandardMaterial
            color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2}
          />
        </mesh>
      ))}
      {/* Taillights */}
      {[[-0.55, 0, -1.71], [0.55, 0, -1.71]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.28, 0.16, 0.05]} />
          <meshStandardMaterial
            color="#ff2200" emissive="#ff1100" emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </RigidBody>
  )
}

const Vehicle = forwardRef(VehicleInner)
export default Vehicle