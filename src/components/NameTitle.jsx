import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'

function GroundText({ text, position, rotation, size = 2, color = '#e8d5b0' }) {
  return (
    <Center position={position} rotation={rotation}>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.18}
        curveSegments={4}
        bevelEnabled={false}
      >
        {text}
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </Text3D>
    </Center>
  )
}

export default function NameTitle() {
  return (
    <Suspense fallback={null}>
      <group>
        {/* "ASIT" — flat on ground, angled like Bruno's name */}
        <group position={[-16, 0.58, 14]} rotation={[-Math.PI / 2, 0, -0.25]}>
          <GroundText text="ASIT" size={3.8} color="#ffffff" />
        </group>

        {/* "MINZ" — offset for visual rhythm */}
        <group position={[-6, 0.58, 20]} rotation={[-Math.PI / 2, 0, -0.25]}>
          <GroundText text="MINZ" size={3.8} color="#ffffff" />
        </group>

        {/* Instruction text */}
        <group position={[6, 0.58, 10]} rotation={[-Math.PI / 2, 0, 0.12]}>
          <GroundText text="USE ARROW KEYS" size={0.85} color="#f0c060" />
        </group>
        <group position={[7, 0.58, 12.8]} rotation={[-Math.PI / 2, 0, 0.12]}>
          <GroundText text="TO EXPLORE" size={0.85} color="#f0c060" />
        </group>
      </group>
    </Suspense>
  )
}