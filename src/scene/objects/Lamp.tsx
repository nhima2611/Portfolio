import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS, DESK_TOP, LIGHTS } from '../config';
import { introElapsed, introPower } from '../state';

const BULB: [number, number, number] = [-0.505, 1.215, -0.18];
const METAL = { color: '#2b2f3a', roughness: 0.4, metalness: 0.6 } as const;

/** Desk lamp: the key light of the scene, and the star of the intro flicker. */
export function Lamp() {
  const spot = useRef<THREE.SpotLight>(null);
  const glow = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshBasicMaterial>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const on = useMemo(() => new THREE.Color(COLORS.lamp), []);
  const off = useMemo(() => new THREE.Color(COLORS.lampOff), []);

  useEffect(() => {
    target.position.set(-0.05, DESK_TOP, 0.1);
    target.updateMatrixWorld();
    if (spot.current) spot.current.target = target;
  }, [target]);

  useFrame(() => {
    const { lamp } = introPower(introElapsed());
    if (spot.current) spot.current.intensity = LIGHTS.spot * lamp;
    if (glow.current) glow.current.intensity = LIGHTS.lampGlow * lamp;
    bulb.current?.color.copy(off).lerp(on, lamp);
  });

  return (
    <group>
      <mesh position={[-0.78, DESK_TOP + 0.01, -0.2]} castShadow>
        <boxGeometry args={[0.14, 0.02, 0.14]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[-0.78, 0.99, -0.2]} rotation-z={-0.25} castShadow>
        <boxGeometry args={[0.018, 0.42, 0.018]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[-0.66, 1.25, -0.2]} rotation-z={-1.1} castShadow>
        <boxGeometry args={[0.018, 0.3, 0.018]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[-0.52, 1.25, -0.18]} rotation-z={0.6} castShadow>
        <coneGeometry args={[0.075, 0.12, 20, 1, true]} />
        <meshStandardMaterial {...METAL} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={BULB}>
        <sphereGeometry args={[0.022, 12, 8]} />
        <meshBasicMaterial ref={bulb} color={COLORS.lampOff} toneMapped={false} />
      </mesh>

      <primitive object={target} />
      <spotLight
        ref={spot}
        position={BULB}
        color={COLORS.lamp}
        intensity={0}
        distance={3.5}
        angle={0.95}
        penumbra={0.65}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
      />
      <pointLight ref={glow} position={BULB} color={COLORS.lamp} intensity={0} distance={2.2} decay={2} />
    </group>
  );
}
