import { Sky as DreiSky } from '@react-three/drei'
import useDayNightCycle from '../hooks/useDayNightCycle'

export default function SkyBox() {
  const { skybox } = useDayNightCycle()

  return (
    <DreiSky
      distance={450}
      sunPosition={skybox.sunPosition}
      inclination={0.52}
      azimuth={0.28}
      turbidity={skybox.turbidity}
      rayleigh={skybox.rayleigh}
      mieCoefficient={0.008}
      mieDirectionalG={0.85}
    />
  )
}
