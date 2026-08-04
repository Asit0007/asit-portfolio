import useDayNightCycle from '../hooks/useDayNightCycle'

export default function Lights() {
  const { ambient, sun, fill, hemi } = useDayNightCycle()

  return (
    <>
      <ambientLight intensity={ambient.intensity} color={ambient.color} />
      <directionalLight
        position={[40, 60, -60]}
        intensity={sun.intensity}
        color={sun.color}
      />
      <directionalLight
        position={[-30, 20, 40]}
        intensity={fill.intensity}
        color={fill.color}
      />
      <hemisphereLight
        skyColor={hemi.sky}
        groundColor={hemi.ground}
        intensity={hemi.intensity}
      />
    </>
  )
}
