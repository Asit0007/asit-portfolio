import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import useGameStore from '../store/useGameStore'
import { triggerShake } from '../utils/cameraShake'
import { playExplosion } from '../audio'

// ── Explosive crates ──────────────────────────────────────────────────────
// Straight from folio-2025's ExplosiveCrates.js, with two deliberate
// departures.
//
// FIXED, not dynamic. folio's crates are dynamic bodies that start asleep,
// which costs nothing until touched and lets you shove them around. Ours
// don't need shoving — this world already has sixteen dynamic crates for
// that (World.jsx ScatterProps) — and staying fixed means the visual can be
// one InstancedMesh with no per-frame matrix sync at all. A barrel you
// detonate rather than a box you nudge.
//
// They COME BACK. folio has a global "reset objects" control; we have none,
// so a crate blown up would be gone for the rest of the visit and the toy
// would be single-use. They re-arm after a few seconds instead.
//
// The hide-by-moving trick is folio's: rather than rebuilding the instanced
// mesh, a spent crate's instance is pushed far under the ground, which
// costs one matrix write.
//
// Cost: one instanced draw call for every crate, eight static cuboid
// colliders on one shared fixed body, and at most a couple of transient
// meshes while something is actually exploding.

const CRATE_SIZE   = 1.5
const RESPAWN_MS   = 7000
const BURIED_Y     = -50    // where a spent crate's instance parks
// Below this the car is parked or crawling, and nudging a crate at walking
// pace should not set it off — same reasoning as the boulder jolt's speed
// gate in EnvironmentModels.
const ARM_SPEED    = 4

// On the shoulders of the four road spokes, where they're seen at speed and
// hitting one is a small deliberate swerve, plus one out in the open desert.
// Every position is checked against the zone plazas, the name letters, the
// ramps and the racing circuit.
const CRATES = [
  { x:  -7, z: -80 },
  { x:  -7, z:  30 },
  { x:   7, z:  80 },
  { x:  30, z:  -7 },
  { x:  80, z:   7 },
  { x: -30, z:   7 },
  { x: -80, z:  -7 },
  { x:  55, z: -45 },   // shoulder of the new SE diagonal, not its centreline
]

// ── The box itself ────────────────────────────────────────────────────────
// A shipping crate, built as boards and a frame rather than painted onto a
// cube, and baked into ONE merged vertex-coloured geometry — the same
// technique as the track, the ramps and the bowling lane (DESIGN.md §8.6).
// Because the mesh is instanced, that geometry is uploaded once and every
// crate in the world is still a single draw call; all this costs is ~340
// triangles, once.
//
// Real boards, not a texture, for two reasons. There is no crate texture in
// `public/` and adding one would be the ninth texture and a download for a
// prop the size of a wheel. And the lighting here would not show it anyway:
// with no shadow maps, a flat face reads as one block of colour whatever is
// printed on it — what makes wood read as wood at speed is the STEP between
// a proud board and the shadowed groove beside it, which is geometry.
//
// The tones are also deliberately kept dark. This scene puts ~2.8x on every
// surface (see the note in EndlessDesert.jsx), so a bright wood would pin
// its red channel and the board-to-board variation — the whole point of the
// jitter below — would clip away to one flat brown.
// Spread wider than they look on paper. A first pass kept these within about
// 0.1 of each other in luminance and the boards read as one moulded block —
// measured on the crate's lit face, the whole box spanned 11 luma levels.
// Timber that has been in this sun is not that even.
const WOOD_TONES = ['#8a5a30', '#986739', '#6b4220', '#7f5129']
const WOOD_FRAME = '#5a371c'   // corner posts and rails, a shade under the boards
const WOOD_CORE  = '#33200f'   // the box behind the boards, seen only in the gaps

const BOARD_PROUD = 0.055      // how far a board stands off the core
const FRAME_PROUD = 0.12       // ...and the frame off the boards
const BOARDS      = 3          // per face
const BOARD_GAP   = 0.05
const RAIL_H      = 0.18

// Deterministic, so every crate in the world has the same grain and a crate
// that respawns is the crate that was there before.
function toneFor(i) {
  const h = Math.imul(i + 1, 2654435761) >>> 0
  return WOOD_TONES[h % WOOD_TONES.length]
}

function coloured(geo, hex) {
  const c = new THREE.Color(hex)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

function buildCrateGeometry() {
  const S    = CRATE_SIZE
  const half = S / 2
  const core = S - BOARD_PROUD * 2          // the carcass the boards sit on
  const ch   = core / 2
  const parts = []

  const box = (sx, sy, sz, x, y, z, hex) => {
    const g = new THREE.BoxGeometry(sx, sy, sz)
    g.translate(x, y, z)
    parts.push(coloured(g, hex))
  }

  // Carcass. Dark, and only ever visible down the grooves between boards,
  // which is exactly what sells the boards as separate pieces of timber.
  box(core, core, core, 0, 0, 0, WOOD_CORE)

  // Side boards — horizontal, running around all four faces. Each one gets
  // its own tone so no two neighbours are the same plank.
  const bh = (S - BOARD_GAP * (BOARDS - 1)) / BOARDS
  let tone = 0
  for (let b = 0; b < BOARDS; b++) {
    const y = -half + bh / 2 + b * (bh + BOARD_GAP)
    const at = ch + BOARD_PROUD / 2
    box(BOARD_PROUD, bh, core,  at, y, 0, toneFor(tone++))
    box(BOARD_PROUD, bh, core, -at, y, 0, toneFor(tone++))
    box(core, bh, BOARD_PROUD, 0, y,  at, toneFor(tone++))
    box(core, bh, BOARD_PROUD, 0, y, -at, toneFor(tone++))
  }

  // Lid boards, running the other way — a crate's top is nailed across its
  // sides, and the change of direction is most of what reads as "lid".
  const lw = (core - BOARD_GAP * (BOARDS - 1)) / BOARDS
  for (let b = 0; b < BOARDS; b++) {
    const z = -ch + lw / 2 + b * (lw + BOARD_GAP)
    box(core, BOARD_PROUD, lw, 0, ch + BOARD_PROUD / 2, z, toneFor(tone++))
  }

  // Frame: four corner posts and a rail top and bottom of every face. This
  // is the part that reads at distance — the silhouette stops being a cube
  // and becomes a braced box, and the board ends get capped instead of
  // running off the edge.
  const pw = 0.24
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    box(pw, S, pw, sx * ch, 0, sz * ch, WOOD_FRAME)

  for (const sy of [-1, 1]) {
    const y = sy * (half - RAIL_H / 2)
    box(FRAME_PROUD, RAIL_H, core,  ch, y, 0, WOOD_FRAME)
    box(FRAME_PROUD, RAIL_H, core, -ch, y, 0, WOOD_FRAME)
    box(core, RAIL_H, FRAME_PROUD, 0, y,  ch, WOOD_FRAME)
    box(core, RAIL_H, FRAME_PROUD, 0, y, -ch, WOOD_FRAME)
  }

  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

// ── The kick ──────────────────────────────────────────────────────────────
// A blast you can hear and see but cannot feel is a decal. The car has to
// leave the ground.
//
// The impulse is flat inside a core radius and falls off to nothing by the
// outer one, rather than a 1/d^2 that spikes to infinity at the centre. The
// car is always about 3.2 units from the crate when this fires — its own
// half-length plus the crate's — so the core has to reach past that or the
// hit the visitor actually causes is the weakest one the curve can give.
//
// The two magnitudes are VELOCITY CHANGES, in units per second, multiplied
// up by the body's own mass at the moment of the blast. Writing impulses
// directly here would have been a trap: CHASSIS_MASS in Vehicle.jsx reads
// 2, but that is an *additional* mass on top of what Rapier derives from
// the collider, and the chassis actually weighs 5.67 — measured off the
// live body, not read off the constant. Impulses tuned against the 2 landed
// at a third of their intended strength, and would have drifted again the
// next time a collider changed. A velocity is a number you can picture: 9
// u/s upward under this world's -20 gravity is about 0.9 s of air and a
// 2-unit apex.
//
// PUNCH is deliberately the smaller of the two — the car drives INTO the
// crate, so an outward shove points back down the road it came from, and a
// big one just stops the car dead. Lifting it and letting it keep most of
// its momentum reads as "blown up and over" rather than "hit a wall".
const BLAST_CORE     = 3.6
const BLAST_REACH    = 9
const BLAST_LIFT_DV  = 9
const BLAST_PUNCH_DV = 6
// Angular impulse, which cannot get the same treatment: Rapier exposes the
// mass but not the effective inertia, and Vehicle.jsx's is deliberately
// anisotropic (pitch 14 against yaw 2.6 and roll 1.2) so one number could
// not describe it anyway. These are measured instead — enough to tip the
// car while it flies, and landing it back on its wheels.
const BLAST_PITCH  = 7
const BLAST_YAW    = 2

function blastFalloff(d) {
  if (d <= BLAST_CORE) return 1
  if (d >= BLAST_REACH) return 0
  const t = 1 - (d - BLAST_CORE) / (BLAST_REACH - BLAST_CORE)
  return t * t * (3 - 2 * t)
}

// `i` only seeds the spin direction, so a given crate always throws the car
// the same way — a detonation is a physics event, not a dice roll, and a
// visitor who comes back to the same crate should get the same stunt.
function kickCar(body, cx, cz, i) {
  const p = body.translation()
  const dx = p.x - cx, dz = p.z - cz
  const d = Math.hypot(dx, dz)
  const f = blastFalloff(d)
  if (f <= 0) return 0

  // Outward in the plane. d is never 0 in practice — the colliders touch
  // long before the centres meet — but a fallback costs nothing.
  const nx = d > 0.001 ? dx / d : 0
  const nz = d > 0.001 ? dz / d : 1

  const m = body.mass()
  body.applyImpulse({
    x: nx * BLAST_PUNCH_DV * m * f,
    y: BLAST_LIFT_DV * m * f,
    z: nz * BLAST_PUNCH_DV * m * f,
  }, true)

  // Pitch about the horizontal axis across the blast direction, so the end
  // nearest the crate is the end that lifts — the car is being picked up by
  // the side the explosion is on, not spun on the spot.
  const spin = (i % 2 ? 1 : -1)
  body.applyTorqueImpulse({
    x: nz * BLAST_PITCH * f,
    y: spin * BLAST_YAW * f,
    z: -nx * BLAST_PITCH * f,
  }, true)

  return f
}

// ── The blast ─────────────────────────────────────────────────────────────
// folio's fireball is a TSL node material on the WebGPU renderer — three
// layers of procedural noise, discarded through a moving threshold. None of
// that ports to our WebGL/MeshStandard scene without writing the shader
// from scratch, so this is the honest cheap version of the same idea: a
// low-poly sphere that punches outward and fades, lit by nothing (emissive
// + toneMapped false) so it blows out against the sand exactly like the
// headlamp lenses do.
const BLAST_LIFE  = 0.62   // seconds
const BLAST_MAX_R = 4.2

function Blast({ position, onDone }) {
  const ref   = useRef()
  // Stamped on the first frame rather than at render: reading the clock
  // during render is impure, and a re-render would restart the animation.
  const start = useRef(0)

  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (!start.current) start.current = performance.now()
    const t = (performance.now() - start.current) / (BLAST_LIFE * 1000)
    if (t >= 1) { onDone(); return }
    // Fast out, slow settle — an explosion's edge decelerates hard.
    const r = BLAST_MAX_R * (1 - Math.pow(1 - t, 3))
    m.scale.setScalar(Math.max(r, 0.001))
    m.material.opacity = (1 - t) * 0.9
    // Orange core cooling to deep red as it expands.
    m.material.color.setRGB(1, 0.55 - t * 0.35, 0.12 - t * 0.1)
  })

  return (
    <mesh ref={ref} position={position} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} depthWrite={false} flatShading />
    </mesh>
  )
}

export default function ExplosiveCrates() {
  const meshRef = useRef()
  // Which crates are currently blown. In state because the colliders read it
  // during render, and mirrored into a ref because the collision handler runs
  // outside React and a stale closure would let one crate detonate twice.
  const [spent, setSpent] = useState(() => CRATES.map(() => false))
  const spentRef = useRef(spent)
  const [blasts, setBlasts] = useState([])
  const nextId  = useRef(0)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Built once for every crate in the world — instancing shares it.
  const crateGeometry = useMemo(() => buildCrateGeometry(), [])
  useEffect(() => () => crateGeometry.dispose(), [crateGeometry])

  const place = useCallback((i, buried) => {
    const mesh = meshRef.current
    if (!mesh) return
    const c = CRATES[i]
    dummy.position.set(c.x, buried ? BURIED_Y : CRATE_SIZE / 2, c.z)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }, [dummy])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    CRATES.forEach((_, i) => place(i, false))
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200)
  }, [place])

  const setSpentAt = useCallback((i, v) => {
    setSpent((prev) => {
      const next = prev.slice()
      next[i] = v
      spentRef.current = next
      return next
    })
  }, [])

  const detonate = useCallback((i) => {
    if (spentRef.current[i]) return
    const body = useGameStore.getState().vehicleBody
    if (body) {
      const lv = body.linvel()
      if (Math.hypot(lv.x, lv.z) < ARM_SPEED) return
    }
    setSpentAt(i, true)
    place(i, true)

    const c = CRATES[i]
    playExplosion()
    const f = body ? kickCar(body, c.x, c.z, i) : 0
    // A discrete hit, which is exactly what the camera's impulse channel is
    // for (cameraShake.js) — unlike gravel, this should kick the frame. The
    // hardest shake in the game (a bowling strike is 0.3), and scaled by the
    // SAME falloff as the impulse, all the way to zero: the camera rides the
    // car, so a crate that goes off too far away to move the car has no
    // business moving the shot either. onCollisionEnter fires for whatever
    // touches the crate, not only the car, so that case is reachable.
    triggerShake(0.45 * f, 380)
    setBlasts((b) => [...b, { id: nextId.current++, position: [c.x, CRATE_SIZE / 2, c.z] }])

    setTimeout(() => {
      setSpentAt(i, false)
      place(i, false)
    }, RESPAWN_MS)
  }, [place, setSpentAt])

  const clearBlast = useCallback((id) => {
    setBlasts((b) => b.filter((x) => x.id !== id))
  }, [])

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[crateGeometry, undefined, CRATES.length]}
        frustumCulled={false}
      >
        {/* Colour comes from the baked vertex attribute, not from `color`.
            Dry timber: high roughness, no metalness (DESIGN.md §2). */}
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} flatShading />
      </instancedMesh>

      {/* One fixed body for all of them — no rigid body per crate, nothing
          to sync (same rule as the boulders and the gravel). A spent crate's
          collider is disabled rather than removed, so the set never has to
          be rebuilt. */}
      <RigidBody type="fixed" colliders={false}>
        {CRATES.map((c, i) => (
          <CuboidCollider
            key={i}
            args={[CRATE_SIZE / 2, CRATE_SIZE / 2, CRATE_SIZE / 2]}
            position={[c.x, CRATE_SIZE / 2, c.z]}
            sensor={spent[i]}
            onCollisionEnter={() => detonate(i)}
          />
        ))}
      </RigidBody>

      {blasts.map((b) => (
        <Blast key={b.id} position={b.position} onDone={() => clearBlast(b.id)} />
      ))}
    </group>
  )
}
