import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isSoundOn, setSound } from '../../lib/sound';
import { COLORS, DESK_TOP } from '../config';
import { createSlab } from '../geometry';
import { hoverAmount } from '../hover';
import { interactive } from '../interaction';
import { sceneState } from '../state';

/* ---------- Mechanical keyboard in front of the monitor ---------- */

const COLS = 15;
const ROWS = 5;
const PITCH = 0.0235;
const CAP = '#2b2f3a';
const ACCENTS = new Set(['0:0', '2:14', '4:14']); // Esc, Enter, arrow cluster corner

export function DeskKeyboard() {
  const base = useMemo(() => createSlab(COLS * PITCH + 0.02, ROWS * PITCH + 0.02, 0.016, 0.008), []);
  const keys = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = keys.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const space = r === ROWS - 1 && c >= 4 && c <= 9;
        if (space && c !== 4) {
          d.scale.set(0, 0, 0);
        } else {
          d.scale.set(space ? 6.1 : 1, 1, 1);
        }
        const x = (space ? 6.5 : c) * PITCH - ((COLS - 1) * PITCH) / 2;
        // Rows step up slightly toward the back, like a sculpted profile.
        d.position.set(x, 0.0175 + (ROWS - 1 - r) * 0.0008, r * PITCH - ((ROWS - 1) * PITCH) / 2);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        mesh.setColorAt(i, color.set(ACCENTS.has(`${r}:${c}`) ? COLORS.lamp : CAP));
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group position={[0.08, DESK_TOP + 0.004, 0.115]} rotation-y={0.03}>
      <mesh geometry={base} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1d24" roughness={0.5} metalness={0.4} />
      </mesh>
      <instancedMesh ref={keys} args={[undefined, undefined, COLS * ROWS]} castShadow>
        <boxGeometry args={[0.0205, 0.009, 0.0205]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
    </group>
  );
}

export function Mouse() {
  return (
    <group position={[0.355, DESK_TOP + 0.004, 0.11]} rotation-y={-0.12}>
      <mesh position-y={0.011} scale={[0.028, 0.014, 0.05]} castShadow receiveShadow>
        <sphereGeometry args={[1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#20232b" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.0255, -0.022]} rotation-x={-0.35}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.008, 10]} />
        <meshStandardMaterial color={COLORS.lamp} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------- Headphones on a stand: click to toggle the ambient sound ---------- */

const STAND: [number, number, number] = [0.64, DESK_TOP, -0.22];

export function Headphones() {
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const cushion = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3f4c', roughness: 0.95, emissive: COLORS.lamp, emissiveIntensity: 0 }), []);
  useEffect(() => () => cushion.dispose(), [cushion]);
  const off = useMemo(() => new THREE.Color('#3a2a20'), []);
  const on = useMemo(() => new THREE.Color(COLORS.lamp), []);

  useFrame(({ clock }) => {
    const pulse = isSoundOn() ? (sceneState.reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(clock.elapsedTime * 2.5)) : 0;
    led.current?.color.copy(off).lerp(on, pulse);
    cushion.emissiveIntensity = 0.3 * hoverAmount('headphones');
  });

  const metal = { color: '#2a2e38', roughness: 0.4, metalness: 0.6 } as const;
  return (
    <group position={STAND} rotation-y={0.45}>
      <mesh position-y={0.006} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.012, 24]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position-y={0.13} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.24, 10]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position-y={0.25} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
        <meshStandardMaterial {...metal} />
      </mesh>

      {/* Headband over the hook, ear cups hanging either side */}
      <group position-y={0.25}>
        <mesh position-y={-0.065} castShadow>
          <torusGeometry args={[0.078, 0.009, 10, 32, Math.PI]} />
          <meshStandardMaterial color="#1c1f27" roughness={0.6} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.078, -0.09, 0]}>
            <mesh rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.038, 0.038, 0.026, 24]} />
              <meshStandardMaterial color="#20232b" roughness={0.45} metalness={0.3} />
            </mesh>
            <mesh position-x={-side * 0.015} rotation-z={Math.PI / 2} material={cushion}>
              <cylinderGeometry args={[0.033, 0.033, 0.01, 24]} />
            </mesh>
            {side === 1 && (
              <mesh position={[0.0135, -0.018, 0.02]}>
                <sphereGeometry args={[0.0035, 8, 6]} />
                <meshBasicMaterial ref={led} color="#3a2a20" toneMapped={false} />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Hit area around the whole set */}
      <mesh position-y={0.17} {...interactive('headphones', () => setSound(!isSoundOn()))}>
        <boxGeometry args={[0.22, 0.2, 0.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
