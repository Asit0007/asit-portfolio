function MailboxProp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.12, 1.2, 0.12]} />
        <meshStandardMaterial color="#4a3010" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.55, 0.38, 0.42]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.22, 0.22]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.18]} />
        <meshStandardMaterial color="#922b21" roughness={0.4} />
      </mesh>
      <mesh position={[0.32, 1.62, 0]}>
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
  return (
    <group position={[0, 0.6, 55]}>
      <MailboxProp position={[-10, 0,  2]} />
      <MailboxProp position={[ 10, 0, -2]} />
      <MailboxProp position={[  0, 0,  8]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 4]}>
        <planeGeometry args={[14, 3]} />
        <meshStandardMaterial color="#f43f5e" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}
