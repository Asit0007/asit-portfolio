import { SignPost } from './ZoneDecorations'

export default function SignPosts() {
  return (
    <group>
      {/* Crossroads signs — placed just outside center pad */}
      <SignPost
        position={[0, 0, -11]}
        text="☁ CLOUD & INFRA"
        color="#d4820a"
        rotation={0}
      />
      <SignPost
        position={[11, 0, 0]}
        text="⬡ PROJECTS"
        color="#0a8a5a"
        rotation={-Math.PI / 2}
      />
      <SignPost
        position={[-11, 0, 0]}
        text="✦ EASTER EGG"
        color="#7a35b7"
        rotation={Math.PI / 2}
      />
    </group>
  )
}