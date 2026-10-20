import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { DESK_TOP } from '../config';
import { linkTo } from '../interaction';
import { hoverAmount } from '../hover';
import { drawEditor, editorLength } from '../screens';
import { introElapsed, introPower, sceneState } from '../state';
import { useBlink, useCanvasTexture } from '../useCanvasTexture';

const STOP = 2;
const CHARS_PER_SEC = 170;

export function Monitor() {
  const cursor = useRef(true);
  /** The editor retypes itself each time the camera arrives at the monitor. */
  const typing = useRef({ chars: Infinity, start: 0, armed: true });
  const { texture, redraw } = useCanvasTexture(1024, 600, (ctx, w, h) => drawEditor(ctx, w, h, cursor.current, typing.current.chars));
  const blink = useBlink(600, () => {
    cursor.current = blink.current;
    redraw();
  }, !sceneState.reducedMotion);

  const screen = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    screen.current?.color.setScalar(introPower(introElapsed()).monitor * (1 + 0.3 * hoverAmount('experience')));

    if (sceneState.reducedMotion) return;
    const ty = typing.current;
    const away = Math.abs(sceneState.progress - STOP);
    if (away > 1) ty.armed = true;
    const now = performance.now();
    if (away < 0.35 && ty.armed) {
      ty.armed = false;
      ty.start = now;
    }
    if (!ty.start) return;
    const chars = Math.floor(((now - ty.start) / 1000) * CHARS_PER_SEC);
    const next = chars >= editorLength() ? Infinity : chars;
    if (next === Infinity) ty.start = 0;
    if (next !== ty.chars) {
      ty.chars = next;
      redraw();
    }
  });

  return (
    <group position={[0.15, DESK_TOP, -0.27]}>
      <mesh position-y={0.006} castShadow>
        <boxGeometry args={[0.18, 0.012, 0.14]} />
        <meshStandardMaterial color="#2a2e38" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.125, -0.03]} castShadow>
        <boxGeometry args={[0.035, 0.26, 0.035]} />
        <meshStandardMaterial color="#2a2e38" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position-y={0.305} castShadow>
        <boxGeometry args={[0.66, 0.4, 0.025]} />
        <meshStandardMaterial color="#1c1f27" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.305, 0.0135]} {...linkTo('experience')}>
        <planeGeometry args={[0.63, 0.37]} />
        <meshBasicMaterial ref={screen} map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
