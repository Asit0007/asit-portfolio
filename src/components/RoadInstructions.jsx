import { Suspense } from 'react'
import { Text3D, Center } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

// ── Instructions, painted on the road and loose on it ─────────────────────
// These used to lie on the sand just off the crossroads, where white text on
// orange sand is close to the worst contrast this palette can produce — they
// washed out at any distance. On the asphalt they read instantly, which is
// what road markings have always been for.
//
// And they are DYNAMIC bodies, not decals. The world's first lesson is
// "HIT THE LETTERS"; it would be strange for the sentence teaching you to
// drive to be the one thing in the world bolted down. Drive through them and
// they scatter like the name does.
//
// One body per WORD rather than per letter. Per letter would read better as
// wreckage but "USE ARROW KEYS TO EXPLORE" alone is 21 letters, and the name
// already spends 8 dynamic bodies; whole words keep it to nine for the same
// effect at a glance.

const LINE_1 = ['USE', 'ARROW', 'KEYS', 'TO', 'EXPLORE']
const LINE_2 = ['R RESET', 'M MUTE', 'TAB MAP', 'SHIFT BOOST']

// Laid along the east arm of the crossroads, which is the one stretch of
// asphalt in frame from the spawn camera that isn't already carrying the
// name letters. Two lanes, one line each, sized so both lines finish inside
// the frame the visitor sees the moment they arrive — instructions they
// have to drive off to finish reading are not instructions.
const START_X = 4
const LINE_1_Z = -1.7
const LINE_2_Z = 1.7
const SIZE_1 = 0.55
const SIZE_2 = 0.42
// Advance per character, as a fraction of `size`. Deliberately GENEROUS.
// Text3D builds its glyphs asynchronously from a loaded font, so there is
// no width to measure at layout time and this has to be an estimate — and
// the two failure directions are not symmetric. Too wide merely spreads the
// line out; too narrow overlaps the words, and since these are dynamic
// bodies, overlapping means the solver shoves them apart the instant the
// world loads and the sentence throws itself across the road. A first pass
// at 0.62 did exactly that.
const CHAR_W  = 0.82
const GAP     = 1.1
// Even a one-character word gets a slot wide enough to keep its collider
// clear of its neighbour's.
const MIN_SLOT = 1.6

function layout(words, size, z) {
  let x = START_X
  return words.map((text) => {
    const w = Math.max(MIN_SLOT, text.length * size * CHAR_W)
    const at = [x + w / 2, 0.16, z]
    x += w + GAP
    return { text, position: at }
  })
}

function Word({ text, position, size }) {
  return (
    <RigidBody
      type="dynamic"
      position={position}
      // Lying face-up on the road. Rotating the BODY rather than the mesh
      // keeps the auto-generated box collider flat with the text instead of
      // standing it on edge.
      rotation={[-Math.PI / 2, 0, 0]}
      colliders="cuboid"
      // Light and heavily damped: a word should skate when the car catches
      // it and then stop, not slide off across the desert. Same reasoning as
      // the crates in World.jsx, where the damping reads as weight more than
      // the mass does.
      mass={0.25}
      linearDamping={0.7}
      angularDamping={0.85}
      restitution={0.1}
      friction={0.9}
    >
      <Center>
        <Text3D
          font="/fonts/helvetiker_bold.typeface.json"
          size={size}
          height={0.16}
          curveSegments={3}
          bevelEnabled={false}
        >
          {text}
          {/* Slightly emissive so it still reads once the sun is off it —
              same treatment the old ground text used (DESIGN.md §3/§6). */}
          <meshStandardMaterial
            color="#fff4e0"
            emissive="#fff4e0"
            emissiveIntensity={0.28}
            roughness={0.5}
            metalness={0.05}
          />
        </Text3D>
      </Center>
    </RigidBody>
  )
}

export default function RoadInstructions() {
  return (
    <Suspense fallback={null}>
      <group>
        {layout(LINE_1, SIZE_1, LINE_1_Z).map((w) => (
          <Word key={w.text} {...w} size={SIZE_1} />
        ))}
        {layout(LINE_2, SIZE_2, LINE_2_Z).map((w) => (
          <Word key={w.text} {...w} size={SIZE_2} />
        ))}
      </group>
    </Suspense>
  )
}
