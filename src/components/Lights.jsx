// Single fixed sun, folio-style: direction never changes, so a static light
// gives identical shading everywhere on the map. No shadow maps — depth-map
// passes cost too much on this scene; depth cues come from warm fills,
// vertex-colored geometry, and fog instead (DESIGN.md §6).
export default function Lights() {
  return (
    <>
      {/* Warm fills keep unlit areas amber, never gray (DESIGN.md §6) */}
      <ambientLight intensity={0.85} color="#ffe5b4" />
      <directionalLight
        position={[40, 60, -60]}
        intensity={2.2}
        color="#ffcc88"
      />
      <directionalLight
        position={[-30, 20, 40]}
        intensity={0.45}
        color="#aaccff"
      />
      <hemisphereLight
        skyColor="#ffe0a0"
        groundColor="#c8640a"
        intensity={0.7}
      />
    </>
  )
}
