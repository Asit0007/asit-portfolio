import { useRef } from 'react'
import { Physics } from '@react-three/rapier'
import useGameStore from '../store/useGameStore'
import Lights          from './Lights'
import World           from './World'
import Trees           from './Trees'
import Vehicle         from './Vehicle'
import Zones           from './Zones'
import SkyBox          from './Sky'
import NameTitle       from './NameTitle'
import ZoneDecorations from './ZoneDecorations'
import SignPosts       from './SignPosts'
import AudioManager    from './AudioManager'
import ContactZone     from './ContactZone'

export default function Scene() {
  const vehicleRef = useRef()
  const joystick   = useGameStore((s) => s.joystick)

  return (
    <Physics gravity={[0, -20, 0]}>
      <SkyBox />
      <Lights />
      <World />
      <Trees />
      <NameTitle />
      <ZoneDecorations />
      <SignPosts />
      <ContactZone />
      <Vehicle ref={vehicleRef} joystick={joystick} />
      <Zones vehicleRef={vehicleRef} />
      <AudioManager />
      <fog attach="fog" args={['#f0a050', 120, 300]} />
    </Physics>
  )
}