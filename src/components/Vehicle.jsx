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
const ACCEL_FORCE   = 28
const BRAKE_DAMPING = 0.92
const COAST_DAMPING = 0.994
const LATERAL_GRIP  = 0.82
const STEER_SPEED   = 2.4
const CAM_LERP      = 6
// ─────────────────────────────────────────────────────────────────────────────

// Pre-allocated — never allocate inside useFrame
const _fwd   = new THREE.Vector3()
const _right = new THREE.Vector3()
const _vel   = new THREE.Vector3()
const _quat  = new THREE.Quaternion()
const _cam   = new THREE.Vector3()
const _look  = new THREE.Vector3()
const _ideal = new THREE.Vector3()

// Defined as a named function outside forwardRef — fixes Vite Fast Refresh bug
function VehicleInner(props, ref) {
  const bodyRef    = useRef()
  const steer      = useRef(0)
  const bodySet    = useRef(false)

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

    // Expose body to store once
    if (!bodySet.current) {
      bodySet.current = true
      useGameStore.getState().setVehicleBody(body)
    }
    if (ref) ref.current = body

    const { forward, backward, left, right, brake } = getInput()

    // 1. Facing direction from physics rotation
    const rot = body.rotation()
    _quat.set(rot.x, rot.y, rot.z, rot.w)
    _fwd  .set(0, 0, -1).applyQuaternion(_quat).setY(0).normalize()
    _right.set(1, 0,  0).applyQuaternion(_quat).setY(0).normalize()

    // 2. Current velocity
    const lv = body.linvel()
    _vel.set(lv.x, lv.y, lv.z)

    const fwdSpeed = _fwd.dot(_vel)
    const latSpeed = _right.dot(_vel)

    // 3. Kill lateral drift (Bruno's key trick) — isolated, won't eat forward speed
    const latKill = latSpeed * (1 - LATERAL_GRIP)
    _vel.addScaledVector(_right, -latKill)

    // 4. Additive acceleration — holding forward ALWAYS works
    if (forward && fwdSpeed < MAX_SPEED) {
      const accel = Math.min(ACCEL_FORCE * dt, MAX_SPEED - fwdSpeed)
      _vel.addScaledVector(_fwd, accel)
    }
    if (backward && fwdSpeed > -MAX_REV_SPEED) {
      const accel = Math.min(ACCEL_FORCE * 0.55 * dt, fwdSpeed + MAX_REV_SPEED)
      _vel.addScaledVector(_fwd, -accel)
    }

    // 5. Braking / coasting
    if (brake) {
      _vel.x *= BRAKE_DAMPING
      _vel.z *= BRAKE_DAMPING
    } else if (!forward && !backward) {
      _vel.x *= COAST_DAMPING
      _vel.z *= COAST_DAMPING
    }

    // 6. Hard speed cap
    const horizSq = _vel.x * _vel.x + _vel.z * _vel.z
    if (horizSq > MAX_SPEED * MAX_SPEED) {
      const inv = MAX_SPEED / Math.sqrt(horizSq)
      _vel.x *= inv
      _vel.z *= inv
    }

    // 7. Commit velocity
    body.setLinvel({ x: _vel.x, y: _vel.y, z: _vel.z }, true)

    // 8. Steering — speed-gated
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

    // 9. Spring camera
    const pos     = body.translation()
    const camDist = 9 + Math.abs(fwdSpeed) * 0.25
    const camH    = 5 + Math.abs(fwdSpeed) * 0.05

    _ideal.set(
      pos.x - _fwd.x * camDist,
      pos.y + camH,
      pos.z - _fwd.z * camDist
    )
    _cam.copy(state.camera.position)
    _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP * dt))
    state.camera.position.copy(_cam)

    _look.set(pos.x, pos.y + 0.8, pos.z)
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