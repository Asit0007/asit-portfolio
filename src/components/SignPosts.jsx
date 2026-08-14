import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

function ArrowSign({ position, text, color, rotationY = 0, pointLeft = false }) {
  const arrowShape = new THREE.Shape()
  const w = 1.9, h = 0.48, tip = 0.48
  if (pointLeft) {
    arrowShape.moveTo(-w - tip,  0)
    arrowShape.lineTo(-w,        h)
    arrowShape.lineTo( w,        h)
    arrowShape.lineTo( w,       -h)
    arrowShape.lineTo(-w,       -h)
    arrowShape.closePath()
  } else {
    arrowShape.moveTo(-w,  h)
    arrowShape.lineTo( w,  h)
    arrowShape.lineTo( w + tip, 0)
    arrowShape.lineTo( w,      -h)
    arrowShape.lineTo(-w,      -h)
    arrowShape.closePath()
  }

  const extrudeSettings = { depth: 0.18, bevelEnabled: false }

  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]}>
      <group>
        {/* Pole */}
        <mesh position={[0, 2.0, 0]}>
          <cylinderGeometry args={[0.08, 0.10, 4.0, 6]} />
          <meshStandardMaterial color="#6B5020" roughness={0.8} />
        </mesh>

        {/* Arrow board */}
        <mesh position={[0, 4.0, 0]}>
          <extrudeGeometry args={[arrowShape, extrudeSettings]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.08} />
        </mesh>

        {/* Sign text — front face */}
        <Text
          position={[pointLeft ? -0.32 : 0.32, 4.0, 0.2]}
          fontSize={0.44}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
          maxWidth={3.4}
        >
          {text}
        </Text>

        {/* Sign text — back face, readable driving the opposite way.
            A 180° rotation (not a mirror) keeps the text right-reading,
            same as flipping a physical sign around to face the other way. */}
        <group rotation={[0, Math.PI, 0]}>
          <Text
            position={[pointLeft ? 0.32 : -0.32, 4.0, 0.02]}
            fontSize={0.44}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
            maxWidth={3.4}
          >
            {text}
          </Text>
        </group>

        {/* Base */}
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.38, 0.18, 0.38]} />
          <meshStandardMaterial color="#4a3a18" roughness={0.9} />
        </mesh>
      </group>
    </RigidBody>
  )
}

export default function SignPosts() {
  return (
    <group>
      {/* North → Cloud & Infra */}
      <ArrowSign
        position={[2.5, 0, -11]}
        text="CLOUD & INFRA"
        color="#c47a0a"
        rotationY={Math.PI / 2}
      />

      {/* East → Projects */}
      <ArrowSign
        position={[11, 0, 2.5]}
        text="PROJECTS"
        color="#0a7a4a"
        rotationY={0}
      />

      {/* West → Easter Egg */}
      <ArrowSign
        position={[-11, 0, -2.5]}
        text="EASTER EGG"
        color="#7a25b7"
        rotationY={0}
        pointLeft
      />

      {/* South → Contact */}
      <ArrowSign
        position={[-2.5, 0, 11]}
        text="CONTACT"
        color="#c4154a"
        rotationY={Math.PI / 2}
        pointLeft
      />
    </group>
  )
}
