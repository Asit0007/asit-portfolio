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
import Circuit            from './Circuit'
import Bowling            from './Bowling'
import Whispers           from './Whispers'
import VisitorBillboard   from './VisitorBillboard'

export default function Scene({ tierCfg }) {
  const vehicleRef = useRef()
  const joystick   = useGameStore((s) => s.joystick)
  const fogFar     = tierCfg.fog

  // The world used to step a full physics simulation behind the opaque start
  // screen (162 draw calls, 35k tris) during the exact seconds the rapier
  // chunk and the GLBs were still streaming in. That's now handled by the
  // Canvas's frameloop="demand" in App.jsx — <Physics> steps inside R3F's
  // frame loop, so no frames means no stepping. Do NOT also pass rapier's
  // `paused` prop: it's redundant with that, and pausing the world at mount
  // leaves the raycast vehicle controller un-initialised, so the car never
  // moves again even after unpausing (verified — 0 units travelled).
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
      <Circuit vehicleRef={vehicleRef} />
      <Bowling vehicleRef={vehicleRef} />
      <Whispers vehicleRef={vehicleRef} />
      <VisitorBillboard />
      <AudioManager />
      <DevStats />
      <fog attach="fog" args={['#f0a050', fogFar * 0.4, fogFar]} />
    </Physics>
  )
}