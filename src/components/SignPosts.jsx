import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'

function SignPost({ position, text, color, rotationY = 0 }) {
  return (
    // type="fixed" — posts never move from physics
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]}>
      <group>
        {/* Pole */}
        <mesh castShadow position={[0, 1.2, 0]}>
          <boxGeometry args={[0.12, 2.4, 0.12]} />
          <meshStandardMaterial color="#8B6914" roughness={0.8} />
        </mesh>
        {/* Sign board */}
        <mesh castShadow position={[0, 2.2, 0.16]}>
          <boxGeometry args={[2.0, 0.55, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {/* Sign face */}
        <mesh position={[0, 2.2, 0.24]}>
          <boxGeometry args={[1.88, 0.44, 0.02]} />
          <meshStandardMaterial
            color={color} emissive={color} emissiveIntensity={0.15}
          />
        </mesh>
        {/* Text */}
        <Text
          position={[0, 2.2, 0.32]}
          fontSize={0.22}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000"
        >
          {text}
        </Text>
        {/* Base */}
        <mesh receiveShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[0.35, 0.16, 0.35]} />
          <meshStandardMaterial color="#6B5035" roughness={0.9} />
        </mesh>
      </group>
    </RigidBody>
  )
}

export default function SignPosts() {
  return (
    <group>
      <SignPost
        position={[0, 0, -11]}
        text="☁  CLOUD & INFRA"
        color="#c47a0a"
        rotationY={0}
      />
      <SignPost
        position={[11, 0, 0]}
        text="⬡  PROJECTS"
        color="#0a7a4a"
        rotationY={-Math.PI / 2}
      />
      <SignPost
        position={[-11, 0, 0]}
        text="✦  EASTER EGG"
        color="#7a25b7"
        rotationY={Math.PI / 2}
      />
    </group>
  )
}