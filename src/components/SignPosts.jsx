import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

function ArrowSign({ position, text, color, rotationY = 0, pointLeft = false }) {
  // Arrow sign shape — wider, with a pointed end
  const arrowShape = new THREE.Shape()
  const w = 1.1, h = 0.3, tip = 0.35
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

  const extrudeSettings = { depth: 0.12, bevelEnabled: false }

  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]}>
      <group>
        {/* Pole */}
        <mesh castShadow position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 2.2, 6]} />
          <meshStandardMaterial color="#6B5020" roughness={0.8} />
        </mesh>

        {/* Arrow sign board */}
        <mesh castShadow position={[0, 2.2, 0]} rotation={[0, 0, 0]}>
          <extrudeGeometry args={[arrowShape, extrudeSettings]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
        </mesh>

        {/* Sign text */}
        <Text
          position={[pointLeft ? -0.2 : 0.2, 2.2, 0.14]}
          fontSize={0.24}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000"
          maxWidth={2}
        >
          {text}
        </Text>

        {/* Base */}
        <mesh receiveShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[0.3, 0.16, 0.3]} />
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
        rotationY={0}
      />

      {/* East → Projects */}
      <ArrowSign
        position={[11, 0, 2.5]}
        text="PROJECTS"
        color="#0a7a4a"
        rotationY={-Math.PI / 2}
      />

      {/* West → Easter Egg */}
      <ArrowSign
        position={[-11, 0, -2.5]}
        text="EASTER EGG"
        color="#7a25b7"
        rotationY={Math.PI / 2}
        pointLeft
      />

      {/* South → Contact */}
      <ArrowSign
        position={[-2.5, 0, 11]}
        text="CONTACT"
        color="#c4154a"
        rotationY={Math.PI}
        pointLeft
      />
    </group>
  )
}