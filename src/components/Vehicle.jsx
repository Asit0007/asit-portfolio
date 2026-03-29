import { useRef, forwardRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'

// ── Tuning ─────────────────────────────────────────────────────────────────
const MAX_SPEED     = 20
const MAX_REV_SPEED = 8
const ACCEL_FORCE   = 30
const REV_FORCE     = 18
const BRAKE_DAMPING = 0.88
const COAST_DAMPING = 0.995
const LATERAL_GRIP  = 0.80
const STEER_SPEED   = 2.4

// Camera sits behind car — car moves in +Z so camera at -Z offset
const CAM_OFFSET = new THREE.Vector3(-8, 18, -20)
const CAM_LERP   = 3.5

const HAS_GLTF = false // set true once public/models/car.glb exists
// ──────────────────────────────────────────────────────────────────────────

const _fwd    = new THREE.Vector3()
const _right  = new THREE.Vector3()
const _vel    = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _cam    = new THREE.Vector3()
const _look   = new THREE.Vector3()
const _ideal  = new THREE.Vector3()
const _carPos = new THREE.Vector3()

function GLTFCar() {
  const { scene } = useGLTF('/models/car.glb')
  const cloned = scene.clone()
  cloned.traverse((child) => {
    if (child.isMesh) {
      child.castShadow    = true
      child.receiveShadow = true
    }
  })
  return (
    <primitive
      object={cloned}
      scale={1}
      position={[0, -0.25, 0]}
      rotation={[0, 0, 0]}
    />
  )
}

// ── BoxCar — FIXED silhouette ──────────────────────────────────────────────
// Car moves in +Z direction (forward = +Z, backward = -Z)
// Layout (viewed from side, left = back -Z, right = front +Z):
//   TAIL [-Z] ←─── body ───→ HOOD [+Z]
//   taillights    cab  windshield   headlights
//
// Cab sits toward BACK (-Z side) leaving long hood visible at front (+Z)
// This is the classic car silhouette — long hood, cab toward rear
function BoxCar() {
  return (
    <>
      {/* Main body — full length */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.5, 3.4]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.5} roughness={0.25} />
      </mesh>

      {/* Hood detail — slightly raised at front */}
      <mesh castShadow position={[0, 0.28, 0.8]}>
        <boxGeometry args={[1.7, 0.06, 1.4]} />
        <meshStandardMaterial color="#00bde0" metalness={0.4} roughness={0.3} />
      </mesh>

      {/* Cab — passenger section, sits toward BACK of car */}
      <mesh castShadow position={[0, 0.52, -0.5]}>
        <boxGeometry args={[1.3, 0.5, 1.6]} />
        <meshStandardMaterial color="#0099bb" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Windshield — front face of cab, angled toward hood */}
      {/* Sits at the FRONT edge of the cab, facing +Z */}
      <mesh castShadow position={[0, 0.54, 0.28]}>
        <boxGeometry args={[1.26, 0.44, 0.06]} />
        <meshStandardMaterial
          color="#88ddff" transparent opacity={0.45}
          roughness={0} metalness={0.1}
        />
      </mesh>

      {/* Rear window — back face of cab */}
      <mesh position={[0, 0.54, -1.28]}>
        <boxGeometry args={[1.26, 0.38, 0.05]} />
        <meshStandardMaterial
          color="#66bbdd" transparent opacity={0.35}
          roughness={0} metalness={0.1}
        />
      </mesh>

      {/* Roof rack — on top of cab */}
      <mesh castShadow position={[0, 0.79, -0.5]}>
        <boxGeometry args={[1.1, 0.06, 1.4]} />
        <meshStandardMaterial color="#007799" roughness={0.6} />
      </mesh>

      {/* Wheels — 4 corners */}
      {[
        [-0.95, -0.18,  1.1],   // front-left
        [ 0.95, -0.18,  1.1],   // front-right
        [-0.95, -0.18, -1.1],   // rear-left
        [ 0.95, -0.18, -1.1],   // rear-right
      ].map(([x, y, z], i) => (
        <mesh key={i} castShadow position={[x, y, z]}>
          <boxGeometry args={[0.25, 0.5, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}

      {/* Wheel arches — subtle */}
      {[
        [-0.9, 0.0,  1.1],
        [ 0.9, 0.0,  1.1],
        [-0.9, 0.0, -1.1],
        [ 0.9, 0.0, -1.1],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.1, 0.2, 0.6]} />
          <meshStandardMaterial color="#007799" roughness={0.5} />
        </mesh>
      ))}

      {/* HEADLIGHTS — FRONT = +Z (direction the car drives toward) */}
      {[[-0.55, 0.05, 1.71], [0.55, 0.05, 1.71]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.32, 0.2, 0.05]} />
          <meshStandardMaterial
            color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5}
          />
        </mesh>
      ))}

      {/* Grille strip between headlights — visual front marker */}
      <mesh position={[0, -0.05, 1.71]}>
        <boxGeometry args={[1.0, 0.12, 0.04]} />
        <meshStandardMaterial color="#004466" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* TAILLIGHTS — BACK = -Z (toward camera, behind car) */}
      {[[-0.55, 0.05, -1.71], [0.55, 0.05, -1.71]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.3, 0.18, 0.05]} />
          <meshStandardMaterial
            color="#ff2200" emissive="#ff1100" emissiveIntensity={1.5}
          />
        </mesh>
      ))}

      {/* Rear bumper detail */}
      <mesh position={[0, -0.12, -1.71]}>
        <boxGeometry args={[1.6, 0.14, 0.06]} />
        <meshStandardMaterial color="#007799" roughness={0.5} />
      </mesh>
    </>
  )
}

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

    if (!bodySet.current) {
      bodySet.current = true
      useGameStore.getState().setVehicleBody(body)
    }
    if (ref) ref.current = body

    // R key reset
    if (typeof window !== 'undefined' && window.__resetCar) {
      window.__resetCar = false
      body.setTranslation({ x: 0, y: 2.5, z: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    }

    const { forward, backward, left, right, brake } = getInput()

    // Car local +Z = world direction of travel
    const rot = body.rotation()
    _quat.set(rot.x, rot.y, rot.z, rot.w)
    _fwd  .set(0, 0,  1).applyQuaternion(_quat).setY(0).normalize()
    _right.set(1, 0,  0).applyQuaternion(_quat).setY(0).normalize()

    const lv = body.linvel()
    _vel.set(lv.x, lv.y, lv.z)
    const fwdSpeed = _fwd.dot(_vel)
    const latSpeed = _right.dot(_vel)

    // Kill lateral drift
    _vel.addScaledVector(_right, -latSpeed * (1 - LATERAL_GRIP))

    // Forward acceleration
    if (forward && fwdSpeed < MAX_SPEED) {
      _vel.addScaledVector(_fwd, ACCEL_FORCE * dt)
    }

    // Reverse
    if (backward) {
      if (fwdSpeed > 0.5) {
        _vel.x *= 0.85
        _vel.z *= 0.85
      } else if (fwdSpeed > -MAX_REV_SPEED) {
        _vel.addScaledVector(_fwd, -REV_FORCE * dt)
      }
    }

    // Brake / coast
    if (brake) {
      _vel.x *= BRAKE_DAMPING
      _vel.z *= BRAKE_DAMPING
    } else if (!forward && !backward) {
      _vel.x *= COAST_DAMPING
      _vel.z *= COAST_DAMPING
    }

    // Speed cap
    const horizSq = _vel.x * _vel.x + _vel.z * _vel.z
    if (horizSq > MAX_SPEED * MAX_SPEED) {
      const inv = MAX_SPEED / Math.sqrt(horizSq)
      _vel.x *= inv
      _vel.z *= inv
    }

    body.setLinvel({ x: _vel.x, y: _vel.y, z: _vel.z }, true)

    // Steering — speed-gated
    const speedFactor = Math.min(Math.abs(fwdSpeed) / 5, 1)
    const steerDir    = (left ? 1 : 0) - (right ? 1 : 0)
    const steerSign   = fwdSpeed < -0.3 ? -1 : 1
    steer.current = THREE.MathUtils.lerp(
      steer.current,
      steerDir * speedFactor,
      1 - Math.exp(-10 * dt)
    )
    body.setAngvel(
      { x: 0, y: steer.current * STEER_SPEED * steerSign, z: 0 }, true
    )

    // Fixed-angle camera — world-space offset, never rotates with car
    const pos = body.translation()
    _carPos.set(pos.x, pos.y, pos.z)
    _ideal.copy(_carPos).add(CAM_OFFSET)

    _cam.copy(state.camera.position)
    _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP * dt))
    state.camera.position.copy(_cam)

    _look.set(pos.x, pos.y + 0.5, pos.z)
    state.camera.lookAt(_look)
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 2.5, 0]}
      colliders="cuboid"
      mass={2}
      linearDamping={0}
      angularDamping={6}
      enabledRotations={[false, true, false]}
      ccd={true}
      restitution={0.2}
    >
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