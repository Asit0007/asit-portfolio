import { useRef, forwardRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Controls } from '../Controls'
import useGameStore from '../store/useGameStore'
import { playCollision, playBrake } from '../audio'

const MAX_SPEED     = 20
const MAX_REV_SPEED = 15
const ACCEL_FORCE   = 30
const REV_FORCE     = 18
const BRAKE_DAMPING = 0.88
const COAST_DAMPING = 0.995
const LATERAL_GRIP  = 0.80
const STEER_SPEED   = 2.4

const CAM_OFFSET    = new THREE.Vector3(-8, 18, -20)
const CAM_LERP      = 3.5
const CAM_LERP_ZONE = 1.8

const ZONE_CAMS = {
  cloud:   { pos: new THREE.Vector3(0, 32, -55),  look: new THREE.Vector3(0, 0.5, -55)  },
  projects:{ pos: new THREE.Vector3(55, 32, 0),   look: new THREE.Vector3(55, 0.5, 0)   },
  hobbies: { pos: new THREE.Vector3(-55, 32, 0),  look: new THREE.Vector3(-55, 0.5, 0)  },
  contact: { pos: new THREE.Vector3(0, 32, 55),   look: new THREE.Vector3(0, 0.5, 55)   },
}

const HAS_GLTF = true

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
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true }
  })
  return <primitive object={cloned} scale={1} position={[0, -0.25, 0]} />
}

function BoxCar() {
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[1.8, 0.5, 3.4]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.5} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[0, 0.28, 0.8]}>
        <boxGeometry args={[1.7, 0.06, 1.4]} />
        <meshStandardMaterial color="#00bde0" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.52, -0.5]}>
        <boxGeometry args={[1.3, 0.5, 1.6]} />
        <meshStandardMaterial color="#0099bb" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.54, 0.28]}>
        <boxGeometry args={[1.26, 0.44, 0.06]} />
        <meshStandardMaterial color="#88ddff" transparent opacity={0.45} roughness={0} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.54, -1.28]}>
        <boxGeometry args={[1.26, 0.38, 0.05]} />
        <meshStandardMaterial color="#66bbdd" transparent opacity={0.35} roughness={0} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, 0.79, -0.5]}>
        <boxGeometry args={[1.1, 0.06, 1.4]} />
        <meshStandardMaterial color="#007799" roughness={0.6} />
      </mesh>
      {/* Wheels */}
      {[[-0.95,-0.22,1.1],[0.95,-0.22,1.1],[-0.95,-0.22,-1.1],[0.95,-0.22,-1.1]].map(([x,y,z],i) => (
        <mesh key={i} castShadow position={[x,y,z]}>
          <boxGeometry args={[0.28, 0.52, 0.52]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}
      {/* Headlights — FRONT = +Z */}
      {[[-0.55,0.05,1.71],[0.55,0.05,1.71]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]}>
          <boxGeometry args={[0.32,0.2,0.05]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={2.5} />
        </mesh>
      ))}
      <mesh position={[0,-0.05,1.71]}>
        <boxGeometry args={[1.0,0.12,0.04]} />
        <meshStandardMaterial color="#004466" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Taillights — BACK = -Z */}
      {[[-0.55,0.05,-1.71],[0.55,0.05,-1.71]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]}>
          <boxGeometry args={[0.3,0.18,0.05]} />
          <meshStandardMaterial color="#ff2200" emissive="#ff1100" emissiveIntensity={1.5} />
        </mesh>
      ))}
      <mesh position={[0,-0.12,-1.71]}>
        <boxGeometry args={[1.6,0.14,0.06]} />
        <meshStandardMaterial color="#007799" roughness={0.5} />
      </mesh>
    </>
  )
}

function VehicleInner(props, ref) {
  const bodyRef    = useRef()
  const steer      = useRef(0)
  const bodySet    = useRef(false)
  const lastSpeed  = useRef(0)
  const prevBrake  = useRef(false)
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

    if (typeof window !== 'undefined' && window.__resetCar) {
      window.__resetCar = false
      body.setTranslation({ x: 0, y: 2.5, z: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    }

    const { forward, backward, left, right, brake } = getInput()

    const gameStarted = useGameStore.getState().gameStarted
    if (brake && !prevBrake.current && gameStarted) playBrake()
    prevBrake.current = brake

    const rot = body.rotation()
    _quat.set(rot.x, rot.y, rot.z, rot.w)
    _fwd  .set(0, 0,  1).applyQuaternion(_quat).setY(0).normalize()
    _right.set(1, 0,  0).applyQuaternion(_quat).setY(0).normalize()

    const lv = body.linvel()
    _vel.set(lv.x, lv.y, lv.z)
    const fwdSpeed = _fwd.dot(_vel)
    const latSpeed = _right.dot(_vel)
    const curSpeed = Math.sqrt(lv.x*lv.x + lv.z*lv.z)
    lastSpeed.current = curSpeed

    _vel.addScaledVector(_right, -latSpeed * (1 - LATERAL_GRIP))

    if (forward && fwdSpeed < MAX_SPEED) _vel.addScaledVector(_fwd, ACCEL_FORCE * dt)

    if (backward) {
      if (fwdSpeed > 0.5) { _vel.x *= 0.85; _vel.z *= 0.85 }
      else if (fwdSpeed > -MAX_REV_SPEED) _vel.addScaledVector(_fwd, -REV_FORCE * dt)
    }

    if (brake) { _vel.x *= BRAKE_DAMPING; _vel.z *= BRAKE_DAMPING }
    else if (!forward && !backward) { _vel.x *= COAST_DAMPING; _vel.z *= COAST_DAMPING }

    const horizSq = _vel.x*_vel.x + _vel.z*_vel.z
    if (horizSq > MAX_SPEED*MAX_SPEED) {
      const inv = MAX_SPEED / Math.sqrt(horizSq)
      _vel.x *= inv; _vel.z *= inv
    }

    body.setLinvel({ x: _vel.x, y: _vel.y, z: _vel.z }, true)

    const speedFactor = Math.min(Math.abs(fwdSpeed) / 5, 1)
    const steerDir    = (left ? 1 : 0) - (right ? 1 : 0)
    const steerSign   = fwdSpeed < -0.3 ? -1 : 1
    steer.current = THREE.MathUtils.lerp(
      steer.current, steerDir * speedFactor, 1 - Math.exp(-10 * dt)
    )
    body.setAngvel({ x:0, y: steer.current * STEER_SPEED * steerSign, z:0 }, true)

    // Camera
    const pos    = body.translation()
    const zoneId = useGameStore.getState().activeZone?.id
    const zoneCam = zoneId && ZONE_CAMS[zoneId]

    _cam.copy(state.camera.position)
    if (zoneCam) {
      _ideal.copy(zoneCam.pos)
      _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP_ZONE * dt))
      state.camera.position.copy(_cam)
      state.camera.lookAt(zoneCam.look)
    } else {
      _carPos.set(pos.x, pos.y, pos.z)
      _ideal.copy(_carPos).add(CAM_OFFSET)
      _cam.lerp(_ideal, 1 - Math.exp(-CAM_LERP * dt))
      state.camera.position.copy(_cam)
      _look.set(pos.x, pos.y + 0.5, pos.z)
      state.camera.lookAt(_look)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 2.5, 0]}
      colliders={false}        // ← Manual collider for precise wheel alignment
      mass={2}
      linearDamping={0}
      angularDamping={6}
      enabledRotations={[false, true, false]}
      ccd={true}
      restitution={0.2}
      onCollisionEnter={() => {
        const spd = lastSpeed.current
        if (spd > 4 && useGameStore.getState().gameStarted) playCollision(spd)
      }}
    >
      {/* ── Manual cuboid collider — only the car body, NOT roof/wheels ─────
          half-extents: [width/2=0.9, height/2=0.28, length/2=1.7]
          position y=0 means collider spans -0.28 to +0.28
          Wheels at y=-0.22, their bottom at -0.22-0.26=-0.48 visual only
          Ground contact = physics bottom at -0.28 → center at y=0.28
          Wheels visual at 0.28-0.22=0.06 above ground = correct! ───────── */}
      <CuboidCollider args={[0.9, 0.28, 1.7]} position={[0, 0, 0]} />

      {HAS_GLTF ? (
        <Suspense fallback={<BoxCar />}><GLTFCar /></Suspense>
      ) : (
        <BoxCar />
      )}
    </RigidBody>
  )
}

const Vehicle = forwardRef(VehicleInner)
export default Vehicle