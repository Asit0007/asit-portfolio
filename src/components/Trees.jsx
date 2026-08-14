import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { isNearTrack } from '../data/track'

const TREE_COUNT = 100

function randomTreePositions() {
  const zoneCenters = [[0,-55],[55,0],[-55,0],[0,55],[0,0]]
  const positions = []
  let attempts = 0
  while (positions.length < TREE_COUNT && attempts < 3000) {
    attempts++
    const angle  = Math.random() * Math.PI * 2
    const radius = 22 + Math.random() * 72
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue
    if (zoneCenters.some(([zx,zz]) =>
      Math.abs(x-zx) < 20 && Math.abs(z-zz) < 20)) continue
    if (isNearTrack(x, z, 6)) continue
    positions.push({ x, z, scale: 0.7 + Math.random() * 0.9 })
  }
  return positions
}

// Frozen at module load — positions are stable across renders
const TREES = randomTreePositions()

export default function Trees({ maxTrees = TREE_COUNT }) {
  const trunkRef  = useRef()
  const leavesRef = useRef()
  const visibleTrees = TREES.slice(0, maxTrees)
  const count = visibleTrees.length

  useEffect(() => {
    if (!trunkRef.current || !leavesRef.current) return
    const dummy = new THREE.Object3D()
    visibleTrees.forEach(({ x, z, scale }, i) => {
      dummy.position.set(x, scale * 0.9, z)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunkRef.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(x, scale * 2.5, z)
      dummy.scale.set(scale * 1.5, scale * 1.5, scale * 1.5)
      dummy.updateMatrix()
      leavesRef.current.setMatrixAt(i, dummy.matrix)
    })
    trunkRef.current.instanceMatrix.needsUpdate  = true
    leavesRef.current.instanceMatrix.needsUpdate = true

    trunkRef.current.geometry.boundingSphere  = new THREE.Sphere(new THREE.Vector3(0,0,0), 200)
    leavesRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), 200)
  }, [count])

  return (
    <group>
      {/* Visual trunks */}
      <instancedMesh
        key={`trunk-${count}`}
        ref={trunkRef}
        args={[null, null, count]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.18, 0.28, 1.8, 5]} />
        <meshStandardMaterial color="#8B5E3C" roughness={1} flatShading />
      </instancedMesh>

      {/* Visual canopy */}
      <instancedMesh
        key={`leaves-${count}`}
        ref={leavesRef}
        args={[null, null, count]}
        frustumCulled={false}
      >
        <coneGeometry args={[1.3, 2.6, 6]} />
        <meshStandardMaterial color="#5a8f3c" roughness={0.85} flatShading />
      </instancedMesh>

      {/* Physics trunks — one static cuboid collider per tree, all on a
          single fixed body. Trees never move, so this needs no per-frame
          transform sync (unlike InstancedRigidBodies, which is built for
          instances whose positions change and costs a JS↔WASM readback
          every frame for each instance even when nothing moves). */}
      <RigidBody type="fixed" colliders={false}>
        {visibleTrees.map(({ x, z }, i) => (
          <CuboidCollider key={i} args={[0.35, 1.75, 0.35]} position={[x, 1.75, z]} />
        ))}
      </RigidBody>
    </group>
  )
}
