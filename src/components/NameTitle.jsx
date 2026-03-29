import { Suspense, useRef } from 'react'
import { Text3D, Center } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

// Each letter is a separate upright RigidBody — car knocks them over!
function PhysicsLetter({ char, position, color = '#ffffff', size = 3.5 }) {
  return (
    <RigidBody
      type="dynamic"
      position={position}
      colliders="cuboid"
      mass={12}           // Heavy — satisfying thud when hit
      linearDamping={0.6}
      angularDamping={0.8}
      restitution={0.15}
    >
      <Center>
        <Text3D
          font="/fonts/helvetiker_bold.typeface.json"
          size={size}
          height={0.8}       // Depth of letter
          curveSegments={4}
          bevelEnabled
          bevelSize={0.08}
          bevelThickness={0.1}
          bevelSegments={2}
        >
          {char}
          <meshStandardMaterial
            color={color}
            roughness={0.25}
            metalness={0.15}
          />
        </Text3D>
      </Center>
    </RigidBody>
  )
}

// Static flat ground text for instructions (not physics)
function GroundText({ text, position, tiltZ = 0, size = 0.75, color = '#f0c060' }) {
  return (
    <Center position={position} rotation={[-Math.PI / 2, Math.PI, tiltZ]}>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.15}
        curveSegments={3}
        bevelEnabled={false}
      >
        {text}
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </Text3D>
    </Center>
  )
}

export default function NameTitle() {
  // Letter positions — laid out in a line near spawn
  // Car spawns at [0,0,0], faces +Z, so letters are offset in X/Z
  // Arranged so you naturally drive through/past them
  const letters = [
    // "ASIT" — left side of spawn area
    { char: 'A', pos: [-22, 1.9, 18] },
    { char: 'S', pos: [-17, 1.9, 20] },
    { char: 'I', pos: [-13, 1.9, 21] },
    { char: 'T', pos: [-9,  1.9, 22] },
    // "MINZ" — slightly further, staggered
    { char: 'M', pos: [-5,  1.9, 28] },
    { char: 'I', pos: [0,   1.9, 30] },
    { char: 'N', pos: [5,   1.9, 31] },
    { char: 'Z', pos: [10,  1.9, 30] },
  ]

  return (
    <Suspense fallback={null}>
      <group>
        {/* Upright bumping letters — white */}
        {letters.map(({ char, pos }, i) => (
          <PhysicsLetter
            key={`${char}-${i}`}
            char={char}
            position={pos}
            color="#ffffff"
            size={3.2}
          />
        ))}

        {/* Instruction text flat on ground near start */}
        <GroundText
          text="USE ARROW KEYS TO EXPLORE"
          position={[6, 0.58, 10]}
          tiltZ={0.08}
          size={0.68}
          color="#f0c060"
        />
        <GroundText
          text="R = RESET  |  M = MUTE"
          position={[6, 0.58, 12.2]}
          tiltZ={0.08}
          size={0.58}
          color="rgba(240,192,96,0.55)"
        />
      </group>
    </Suspense>
  )
}