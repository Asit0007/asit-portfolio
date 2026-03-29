import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'

// rotation breakdown:
// -PI/2 = lie flat on ground
// Math.PI = flip to face -Z direction (toward camera which is at -Z)
// tiltZ  = slight angle for visual interest
function GroundText({ text, position, tiltZ = 0, size = 2, color = '#ffffff' }) {
  return (
    <Center position={position} rotation={[-Math.PI / 2, Math.PI, tiltZ]}>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.22}
        curveSegments={4}
        bevelEnabled={false}
      >
        {text}
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.08} />
      </Text3D>
    </Center>
  )
}

export default function NameTitle() {
  return (
    <Suspense fallback={null}>
      <group>
        {/* "ASIT" — large, left of path, visible as car approaches */}
        <GroundText
          text="ASIT"
          position={[-18, 0.58, 22]}
          tiltZ={-0.18}
          size={4.2}
          color="#ffffff"
        />

        {/* "MINZ" — offset right to create rhythmic layout like Bruno */}
        <GroundText
          text="MINZ"
          position={[-4, 0.58, 30]}
          tiltZ={-0.18}
          size={4.2}
          color="#ffffff"
        />

        {/* Instructions — close to start, first thing player reads */}
        <GroundText
          text="USE ARROW KEYS"
          position={[8, 0.58, 10]}
          tiltZ={0.1}
          size={0.78}
          color="#f0c060"
        />
        <GroundText
          text="TO EXPLORE"
          position={[9, 0.58, 12.4]}
          tiltZ={0.1}
          size={0.78}
          color="#f0c060"
        />
        <GroundText
          text="R = RESET CAR"
          position={[8.5, 0.58, 14.8]}
          tiltZ={0.1}
          size={0.62}
          color="rgba(240,192,96,0.7)"
        />
      </group>
    </Suspense>
  )
}