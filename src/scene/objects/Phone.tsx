import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { DESK_TOP } from '../config';
import { createSlab } from '../geometry';
import { linkTo } from '../interaction';
import { drawPhone } from '../screens';
import { introElapsed, introPower } from '../state';
import { useCanvasTexture } from '../useCanvasTexture';

/** Original phone design: graphite metal frame, edge-to-edge glass, live local time. */
export function Phone() {
  const body = useMemo(() => createSlab(0.072, 0.148, 0.0075, 0.011), []);
  const { texture, redraw } = useCanvasTexture(360, 740, drawPhone);

  useEffect(() => {
    const id = window.setInterval(redraw, 30_000);
    return () => window.clearInterval(id);
  }, [redraw]);

  const screen = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    screen.current?.color.setScalar(introPower(introElapsed()).phone);
  });

  return (
    <group position={[0.42, DESK_TOP + 0.004, 0.24]} rotation-y={-0.35}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshStandardMaterial color="#3d4048" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.0078} {...linkTo('contact')}>
        <planeGeometry args={[0.0705, 0.1465]} />
        <meshBasicMaterial ref={screen} map={texture} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}
