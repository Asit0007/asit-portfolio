import { RigidBody } from '@react-three/rapier'

export default function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1.5}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3a5c2e" />
      </mesh>
    </RigidBody>
  )
}