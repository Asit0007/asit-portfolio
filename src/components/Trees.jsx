import { useRef, useMemo } from 'react'
import * as THREE from 'three'

const TREE_COUNT = 100

function randomTreePositions() {
  const positions = []
  const zoneCenters = [[0,-55],[55,0],[-55,0],[0,0]]
  let attempts = 0
  while (positions.length < TREE_COUNT && attempts < 3000) {
    attempts++
    const angle  = Math.random() * Math.PI * 2
    const radius = 22 + Math.random() * 72
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue
    if (zoneCenters.some(([zx, zz]) =>
      Math.abs(x - zx) < 20 && Math.abs(z - zz) < 20)) continue
    positions.push({
      x, z,
      scale: 0.7 + Math.random() * 0.9,
    })
  }
  return positions
}

export default function Trees() {
  const trunkRef  = useRef()
  const leavesRef = useRef()
  const trees     = useMemo(() => randomTreePositions(), [])

  useMemo(() => {
    if (!trunkRef.current || !leavesRef.current) return
    const dummy = new THREE.Object3D()
    trees.forEach(({ x, z, scale }, i) => {
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
  }, [trees])

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[null, null, TREE_COUNT]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 1.8, 5]} />
        <meshStandardMaterial color="#8B5E3C" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[null, null, TREE_COUNT]} castShadow>
        <coneGeometry args={[1.3, 2.6, 6]} />
        <meshStandardMaterial color="#5a8f3c" roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  )
}