import { useRef, Suspense } from 'react'
import { Physics } from '@react-three/rapier'
import useGameStore from '../store/useGameStore'
import Lights            from './Lights'
import World             from './World'
import Trees             from './Trees'
import Vehicle           from './Vehicle'
import Zones             from './Zones'
import SkyBox            from './Sky'
import NameTitle         from './NameTitle'
import ZoneDecorations   from './ZoneDecorations'
import SignPosts          from './SignPosts'
import AudioManager      from './AudioManager'
import ContactZone       from './ContactZone'
import EnvironmentModels from './EnvironmentModels'
import DevStats           from './DevStats'

export default function Scene({ tierCfg }) {
  const vehicleRef = useRef()
  const joystick   = useGameStore((s) => s.joystick)
  const fogFar     = tierCfg.fog

  return (
    <Physics gravity={[0, -20, 0]} timeStep={tierCfg.physicsStep}>
      <SkyBox />
      <Lights />
      <World />
      <Trees maxTrees={tierCfg.maxTrees} />
      <Suspense fallback={null}>
        <EnvironmentModels maxProps={tierCfg.maxProps} />
      </Suspense>
      <NameTitle />
      <ZoneDecorations />
      <SignPosts />
      <ContactZone />
      <Vehicle ref={vehicleRef} joystick={joystick} />
      <Zones vehicleRef={vehicleRef} />
      <AudioManager />
      <DevStats />
      <fog attach="fog" args={['#f0a050', fogFar * 0.4, fogFar]} />
    </Physics>
  )
}