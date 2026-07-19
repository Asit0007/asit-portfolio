export default function Lights() {
  return (
    <>
      <ambientLight intensity={1.0} color="#ffe5b4" />
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
