import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

function PhysicsLetter({ char, position, color = '#ffffff', size = 3.2 }) {
  return (
    <RigidBody
      type="dynamic"
      position={position}
      colliders="cuboid"
      // 1.5 was 75% of the car's own CHASSIS_MASS (2), so hitting a letter
      // was closer to hitting another car than to knocking over a prop.
      mass={0.5}
      linearDamping={0.2}
      angularDamping={0.3}
      restitution={0.18}
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

function GroundText({ text, position, tiltZ = 0, size = 0.75, color = '#ffffff' }) {
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
        {/* Slight emissive so instruction text reads against the warm sand
            under the static sun (in-world sign text — DESIGN.md §3/§6) */}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.5}
          metalness={0.05}
          side={2}
        />
      </Text3D>
    </Center>
  )
}

// Hoisted out of the component so the rest of the world can avoid spawning
// on top of the name. The letters are dynamic bodies and can be shoved
// around, but this is where they start, which is what placement cares about.
const LETTERS = [
  { char: 'A', pos: [-22, 1.9, -18] },
  { char: 'S', pos: [-17, 1.9, -20] },
  { char: 'I', pos: [-13, 1.9, -21] },
  { char: 'T', pos: [-9,  1.9, -22] },
  { char: 'M', pos: [-4,  1.9, -28] },
  { char: 'I', pos: [0.5, 1.9, -30] },
  { char: 'N', pos: [5,   1.9, -31] },
  { char: 'Z', pos: [10,  1.9, -30] },
]

// Axis-aligned keep-out around the name. Derived from the letters rather
// than written out, so moving a letter moves the exclusion with it. The 5
// unit pad covers a letter's half-width (~1.75 at size 3.2) plus a full
// tree canopy radius (~2.5 at the largest instance scale), so a trunk can't
// sit far enough outside the box for its crown to still cross a letter.
const NAME_PAD = 5
export const NAME_KEEPOUT = {
  minX: Math.min(...LETTERS.map((l) => l.pos[0])) - NAME_PAD,
  maxX: Math.max(...LETTERS.map((l) => l.pos[0])) + NAME_PAD,
  minZ: Math.min(...LETTERS.map((l) => l.pos[2])) - NAME_PAD,
  maxZ: Math.max(...LETTERS.map((l) => l.pos[2])) + NAME_PAD,
}

export function isOnName(x, z) {
  return x > NAME_KEEPOUT.minX && x < NAME_KEEPOUT.maxX
      && z > NAME_KEEPOUT.minZ && z < NAME_KEEPOUT.maxZ
}

export default function NameTitle() {
  const letters = LETTERS

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

        {/* White, not amber — amber vanished into the sand. Matches the
            white 3D letters (DESIGN.md: in-world text is white or emphasis) */}
        <GroundText
          text="USE ARROW KEYS TO EXPLORE"
          position={[7, 0.58, -9]}
          tiltZ={-0.06}
          size={0.65}
          color="#ffffff"
        />
        <GroundText
          text="R=RESET  M=MUTE  TAB=MAP  SHIFT=BOOST"
          position={[7.5, 0.58, -11.2]}
          tiltZ={-0.06}
          size={0.45}
          color="#fff4e0"
        />
      </group>
    </Suspense>
  )
}