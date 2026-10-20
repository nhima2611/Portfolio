import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DESK_TOP } from '../config';
import { createSlab } from '../geometry';
import { hoverAmount } from '../hover';
import { linkTo } from '../interaction';
import { drawTerminal } from '../screens';
import { introElapsed, introPower, sceneState } from '../state';
import { KEY_COLS, KEY_ROWS, SPACE_FROM, SPACE_TO, keyIndex, terminal } from '../terminal';
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
  const seen = useRef(terminal.version);
  useFrame(() => {
    screen.current?.color.setScalar(introPower(introElapsed()).laptop * (1 + 0.3 * hoverAmount('about')));
    if (seen.current !== terminal.version) {
      seen.current = terminal.version;
      redraw();
    }
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

const PRESS_MS = 140;
const KEY_Y = 0.0118;
const KEY_TRAVEL = 0.0012;

/** One instance per grid cell; the space bar is the widened first cell of its run, the rest are hidden. */
function keyTransform(d: THREE.Object3D, r: number, c: number, press = 0) {
  const space = r === KEY_ROWS - 1 && c >= SPACE_FROM && c <= SPACE_TO;
  if (space && c !== SPACE_FROM) {
    d.scale.set(0, 0, 0);
  } else if (space) {
    d.position.set(-0.12 + ((SPACE_FROM + SPACE_TO) / 2) * 0.02, KEY_Y - press * KEY_TRAVEL, -0.098 + r * 0.0195);
    d.scale.set(5.5, 1, 1);
  } else {
    d.position.set(-0.12 + c * 0.02, KEY_Y - press * KEY_TRAVEL, -0.098 + r * 0.0195);
    d.scale.set(1, 1, 1);
  }
  d.updateMatrix();
}

/** Keys dip as the visitor types into the terminal (see pressKey in terminal.ts). */
function Keyboard() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let r = 0; r < KEY_ROWS; r++) {
      for (let c = 0; c < KEY_COLS; c++) {
        keyTransform(dummy, r, c);
        mesh.setMatrixAt(keyIndex(r, c), dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || terminal.pressed.size === 0) return;
    const now = performance.now();
    for (const [i, at] of terminal.pressed) {
      const age = (now - at) / PRESS_MS;
      const r = Math.floor(i / KEY_COLS);
      const c = i % KEY_COLS;
      keyTransform(dummy, r, c, age >= 1 ? 0 : Math.sin(Math.min(1, age) * Math.PI));
      mesh.setMatrixAt(i, dummy.matrix);
      if (age >= 1) terminal.pressed.delete(i);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, KEY_COLS * KEY_ROWS]} castShadow>
      <boxGeometry args={[0.0175, 0.0018, 0.0165]} />
      <meshStandardMaterial color="#111318" roughness={0.6} />
    </instancedMesh>
  );
}
