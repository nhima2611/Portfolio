import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DESK_TOP } from '../config';
import { sceneState } from '../state';
import { useSoftDot } from '../useCanvasTexture';

const PUFFS = 10;

export function Mug() {
  const dot = useSoftDot();
  const puffs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    puffs.current.forEach((s, i) => {
      if (!s) return;
      const seed = i / PUFFS;
      const u = sceneState.reducedMotion ? seed : (seed + t * 0.18) % 1;
      s.position.set(Math.sin(u * 9 + seed * 20) * 0.012, 0.11 + u * 0.22, Math.cos(u * 7) * 0.008);
      const size = 0.03 + u * 0.07;
      s.scale.set(size, size, 1);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(u * Math.PI) * 0.22;
    });
  });

  return (
    <group position={[0.72, DESK_TOP, 0.12]}>
      <mesh position-y={0.05} castShadow receiveShadow>
        <cylinderGeometry args={[0.042, 0.038, 0.1, 18]} />
        <meshStandardMaterial color="#d9d4c8" roughness={0.5} />
      </mesh>
      <mesh position={[0.045, 0.05, 0]} castShadow>
        <torusGeometry args={[0.025, 0.007, 8, 16]} />
        <meshStandardMaterial color="#d9d4c8" roughness={0.5} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.092}>
        <circleGeometry args={[0.037, 18]} />
        <meshStandardMaterial color="#3b2416" roughness={0.3} />
      </mesh>
      {Array.from({ length: PUFFS }, (_, i) => (
        <sprite key={i} ref={(el) => (puffs.current[i] = el)}>
          <spriteMaterial map={dot} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
}
