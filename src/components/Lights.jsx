import useGameStore from '../store/useGameStore'

export default function Lights() {
  const isMobile = useGameStore((s) => s.isMobile)

  return (
    <>
      <ambientLight intensity={0.9} color="#ffe5b4" />
      <directionalLight
        castShadow={!isMobile}
        position={[40, 60, -60]}
        intensity={2.2}
        color="#ffcc88"
        shadow-mapSize={isMobile ? [512, 512] : [2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-30, 20, 40]}
        intensity={0.5}
        color="#aaccff"
      />
      <hemisphereLight
        skyColor="#ffe0a0"
        groundColor="#c8640a"
        intensity={0.6}
      />
    </>
  )
}