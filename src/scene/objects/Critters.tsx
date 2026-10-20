import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { blip } from '../../lib/sound';
import { COLORS, DESK_TOP } from '../config';
import { hoverAmount } from '../hover';
import { interactive } from '../interaction';
import { sceneState, type HoverTarget } from '../state';
import { say } from '../terminal';

/** A material whose emissive glow follows the hover level of `target`. */
function useHoverMaterial(target: HoverTarget, params: THREE.MeshStandardMaterialParameters, strength = 0.25) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ ...params, emissive: COLORS.lamp, emissiveIntensity: 0 }), [params]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    mat.emissiveIntensity = strength * hoverAmount(target);
  });
  return mat;
}

/** 0 … 1 … 0 over `len` seconds after `start` (ms), or 0 when idle. */
function pulse(start: number, len: number): number {
  const t = (performance.now() - start) / 1000 / len;
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0;
}

/* ---------- Rubber duck: click for a quack and some debugging advice ---------- */

const DUCK_TIPS = [
  'explain it to the duck, line by line',
  'the duck suggests: read the error message',
  'the duck asks: what changed since it worked?',
  'the duck has seen this before. check the cache',
];
const DUCK_PARAMS = { color: '#f2c230', roughness: 0.35 };

export function Duck() {
  const body = useHoverMaterial('duck', DUCK_PARAMS);
  const root = useRef<THREE.Group>(null);
  const squeezed = useRef(-Infinity);
  const tip = useRef(0);

  useFrame(() => {
    if (!root.current) return;
    const s = sceneState.reducedMotion ? 0 : pulse(squeezed.current, 0.35);
    root.current.scale.set(1 + s * 0.15, 1 - s * 0.25, 1 + s * 0.15);
  });

  const onClick = () => {
    squeezed.current = performance.now();
    blip('quack');
    say([['#f2c230', '🦆 quack.'], ['#9aa0ad', DUCK_TIPS[tip.current++ % DUCK_TIPS.length]]]);
  };

  return (
    <group position={[-0.17, DESK_TOP, -0.15]} rotation-y={0.55}>
      <group ref={root}>
        <mesh position-y={0.022} scale={[0.03, 0.022, 0.038]} material={body} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
        <mesh position={[0, 0.05, 0.016]} material={body} castShadow>
          <sphereGeometry args={[0.018, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.032, -0.036]} rotation-x={-0.9} material={body}>
          <coneGeometry args={[0.012, 0.022, 8]} />
        </mesh>
        <mesh position={[0, 0.046, 0.035]} rotation-x={Math.PI / 2} scale={[1, 1, 0.45]}>
          <coneGeometry args={[0.009, 0.018, 10]} />
          <meshStandardMaterial color="#e8742c" roughness={0.4} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.0085, 0.056, 0.03]}>
            <sphereGeometry args={[0.0028, 8, 6]} />
            <meshStandardMaterial color="#111318" roughness={0.2} />
          </mesh>
        ))}
      </group>
      <mesh position-y={0.03} {...interactive('duck', onClick)}>
        <boxGeometry args={[0.08, 0.07, 0.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/* ---------- Cat asleep on the top shelf: breathes, flicks its tail, purrs when petted ---------- */

const FUR = { color: '#c9834a', roughness: 0.9 };
const SHELF_TOP = 1.7525;

export function Cat() {
  const fur = useHoverMaterial('cat', FUR, 0.18);
  const body = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const petted = useRef(-Infinity);

  useFrame(({ clock }) => {
    const reduce = sceneState.reducedMotion;
    const t = clock.elapsedTime;
    if (body.current) body.current.scale.y = 0.045 * (1 + (reduce ? 0 : 0.04 * Math.sin(t * 1.6)));
    const lift = reduce ? 0 : pulse(petted.current, 1.8);
    if (head.current) {
      head.current.rotation.x = -0.45 * lift;
      head.current.rotation.z = 0.15 * lift * Math.sin(t * 9);
    }
    if (tail.current) tail.current.rotation.y = reduce ? 0 : 0.12 * Math.sin(t * 0.8) + 0.25 * lift * Math.sin(t * 6);
  });

  const onClick = () => {
    petted.current = performance.now();
    blip('purr');
    say([['#c9834a', 'purrr…'], ['#9aa0ad', 'the cat approves of your code review']]);
  };

  return (
    <group position={[1.67, SHELF_TOP, -0.39]} rotation-y={-0.35}>
      <mesh ref={body} position-y={0.04} scale={[0.075, 0.045, 0.058]} material={fur} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>

      <group ref={head} position={[-0.058, 0.05, 0.03]}>
        <mesh material={fur} castShadow>
          <sphereGeometry args={[0.032, 16, 12]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.016, 0.027, -0.004]} rotation-z={-side * 0.35} material={fur}>
            <coneGeometry args={[0.011, 0.024, 4]} />
          </mesh>
        ))}
        {/* Closed eyes and nose */}
        {[-1, 1].map((side) => (
          <mesh key={`eye${side}`} position={[side * 0.012, 0.004, 0.029]} rotation-z={side * 0.15}>
            <boxGeometry args={[0.009, 0.0016, 0.002]} />
            <meshBasicMaterial color="#2a1c14" />
          </mesh>
        ))}
        <mesh position={[0, -0.007, 0.031]}>
          <sphereGeometry args={[0.0035, 8, 6]} />
          <meshStandardMaterial color="#d47a7a" roughness={0.5} />
        </mesh>
      </group>

      {/* Tail curled around the front of the body */}
      <group ref={tail} position-y={0.014}>
        <mesh rotation-x={-Math.PI / 2} rotation-z={-0.4} material={fur} castShadow>
          <torusGeometry args={[0.068, 0.011, 8, 24, Math.PI * 1.1]} />
        </mesh>
      </group>

      <mesh position-y={0.05} {...interactive('cat', onClick)}>
        <boxGeometry args={[0.2, 0.11, 0.15]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
