import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createJet } from '../geometry';
import { linkTo } from '../interaction';
import { sceneState } from '../state';

const POS: [number, number, number] = [1.35, 1.86, -0.38];

/**
 * Display model on the top shelf.
 * To use a licensed GLB instead: add @react-three/drei, then
 *   const { scene } = useGLTF('/models/jet.glb'); <primitive object={scene} />
 */
export function ModelJet() {
  const jet = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: '#7a8494', roughness: 0.5, metalness: 0.4, flatShading: true, side: THREE.DoubleSide });
    const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3f', roughness: 0.15, metalness: 0.9 });
    const g = createJet(skin, glass);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return g;
  }, []);

  useEffect(
    () => () =>
      jet.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      }),
    [jet],
  );

  const pivot = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!pivot.current || sceneState.reducedMotion) return;
    pivot.current.rotation.y = -0.9 + Math.sin(clock.elapsedTime * 0.3) * 0.05;
  });

  return (
    <group>
      <group ref={pivot} position={POS} rotation={[0.12, -0.9, 0.18]} scale={0.045}>
        <primitive object={jet} />
      </group>
      {/* Stand */}
      <mesh position={[POS[0], 1.797, POS[2]]}>
        <boxGeometry args={[0.004, 0.09, 0.004]} />
        <meshStandardMaterial color="#2a2e38" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[POS[0], 1.755, POS[2]]} castShadow>
        <boxGeometry args={[0.07, 0.006, 0.05]} />
        <meshStandardMaterial color="#2a2e38" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Generous invisible hit area so the small model is easy to click */}
      <mesh position={POS} {...linkTo('off-duty')}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
