import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'

function GroundText({ text, position, rotationY = 0, size = 2, color = '#e8d5b0' }) {
  return (
    <Center
      position={position}
      rotation={[-Math.PI / 2, 0, rotationY]}
    >
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.2}
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
        {/* Name — positioned to the LEFT of spawn so car drives past it
            Sized to match Bruno's scale (his letters are ~3-4 units) */}
        <GroundText
          text="ASIT"
          position={[-20, 0.58, 22]}
          rotationY={-0.2}
          size={4}
          color="#ffffff"
        />
        <GroundText
          text="MINZ"
          position={[-8, 0.58, 30]}
          rotationY={-0.2}
          size={4}
          color="#ffffff"
        />

        {/* Instructions — smaller, placed near start pad edge */}
        <GroundText
          text="USE ARROW KEYS"
          position={[8, 0.58, 14]}
          rotationY={0.1}
          size={0.75}
          color="#f0c060"
        />
        <GroundText
          text="TO EXPLORE"
          position={[9, 0.58, 16.2]}
          rotationY={0.1}
          size={0.75}
          color="#f0c060"
        />
        <GroundText
          text="R = RESET CAR"
          position={[8, 0.58, 18.4]}
          rotationY={0.1}
          size={0.6}
          color="#f0c060"
        />
      </group>
    </Suspense>
  )
}