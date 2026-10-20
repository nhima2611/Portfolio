import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DESK_TOP } from '../config';
import { createSlab } from '../geometry';
import { linkTo } from '../interaction';
import { drawTerminal } from '../screens';
import { introElapsed, introPower, sceneState } from '../state';
import { useBlink, useCanvasTexture } from '../useCanvasTexture';

const ALU = { color: '#4a4e57', roughness: 0.35, metalness: 0.75 } as const;

/** Original laptop design: dark aluminium body, instanced keyboard, terminal on screen. */
export function Laptop() {
  const base = useMemo(() => createSlab(0.34, 0.24, 0.011, 0.014), []);
  const lid = useMemo(() => {
    const g = createSlab(0.34, 0.23, 0.005, 0.014);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.115, -0.006);
    return g;
  }, []);

  const cursor = useRef(true);
  const { texture, redraw } = useCanvasTexture(768, 512, (ctx, w, h) => drawTerminal(ctx, w, h, cursor.current));
  const blink = useBlink(600, () => {
    cursor.current = blink.current;
    redraw();
  }, !sceneState.reducedMotion);

  const screen = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    screen.current?.color.setScalar(introPower(introElapsed()).laptop);
  });

  return (
    <group position={[-0.45, DESK_TOP + 0.001, 0.05]} rotation-y={0.18}>
      <mesh geometry={base} castShadow receiveShadow>
        <meshStandardMaterial {...ALU} />
      </mesh>
      <Keyboard />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0112, 0.062]} receiveShadow>
        <planeGeometry args={[0.13, 0.075]} />
        <meshStandardMaterial color="#575b65" roughness={0.25} metalness={0.6} />
      </mesh>

      <group position={[0, 0.012, -0.118]} rotation-x={-0.28}>
        <mesh geometry={lid} castShadow>
          <meshStandardMaterial {...ALU} />
        </mesh>
        <mesh position={[0, 0.115, 0.0002]}>
          <planeGeometry args={[0.332, 0.222]} />
          <meshStandardMaterial color="#050608" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.118, 0.0006]} {...linkTo('about')}>
          <planeGeometry args={[0.318, 0.207]} />
          <meshBasicMaterial ref={screen} map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

const COLS = 13;
const ROWS = 5;
const SPACE_FROM = 4;
const SPACE_TO = 8;

function Keyboard() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = COLS * ROWS - (SPACE_TO - SPACE_FROM + 1) + 1;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === ROWS - 1 && c >= SPACE_FROM && c <= SPACE_TO) continue;
        d.position.set(-0.12 + c * 0.02, 0.0118, -0.098 + r * 0.0195);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        mesh.setMatrixAt(i++, d.matrix);
      }
    }
    d.position.set(0, 0.0118, -0.098 + (ROWS - 1) * 0.0195);
    d.scale.set(5.5, 1, 1);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
      <boxGeometry args={[0.0175, 0.0018, 0.0165]} />
      <meshStandardMaterial color="#111318" roughness={0.6} />
    </instancedMesh>
  );
}
