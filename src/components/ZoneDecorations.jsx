import { RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'

// ── Reusable primitives ───────────────────────────────────────────────────────

function Box({ position, size, color, rotation = [0,0,0], emissive, emissiveIntensity = 0 }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.1}
        emissive={emissive || color}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

function Cylinder({ position, args, color, rotation = [0,0,0] }) {
  return (
    <mesh castShadow position={position} rotation={rotation}>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
    </mesh>
  )
}

// ── Bumpable physics crate ────────────────────────────────────────────────────
function Crate({ position, size = [1.2, 1.2, 1.2], color = '#c8b89a' }) {
  return (
    <RigidBody
      position={position}
      colliders="cuboid"
      mass={0.4}
      linearDamping={0.5}
      angularDamping={0.8}
      restitution={0.3}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      {/* Cross lines on crate face */}
      <mesh position={[0, 0, size[2]/2 + 0.01]}>
        <planeGeometry args={[size[0]*0.8, 0.06]} />
        <meshStandardMaterial color="#a09070" roughness={1} />
      </mesh>
      <mesh position={[0, 0, size[2]/2 + 0.01]} rotation={[0,0,Math.PI/2]}>
        <planeGeometry args={[size[1]*0.8, 0.06]} />
        <meshStandardMaterial color="#a09070" roughness={1} />
      </mesh>
    </RigidBody>
  )
}

// ── Server rack ───────────────────────────────────────────────────────────────
function ServerRack({ position }) {
  return (
    <group position={position}>
      {/* Main chassis */}
      <Box position={[0, 1.2, 0]} size={[1.2, 2.4, 0.6]} color="#2a2a2a" />
      {/* Server units — stacked */}
      {[0.3, 0.6, 0.9, 1.2, 1.5, 1.8].map((y, i) => (
        <group key={i}>
          <Box position={[0, y, 0.31]} size={[1.1, 0.22, 0.04]}
            color={i % 2 === 0 ? '#1a1a1a' : '#222'} />
          {/* Status LEDs */}
          <Box position={[-0.35, y, 0.34]} size={[0.06, 0.06, 0.02]}
            color="#00ff44" emissive="#00ff44" emissiveIntensity={2} />
          <Box position={[-0.22, y, 0.34]} size={[0.06, 0.06, 0.02]}
            color="#ff8800" emissive="#ff8800" emissiveIntensity={1.5} />
        </group>
      ))}
      {/* Rack rails */}
      <Box position={[-0.55, 1.2, 0]} size={[0.06, 2.4, 0.65]} color="#333" />
      <Box position={[ 0.55, 1.2, 0]} size={[0.06, 2.4, 0.65]} color="#333" />
    </group>
  )
}

// ── Monitor + desk ────────────────────────────────────────────────────────────
function WorkStation({ position }) {
  return (
    <group position={position}>
      {/* Desk */}
      <Box position={[0, 0.45, 0]} size={[2.4, 0.08, 1]} color="#8B7355" />
      <Box position={[-1.1, 0.2, 0.4]} size={[0.08, 0.5, 0.08]} color="#6B5335" />
      <Box position={[ 1.1, 0.2, 0.4]} size={[0.08, 0.5, 0.08]} color="#6B5335" />
      <Box position={[-1.1, 0.2,-0.4]} size={[0.08, 0.5, 0.08]} color="#6B5335" />
      <Box position={[ 1.1, 0.2,-0.4]} size={[0.08, 0.5, 0.08]} color="#6B5335" />

      {/* Monitor stand */}
      <Box position={[0, 0.55, -0.25]} size={[0.2, 0.18, 0.18]} color="#222" />
      <Box position={[0, 0.56, -0.27]} size={[0.04, 0.5, 0.04]}  color="#222" />
      {/* Monitor screen */}
      <Box position={[0, 1.12, -0.28]} size={[1.4, 0.85, 0.06]}  color="#111" />
      <Box position={[0, 1.12, -0.25]} size={[1.3, 0.75, 0.02]}
        color="#001833" emissive="#001833" emissiveIntensity={0.8} />
      {/* Code on screen — tiny boxes simulating text lines */}
      {[0.28, 0.18, 0.08, -0.02, -0.12, -0.22].map((y, i) => (
        <Box key={i}
          position={[-0.3 + (i%2)*0.15, 1.12 + y, -0.24]}
          size={[0.4 + (i%3)*0.1, 0.04, 0.01]}
          color={['#00ff88','#4488ff','#ffaa00','#ff4488','#00ffff','#88ff00'][i]}
          emissive={['#00ff88','#4488ff','#ffaa00','#ff4488','#00ffff','#88ff00'][i]}
          emissiveIntensity={1}
        />
      ))}

      {/* Keyboard */}
      <Box position={[0, 0.5, 0.18]} size={[0.9, 0.04, 0.3]} color="#333" />
      {/* Mouse */}
      <Box position={[0.7, 0.5, 0.18]} size={[0.12, 0.04, 0.18]} color="#444" />
    </group>
  )
}

// ── Docker container stack (for projects zone) ────────────────────────────────
function DockerStack({ position }) {
  const colors = ['#0db7ed','#2496ed','#384d54','#0db7ed','#2496ed']
  return (
    <group position={position}>
      {colors.map((c, i) => (
        <Box key={i}
          position={[0, i * 0.42 + 0.2, 0]}
          size={[1.0, 0.38, 0.6]}
          color={c}
          emissive={c}
          emissiveIntensity={0.15}
        />
      ))}
      {/* Docker whale logo simplified */}
      <Box position={[0, 2.4, 0.31]} size={[0.6, 0.3, 0.02]} color="#fff" />
    </group>
  )
}

// ── Muay Thai heavy bag ───────────────────────────────────────────────────────
function HeavyBag({ position }) {
  return (
    <group position={position}>
      {/* Chain */}
      <Box position={[0, 2.8, 0]} size={[0.06, 0.4, 0.06]} color="#888" />
      {/* Bag body */}
      <Cylinder position={[0, 1.8, 0]} args={[0.28, 0.28, 2.2, 8]} color="#cc2200" />
      {/* Tape strips */}
      {[0.6, 0.0, -0.6].map((y, i) => (
        <Cylinder key={i} position={[0, 1.8 + y, 0]}
          args={[0.29, 0.29, 0.06, 8]} color="#111" />
      ))}
      {/* Bottom cap */}
      <Cylinder position={[0, 0.65, 0]} args={[0.28, 0.2, 0.2, 8]} color="#991500" />
    </group>
  )
}

// ── PS2 console ───────────────────────────────────────────────────────────────
function PS2({ position }) {
  return (
    <group position={position}>
      {/* Main body — slim horizontal */}
      <Box position={[0, 0.2, 0]}    size={[2.2, 0.28, 0.9]}  color="#1a1a2e" />
      <Box position={[0, 0.35, 0]}   size={[2.0, 0.05, 0.7]}  color="#16213e" />
      {/* Disc tray area */}
      <Box position={[-0.5, 0.36, 0]} size={[0.8, 0.02, 0.5]} color="#0f3460" />
      {/* Power + reset buttons */}
      <Cylinder position={[0.65, 0.35, 0.2]}
        args={[0.06, 0.06, 0.04, 8]} color="#00aa44" />
      <Cylinder position={[0.85, 0.35, 0.2]}
        args={[0.05, 0.05, 0.04, 8]} color="#555" />
      {/* Controller ports */}
      {[-0.9, -0.7].map((x, i) => (
        <Box key={i} position={[x, 0.2, 0.46]}
          size={[0.14, 0.1, 0.04]} color="#0a0a1a" />
      ))}
      {/* Memory card slots */}
      {[0.1, 0.25].map((x, i) => (
        <Box key={i} position={[x, 0.28, 0.46]}
          size={[0.09, 0.06, 0.03]} color="#0a0a1a" />
      ))}
    </group>
  )
}

// ── Badminton racket ──────────────────────────────────────────────────────────
function Racket({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Handle */}
      <Cylinder position={[0, -0.7, 0]}
        args={[0.04, 0.05, 1.0, 6]} color="#8B4513" />
      {/* Shaft */}
      <Cylinder position={[0, 0.1, 0]}
        args={[0.025, 0.025, 0.7, 6]} color="#aaa" />
      {/* Frame */}
      <Cylinder position={[0, 0.65, 0]}
        args={[0.38, 0.38, 0.04, 16, 1, true]} color="#cc4400" />
      {/* Strings — simplified grid */}
      {[-0.22, -0.11, 0, 0.11, 0.22].map((x, i) => (
        <Box key={`sv-${i}`}
          position={[x, 0.65, 0]}
          size={[0.015, 0.68, 0.01]}
          color="#ddd"
        />
      ))}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((y, i) => (
        <Box key={`sh-${i}`}
          position={[0, 0.65 + y, 0]}
          size={[0.68, 0.015, 0.01]}
          color="#ddd"
        />
      ))}
    </group>
  )
}

// ── Directional signpost ──────────────────────────────────────────────────────
export function SignPost({ position, text, color, rotation = 0 }) {
  return (
    <group position={position}>
      {/* Pole */}
      <Box position={[0, 1.2, 0]} size={[0.1, 2.4, 0.1]} color="#8B6914" />
      {/* Sign board */}
      <group rotation={[0, rotation, 0]}>
        <Box position={[0, 2.2, 0.15]} size={[1.8, 0.5, 0.12]} color={color} />
        <Box position={[0, 2.2, 0.21]} size={[1.7, 0.4, 0.02]}
          color={color} emissive={color} emissiveIntensity={0.2} />
        <Text
          position={[0, 2.2, 0.28]}
          fontSize={0.22}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000"
        >
          {text}
        </Text>
      </group>
      {/* Post base */}
      <Box position={[0, 0.08, 0]} size={[0.3, 0.16, 0.3]} color="#6B5035" />
    </group>
  )
}

// ── Terraform logo block ──────────────────────────────────────────────────────
function TerraformBlock({ position }) {
  return (
    <group position={position}>
      <Box position={[0, 0.5, 0]} size={[1.1, 1.0, 1.1]} color="#7B42BC" />
      <Box position={[0, 1.05, 0]} size={[0.9, 0.08, 0.9]}
        color="#9B62DC" emissive="#9B62DC" emissiveIntensity={0.3} />
      <Text
        position={[0, 0.5, 0.56]}
        fontSize={0.3}
        color="#fff"
        anchorX="center"
        anchorY="middle"
      >
        TF
      </Text>
    </group>
  )
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function ZoneDecorations() {
  return (
    <group>

      {/* ── CLOUD ZONE [0, 0, -55] ─────────────────────────────────────── */}
      <group position={[0, 0.6, -55]}>
        <ServerRack position={[-9,  0,  -5]} />
        <ServerRack position={[-9,  0,   0]} />
        <ServerRack position={[-9,  0,   5]} />
        <ServerRack position={[ 9,  0,  -5]} />
        <ServerRack position={[ 9,  0,   0]} />
        <TerraformBlock position={[4, 0, 8]} />
        <TerraformBlock position={[6, 0, 8]} />
        <TerraformBlock position={[5, 0, 6]} />
        {/* Bumpable crates */}
        <Crate position={[ 3, 1, -3]} size={[1.2,1.2,1.2]} color="#ddd0b8" />
        <Crate position={[ 4, 1, -2]} size={[1.0,1.0,1.0]} color="#ccbba8" />
        <Crate position={[-4, 1,  3]} size={[1.3,1.3,1.3]} color="#d5c8b2" />
        <Crate position={[-3, 1,  4]} size={[1.0,1.0,1.0]} color="#c8bba2" />
      </group>

      {/* ── PROJECTS ZONE [55, 0, 0] ───────────────────────────────────── */}
      <group position={[55, 0.6, 0]}>
        <WorkStation position={[0, 0, -6]} />
        <WorkStation position={[0, 0,  6]} />
        <DockerStack  position={[-8, 0, -4]} />
        <DockerStack  position={[-8, 0,  4]} />
        <DockerStack  position={[ 8, 0,  0]} />
        {/* Bumpable crates */}
        <Crate position={[4, 1,  5]} size={[1.2,1.2,1.2]} color="#0db7ed" />
        <Crate position={[5, 1,  3]} size={[0.9,0.9,0.9]} color="#2496ed" />
        <Crate position={[3, 1, -5]} size={[1.1,1.1,1.1]} color="#0db7ed" />
        <Crate position={[-4,1,  0]} size={[1.0,1.5,1.0]} color="#ddd0b8" />
      </group>

      {/* ── HOBBIES ZONE [-55, 0, 0] ───────────────────────────────────── */}
      <group position={[-55, 0.6, 0]}>
        <HeavyBag position={[-4, 0, -4]} />
        <HeavyBag position={[ 4, 0,  4]} />
        <PS2      position={[ 0, 0,  6]} />
        <Racket   position={[-6, 1.2, 0]} rotation={[0, 0.3, 0.8]} />
        <Racket   position={[ 6, 1.2, 2]} rotation={[0, -0.4, 0.9]} />
        {/* Bumpable blocks — "fun" to crash into */}
        <Crate position={[ 5, 1, -5]} size={[1.4,1.4,1.4]} color="#cc2200" />
        <Crate position={[-5, 1,  5]} size={[1.2,1.2,1.2]} color="#cc2200" />
        <Crate position={[ 0, 1, -7]} size={[1.0,1.0,1.0]} color="#444" />
        <Crate position={[-3, 1, -6]} size={[1.1,1.1,1.1]} color="#333" />
        <Crate position={[ 3, 1, -6]} size={[0.9,0.9,0.9]} color="#444" />
      </group>

    </group>
  )
}