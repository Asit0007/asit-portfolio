import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'

function FloatingCard({ position, lines, color, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Card backing */}
      <mesh castShadow>
        <boxGeometry args={[4.5, 2.8, 0.15]} />
        <meshStandardMaterial color="#1a0a06" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Colored border */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[4.3, 2.6, 0.02]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={0.3}
          transparent opacity={0.6}
        />
      </mesh>
      {/* Text lines */}
      {lines.map((line, i) => (
        <Text
          key={i}
          position={[0, 0.85 - i * 0.52, 0.1]}
          fontSize={0.22}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={4}
        >
          {line}
        </Text>
      ))}
    </group>
  )
}

function MailboxProp({ position }) {
  return (
    <group position={position}>
      {/* Post */}
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[0.12, 1.2, 0.12]} />
        <meshStandardMaterial color="#4a3010" roughness={0.8} />
      </mesh>
      {/* Box */}
      <mesh castShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[0.55, 0.38, 0.42]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} />
      </mesh>
      {/* Flap */}
      <mesh position={[0, 1.22, 0.22]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.18]} />
        <meshStandardMaterial color="#922b21" roughness={0.4} />
      </mesh>
      {/* Flag */}
      <mesh castShadow position={[0.32, 1.62, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
        <meshStandardMaterial color="#888" roughness={0.6} />
      </mesh>
      <mesh position={[0.44, 1.82, 0]}>
        <boxGeometry args={[0.24, 0.16, 0.04]} />
        <meshStandardMaterial color="#e74c3c" emissive="#c0392b" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

export default function ContactZone() {
  // Positioned at south zone [0, 0, 55]
  return (
    <group position={[0, 0.6, 55]}>
      {/* Info cards arranged in a semicircle */}
      <FloatingCard
        position={[-6, 1.8, -4]}
        rotation={[0, 0.3, 0]}
        color="#f43f5e"
        lines={[
          '📧 EMAIL',
          'asitminz007@gmail.com',
        ]}
      />
      <FloatingCard
        position={[6, 1.8, -4]}
        rotation={[0, -0.3, 0]}
        color="#0ea5e9"
        lines={[
          '💼 LINKEDIN',
          'in/asitminz',
        ]}
      />
      <FloatingCard
        position={[0, 1.8, -7]}
        rotation={[0, 0, 0]}
        color="#8b5cf6"
        lines={[
          '🐙 GITHUB',
          'Asit0007',
        ]}
      />

      {/* Mailboxes */}
      <MailboxProp position={[-10, 0,  2]} />
      <MailboxProp position={[ 10, 0, -2]} />
      <MailboxProp position={[  0, 0,  8]} />

      {/* Bumpable crates with contact theme */}
      {[[-7,1,-7],[-5,1,-8],[5,1,-7],[7,1,-8]].map(([x,y,z],i) => (
        <RigidBody key={i} position={[x,y,z]} colliders="cuboid"
          mass={0.5} linearDamping={0.7} angularDamping={0.7}>
          <mesh castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f43f5e" roughness={0.8} flatShading />
          </mesh>
        </RigidBody>
      ))}

      {/* "CONTACT" text on ground */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 4]}>
        <planeGeometry args={[14, 3]} />
        <meshStandardMaterial color="#f43f5e" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}