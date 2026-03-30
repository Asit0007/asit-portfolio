import { RigidBody } from '@react-three/rapier'
import { Text, Html } from '@react-three/drei'
import { useState } from 'react'
import { ZONES } from '../store/useGameStore'

// ── Reusable primitives ──────────────────────────────────────────────────────
function Box({ position, size, color, rotation=[0,0,0], emissive, emissiveIntensity=0 }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color} roughness={0.7} metalness={0.1}
        emissive={emissive||color} emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

function Cylinder({ position, args, color, rotation=[0,0,0] }) {
  return (
    <mesh castShadow position={position} rotation={rotation}>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
    </mesh>
  )
}

function Crate({ position, size=[1.2,1.2,1.2], color='#c8b89a' }) {
  return (
    <RigidBody position={position} colliders="cuboid" mass={0.4}
      linearDamping={0.5} angularDamping={0.8} restitution={0.3}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
    </RigidBody>
  )
}

function ServerRack({ position }) {
  return (
    <group position={position}>
      <Box position={[0,1.2,0]} size={[1.2,2.4,0.6]} color="#2a2a2a" />
      {[0.3,0.6,0.9,1.2,1.5,1.8].map((y,i) => (
        <group key={i}>
          <Box position={[0,y,0.31]} size={[1.1,0.22,0.04]} color={i%2===0?'#1a1a1a':'#222'} />
          <Box position={[-0.35,y,0.34]} size={[0.06,0.06,0.02]}
            color="#00ff44" emissive="#00ff44" emissiveIntensity={2} />
          <Box position={[-0.22,y,0.34]} size={[0.06,0.06,0.02]}
            color="#ff8800" emissive="#ff8800" emissiveIntensity={1.5} />
        </group>
      ))}
      <Box position={[-0.55,1.2,0]} size={[0.06,2.4,0.65]} color="#333" />
      <Box position={[0.55,1.2,0]}  size={[0.06,2.4,0.65]} color="#333" />
    </group>
  )
}

// ── 3D PROJECT BILLBOARD with embedded HTML slideshow ──────────────────────
const PROJECT_SLIDES = [
  {
    title: 'CloudPulse',
    tech: 'Go · AWS ECS Fargate · Terraform · GitHub Actions',
    desc: 'Real-time cloud monitoring dashboard with automated CI/CD pipeline',
    image: '/images/cloudpulse.png',
    url: 'https://github.com/Asit0007',
    color: '#0db7ed',
  },
  {
    title: 'QuantBot',
    tech: 'Python · OCI · Docker Compose · Cloudflare Tunnel',
    desc: 'Automated trading system with zero-port-exposure HTTPS via Cloudflare',
    image: '/images/quantbot.png',
    url: 'https://github.com/Asit0007',
    color: '#f59e0b',
  },
  {
    title: 'Magento DeployKit',
    tech: 'Bash · NGINX · PHP-FPM · Varnish · DigitalOcean',
    desc: '7 idempotent Bash scripts with 3-layer caching for production Magento',
    image: '/images/magento.png',
    url: 'https://github.com/Asit0007',
    color: '#10b981',
  },
]

function ProjectBillboard({ position }) {
  const [idx, setIdx] = useState(0)
  const slide = PROJECT_SLIDES[idx]

  return (
    <group position={position}>
      {/* Billboard frame */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 0, 0]}>
        <group>
          {/* Main frame */}
          <Box position={[0, 3.5, 0]} size={[5.5, 4.2, 0.22]} color="#1a1a1a" />
          {/* Color accent border */}
          <Box position={[0, 3.5, 0.12]} size={[5.3, 4.0, 0.04]}
            color={slide.color} emissive={slide.color} emissiveIntensity={0.15} />
          {/* Support legs */}
          <Box position={[-2.2, 0.9, 0]} size={[0.18, 1.8, 0.18]} color="#333" />
          <Box position={[ 2.2, 0.9, 0]} size={[0.18, 1.8, 0.18]} color="#333" />
          {/* Base cross bar */}
          <Box position={[0, 0.1, 0]} size={[4.8, 0.2, 0.5]} color="#222" />
        </group>
      </RigidBody>

      {/* HTML screen — embedded in 3D world */}
      <Html
        position={[0, 3.5, 0.18]}
        transform
        occlude
        style={{ width: 480, pointerEvents: 'auto' }}
      >
        <div style={{
          width: 480,
          background: 'rgba(5,3,12,0.96)',
          borderRadius: 6,
          overflow: 'hidden',
          border: `2px solid ${slide.color}`,
          fontFamily: 'monospace',
          userSelect: 'none',
        }}>
          {/* Project image */}
          <div style={{
            width: '100%', height: 200, background: '#111',
            position: 'relative', overflow: 'hidden',
          }}>
            <img
              src={slide.image}
              alt={slide.title}
              style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.parentElement.style.background = slide.color + '22'
              }}
            />
            {/* Slide counter */}
            <div style={{
              position:'absolute', top:8, right:10,
              background:'rgba(0,0,0,0.7)', color:'#fff',
              fontSize:11, padding:'2px 8px', borderRadius:20,
            }}>
              {idx+1} / {PROJECT_SLIDES.length}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding:'12px 16px' }}>
            <h2 style={{ color:slide.color, fontSize:18, margin:0, fontWeight:900 }}>
              {slide.title}
            </h2>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:10, margin:'4px 0 8px',
              letterSpacing:'0.05em' }}>
              {slide.tech}
            </p>
            <p style={{ color:'rgba(255,255,255,0.75)', fontSize:12, lineHeight:1.5,
              margin:'0 0 12px' }}>
              {slide.desc}
            </p>

            {/* Navigation */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', gap:6 }}>
                <button
                  onClick={() => setIdx(i => (i-1+PROJECT_SLIDES.length)%PROJECT_SLIDES.length)}
                  style={{
                    background:`${slide.color}22`, border:`1px solid ${slide.color}55`,
                    color:slide.color, borderRadius:5, padding:'5px 14px',
                    cursor:'pointer', fontSize:16, fontWeight:700,
                  }}
                >←</button>
                <button
                  onClick={() => setIdx(i => (i+1)%PROJECT_SLIDES.length)}
                  style={{
                    background:`${slide.color}22`, border:`1px solid ${slide.color}55`,
                    color:slide.color, borderRadius:5, padding:'5px 14px',
                    cursor:'pointer', fontSize:16, fontWeight:700,
                  }}
                >→</button>
              </div>

              {/* Dots */}
              <div style={{ display:'flex', gap:6 }}>
                {PROJECT_SLIDES.map((_,i) => (
                  <div key={i} onClick={() => setIdx(i)} style={{
                    width: i===idx ? 18 : 7, height:7,
                    borderRadius:99, cursor:'pointer',
                    background: i===idx ? slide.color : `${slide.color}40`,
                    transition:'all 0.2s',
                  }} />
                ))}
              </div>

              
                href={slide.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  background:slide.color, color:'#000', borderRadius:5,
                  padding:'5px 12px', fontSize:11, fontWeight:700,
                  textDecoration:'none', letterSpacing:'0.06em',
                }}
              >
                VIEW ↗
              </a>
            </div>
          </div>
        </div>
      </Html>

      {/* Navigation hint text floating above billboard */}
      <Text
        position={[0, 6.2, 0.1]}
        fontSize={0.3}
        color="rgba(255,255,255,0.5)"
        anchorX="center"
        anchorY="middle"
      >
        ← → NAVIGATE PROJECTS
      </Text>
    </group>
  )
}

function DockerStack({ position }) {
  const colors = ['#0db7ed','#2496ed','#384d54','#0db7ed','#2496ed']
  return (
    <group position={position}>
      {colors.map((c,i) => (
        <Box key={i} position={[0, i*0.42+0.2, 0]} size={[1.0,0.38,0.6]}
          color={c} emissive={c} emissiveIntensity={0.15} />
      ))}
      <Box position={[0, 2.4, 0.31]} size={[0.6,0.3,0.02]} color="#fff" />
    </group>
  )
}

function TerraformBlock({ position }) {
  return (
    <group position={position}>
      <Box position={[0,0.5,0]} size={[1.1,1.0,1.1]} color="#7B42BC" />
      <Box position={[0,1.05,0]} size={[0.9,0.08,0.9]}
        color="#9B62DC" emissive="#9B62DC" emissiveIntensity={0.3} />
      <Text position={[0,0.5,0.56]} fontSize={0.3} color="#fff"
        anchorX="center" anchorY="middle">TF</Text>
    </group>
  )
}

function HeavyBag({ position }) {
  return (
    <group position={position}>
      <Box position={[0,2.8,0]} size={[0.06,0.4,0.06]} color="#888" />
      <Cylinder position={[0,1.8,0]} args={[0.28,0.28,2.2,8]} color="#cc2200" />
      {[0.6,0.0,-0.6].map((y,i) => (
        <Cylinder key={i} position={[0,1.8+y,0]} args={[0.29,0.29,0.06,8]} color="#111" />
      ))}
      <Cylinder position={[0,0.65,0]} args={[0.28,0.2,0.2,8]} color="#991500" />
    </group>
  )
}

function PS2({ position }) {
  return (
    <group position={position}>
      <Box position={[0,0.2,0]}    size={[2.2,0.28,0.9]}  color="#1a1a2e" />
      <Box position={[0,0.35,0]}   size={[2.0,0.05,0.7]}  color="#16213e" />
      <Box position={[-0.5,0.36,0]} size={[0.8,0.02,0.5]} color="#0f3460" />
      <Cylinder position={[0.65,0.35,0.2]} args={[0.06,0.06,0.04,8]} color="#00aa44" />
      {[-0.9,-0.7].map((x,i) => (
        <Box key={i} position={[x,0.2,0.46]} size={[0.14,0.1,0.04]} color="#0a0a1a" />
      ))}
    </group>
  )
}

function Racket({ position, rotation=[0,0,0] }) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder position={[0,-0.7,0]} args={[0.04,0.05,1.0,6]} color="#8B4513" />
      <Cylinder position={[0,0.1,0]}  args={[0.025,0.025,0.7,6]} color="#aaa" />
      <Cylinder position={[0,0.65,0]} args={[0.38,0.38,0.04,16,1,true]} color="#cc4400" />
      {[-0.22,-0.11,0,0.11,0.22].map((x,i) => (
        <Box key={`sv-${i}`} position={[x,0.65,0]} size={[0.015,0.68,0.01]} color="#ddd" />
      ))}
      {[-0.2,-0.1,0,0.1,0.2].map((y,i) => (
        <Box key={`sh-${i}`} position={[0,0.65+y,0]} size={[0.68,0.015,0.01]} color="#ddd" />
      ))}
    </group>
  )
}

export function SignPost({ position, text, color, rotation=0 }) {
  return (
    <group position={position}>
      <Box position={[0,1.2,0]} size={[0.1,2.4,0.1]} color="#8B6914" />
      <group rotation={[0,rotation,0]}>
        <Box position={[0,2.2,0.15]} size={[1.8,0.5,0.12]} color={color} />
        <Box position={[0,2.2,0.21]} size={[1.7,0.4,0.02]}
          color={color} emissive={color} emissiveIntensity={0.2} />
        <Text position={[0,2.2,0.28]} fontSize={0.22} color="#fff"
          anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          {text}
        </Text>
      </group>
      <Box position={[0,0.08,0]} size={[0.3,0.16,0.3]} color="#6B5035" />
    </group>
  )
}

export default function ZoneDecorations() {
  return (
    <group>
      {/* ── CLOUD ZONE [0, 0, -55] ──────────────────────────────────── */}
      <group position={[0, 0.6, -55]}>
        <ServerRack position={[-9, 0, -5]} />
        <ServerRack position={[-9, 0,  0]} />
        <ServerRack position={[-9, 0,  5]} />
        <ServerRack position={[ 9, 0, -5]} />
        <ServerRack position={[ 9, 0,  0]} />
        <TerraformBlock position={[4, 0, 8]} />
        <TerraformBlock position={[6, 0, 8]} />
        <TerraformBlock position={[5, 0, 6]} />
        <Crate position={[ 3,1,-3]} color="#ddd0b8" />
        <Crate position={[ 4,1,-2]} color="#ccbba8" />
        <Crate position={[-4,1, 3]} color="#d5c8b2" />
        <Crate position={[-3,1, 4]} color="#c8bba2" />
      </group>

      {/* ── PROJECTS ZONE [55, 0, 0] ─────────────────────────────────── */}
      <group position={[55, 0.6, 0]}>
        {/* 3D billboard with embedded slideshow */}
        <ProjectBillboard position={[0, 0, -6]} />
        <DockerStack position={[-8, 0, -4]} />
        <DockerStack position={[-8, 0,  4]} />
        <DockerStack position={[ 8, 0,  0]} />
        <Crate position={[4,1, 5]} size={[1.2,1.2,1.2]} color="#0db7ed" />
        <Crate position={[5,1, 3]} size={[0.9,0.9,0.9]} color="#2496ed" />
        <Crate position={[3,1,-5]} size={[1.1,1.1,1.1]} color="#0db7ed" />
      </group>

      {/* ── HOBBIES ZONE [-55, 0, 0] ─────────────────────────────────── */}
      <group position={[-55, 0.6, 0]}>
        <HeavyBag position={[-4, 0, -4]} />
        <HeavyBag position={[ 4, 0,  4]} />
        <PS2      position={[ 0, 0,  6]} />
        <Racket   position={[-6, 1.2, 0]} rotation={[0,0.3,0.8]} />
        <Racket   position={[ 6, 1.2, 2]} rotation={[0,-0.4,0.9]} />
        <Crate position={[ 5,1,-5]} size={[1.4,1.4,1.4]} color="#cc2200" />
        <Crate position={[-5,1, 5]} size={[1.2,1.2,1.2]} color="#cc2200" />
        <Crate position={[ 0,1,-7]} size={[1.0,1.0,1.0]} color="#444" />
      </group>
    </group>
  )
}