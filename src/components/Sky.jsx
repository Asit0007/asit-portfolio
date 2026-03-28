import { Sky as DreiSky } from '@react-three/drei'

export default function SkyBox() {
  return (
    <DreiSky
      distance={450}
      sunPosition={[40, 8, -60]}
      inclination={0.52}
      azimuth={0.28}
      turbidity={12}
      rayleigh={1.2}
      mieCoefficient={0.008}
      mieDirectionalG={0.85}
    />
  )
}