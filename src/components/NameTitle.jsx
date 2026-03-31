import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

function PhysicsLetter({ char, position, color = '#ffffff', size = 3.2 }) {
  return (
    <RigidBody
      type="dynamic"
      position={position}
      colliders="cuboid"
      mass={14}
      linearDamping={0.6}
      angularDamping={0.8}
      restitution={0.12}
    >
      <Center>
        <Text3D
          font="/fonts/helvetiker_bold.typeface.json"
          size={size}
          height={0.85}
          curveSegments={4}
          bevelEnabled
          bevelSize={0.08}
          bevelThickness={0.1}
          bevelSegments={2}
        >
          {char}
          <meshStandardMaterial color={color} roughness={0.22} metalness={0.18} />
        </Text3D>
      </Center>
    </RigidBody>
  )
}

function GroundText({ text, position, tiltZ = 0, size = 0.75, color = '#f0c060' }) {
  return (
    <Center position={position} rotation={[-Math.PI / 2, 0, tiltZ]}>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.15}
        curveSegments={3}
        bevelEnabled={false}
      >
        {text}
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          metalness={0.05}
          side={2}
        />
      </Text3D>
    </Center>
  )
}

export default function NameTitle() {
  const letters = [
    { char: 'A', pos: [-22, 1.9, -18] },
    { char: 'S', pos: [-17, 1.9, -20] },
    { char: 'I', pos: [-13, 1.9, -21] },
    { char: 'T', pos: [-9,  1.9, -22] },
    { char: 'M', pos: [-4,  1.9, -28] },
    { char: 'I', pos: [0.5, 1.9, -30] },
    { char: 'N', pos: [5,   1.9, -31] },
    { char: 'Z', pos: [10,  1.9, -30] },
  ]

  return (
    <Suspense fallback={null}>
      <group>
        {letters.map(({ char, pos }, i) => (
          <PhysicsLetter
            key={`${char}-${i}`}
            char={char}
            position={pos}
            color="#ffffff"
          />
        ))}

        {/* FIX: no rgba() in Three.js color — use solid hex only */}
        <GroundText
          text="USE ARROW KEYS TO EXPLORE"
          position={[7, 0.58, -9]}
          tiltZ={-0.06}
          size={0.65}
          color="#f0c060"
        />
        <GroundText
          text="R=RESET  M=MUTE  TAB=MAP  SHIFT=BOOST"
          position={[7.5, 0.58, -11.2]}
          tiltZ={-0.06}
          size={0.45}
          color="#c49a30"   // ← solid hex, NOT rgba() — Three.js ignores alpha
        />
      </group>
    </Suspense>
  )
}