// Single fixed sun, folio-style: direction never changes, so a static light
// gives identical shading everywhere on the map. No shadow maps — depth-map
// passes cost too much on this scene; depth cues come from warm fills,
// vertex-colored geometry, fog, and the blob contact shadows in
// GroundShadows.jsx (DESIGN.md §6).

// Exported so GroundShadows.jsx can derive which way every blob leans from
// the same vector the light actually uses. Moving the sun here moves every
// contact shadow in the world with it; hardcoding the direction in both
// places is how they silently drift apart.
export const SUN_POSITION = [40, 60, -60]

export default function Lights() {
  return (
    <>
      {/* Warm fills keep unlit areas amber, never gray (DESIGN.md §6).
          Ambient used to sit at 0.85 with the hemisphere at 0.7 — 1.55 of
          flat fill against a 2.2 key, which washed the terminator out
          almost completely and was the main reason solid shapes read as
          flat colour regions. Fill is now 0.87 total and the key carries
          2.9, so surfaces facing the sun land at essentially the same
          brightness as before (~3.8) while faces turned away actually fall
          off. Net exposure is unchanged; only the contrast moved. */}
      <ambientLight intensity={0.42} color="#ffe5b4" />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.9}
        color="#ffcc88"
      />
      {/* Cool bounce, nudged up slightly to catch the shadow side that the
          ambient cut just opened up — it keeps unlit faces reading as
          sky-lit rather than muddy. */}
      <directionalLight
        position={[-30, 20, 40]}
        intensity={0.5}
        color="#aaccff"
      />
      <hemisphereLight
        skyColor="#ffe0a0"
        groundColor="#c8640a"
        intensity={0.45}
      />
    </>
  )
}
