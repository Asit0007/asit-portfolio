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

// Hoisted out of the JSX so GroundShadows.jsx can read where the posts
// stand without the two files keeping separate copies of the coordinates.
// All four now stand on the white centre platform (World.jsx's 18x18
// ZonePad at the origin, so x/z within +-9) instead of being planted in
// open sand or, in two cases, in the middle of a road lane. One sign per
// quadrant at +-6.4 keeps every post clear of both road arms (half-width
// 4) with room to spare, and the arrows still point the way they always
// did — the quadrant each sign sits in is the one adjacent to its zone.
//
// y = 0.02 is the platform's top face (ZonePad centre -0.58 + half-height
// 0.6), so the plinths rest ON the white slab rather than sinking into it.
const PLATFORM_Y = 0.02
const SIGN_INSET = 6.4

const SIGNS = [
  // North → Cloud & Infra (NE quadrant)
  { position: [SIGN_INSET, PLATFORM_Y, -SIGN_INSET], text: 'CLOUD & INFRA', color: '#c47a0a', rotationY: Math.PI / 2 },
  // East → Projects (SE quadrant)
  { position: [SIGN_INSET, PLATFORM_Y, SIGN_INSET], text: 'PROJECTS', color: '#0a7a4a', rotationY: 0 },
  // West → Easter Egg (NW quadrant)
  { position: [-SIGN_INSET, PLATFORM_Y, -SIGN_INSET], text: 'EASTER EGG', color: '#7a25b7', rotationY: 0, pointLeft: true },
  // South → Contact (SW quadrant)
  { position: [-SIGN_INSET, PLATFORM_Y, SIGN_INSET], text: 'CONTACT', color: '#c4154a', rotationY: Math.PI / 2, pointLeft: true },
]

export const SIGN_POSITIONS = SIGNS.map((s) => s.position)

export default function SignPosts() {
  return (
    <group>
      {SIGNS.map((sign, i) => (
        <ArrowSign key={i} {...sign} />
      ))}
    </group>
  )
}
