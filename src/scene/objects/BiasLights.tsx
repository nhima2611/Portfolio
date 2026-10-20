import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../config';
import { introElapsed, introPower } from '../state';

/** Soft glow texture: an ellipse that is brightest at `cy` (0 … 1 down the canvas) and fades out. */
function useGlowTexture(cy: number) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.translate(128, cy * 128);
    g.scale(2, 1);
    const grd = g.createRadialGradient(0, 0, 4, 0, 0, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(-64, -128, 128, 256);
    return new THREE.CanvasTexture(c);
  }, [cy]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Glow({ position, size, color, map, power, strength }: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  map: THREE.Texture;
  power: (e: number) => number;
  strength: number;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.opacity = strength * power(introElapsed());
  });
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={mat} map={map} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

const SHELVES = [1.38, 1.74];

/** LED bias lighting: a cool halo on the wall behind the monitor and warm strips under each shelf. */
export function BiasLights() {
  const halo = useGlowTexture(0.5);
  const wash = useGlowTexture(0.05);
  const monitor = (e: number) => introPower(e).monitor;
  const shelf = (e: number) => introPower(e).shelf;

  return (
    <group>
      <Glow position={[0.15, 1.08, -0.495]} size={[1.2, 0.8]} color={COLORS.screen} map={halo} power={monitor} strength={0.5} />
      {SHELVES.map((y) => (
        <group key={y}>
          <Glow position={[1.35, y - 0.14, -0.496]} size={[1.0, 0.3]} color="#ffbe7d" map={wash} power={shelf} strength={0.45} />
          <mesh position={[1.35, y - 0.0135, -0.3]}>
            <boxGeometry args={[0.84, 0.003, 0.006]} />
            <meshBasicMaterial color="#ffd2a1" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
