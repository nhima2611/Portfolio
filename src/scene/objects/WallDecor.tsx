import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hcmClock } from '../../lib/date';
import { hoverAmount } from '../hover';
import { linkTo } from '../interaction';
import { sceneState } from '../state';
import { useCanvasTexture } from '../useCanvasTexture';

const WALL_Z = -0.5;
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISPLAY = '"Familjen Grotesk", system-ui, sans-serif';

/* ---------- Wall clock: real Ho Chi Minh City time ---------- */

const CLOCK: [number, number, number] = [-0.4, 1.72, WALL_Z + 0.012];
const R = 0.1;

function drawFace(ctx: CanvasRenderingContext2D, W: number) {
  const c = W / 2;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#e9e4d8';
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r0 = c * (major ? 0.8 : 0.87);
    ctx.strokeStyle = major ? '#1c1f27' : '#8a8578';
    ctx.lineWidth = major ? 7 : 2.5;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
    ctx.lineTo(c + Math.sin(a) * c * 0.93, c - Math.cos(a) * c * 0.93);
    ctx.stroke();
  }
  ctx.fillStyle = '#1c1f27';
  ctx.font = `600 22px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('HCMC', c, c + c * 0.42);
}

function Hand({ length, width, color, angle }: { length: number; width: number; color: string; angle: RefObject<THREE.Group> }) {
  return (
    <group ref={angle}>
      <mesh position={[0, length / 2 - 0.012, 0]}>
        <boxGeometry args={[width, length, 0.003]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function WallClock() {
  const { texture } = useCanvasTexture(256, 256, drawFace);
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const second = useRef<THREE.Group>(null);

  useFrame(() => {
    const { hours, minutes, seconds } = hcmClock();
    const reduce = sceneState.reducedMotion;
    if (hour.current) hour.current.rotation.z = -((hours % 12) / 12) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(minutes / 60) * Math.PI * 2;
    if (second.current) {
      second.current.visible = !reduce;
      second.current.rotation.z = -(Math.floor(seconds) / 60) * Math.PI * 2;
    }
  });

  return (
    <group position={CLOCK}>
      <mesh>
        <circleGeometry args={[R, 48]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
      <mesh>
        <torusGeometry args={[R, 0.008, 8, 48]} />
        <meshStandardMaterial color="#1c1f27" roughness={0.4} metalness={0.5} />
      </mesh>
      <group position-z={0.004}>
        <Hand angle={hour} length={0.055} width={0.007} color="#1c1f27" />
        <Hand angle={minute} length={0.08} width={0.0045} color="#1c1f27" />
        <Hand angle={second} length={0.085} width={0.0018} color="#e0603f" />
      </group>
    </group>
  );
}

/* ---------- Su-57 blueprint poster: links to Off duty ---------- */

const POSTER: [number, number, number] = [0.15, 1.68, WALL_Z + 0.006];
const PW = 0.52;
const PH = 0.34;

/** Half outline of the Su-57 seen from above: x from nose (0) to tail (1), y from the centre line. Stylised, not to scale. */
const HALF: [number, number][] = [
  [0, 0], [0.07, 0.02], [0.18, 0.045], [0.3, 0.065], [0.42, 0.14], [0.5, 0.2], [0.65, 0.42], [0.73, 0.43],
  [0.71, 0.2], [0.77, 0.17], [0.86, 0.3], [0.94, 0.31], [0.92, 0.12], [1, 0.1], [1, 0],
];

function drawBlueprint(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#1b3a66';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(180,210,255,.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,240,255,.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  // Jet, nose to the right.
  const len = W * 0.62;
  const ox = W * 0.16;
  const oy = H * 0.5;
  const span = len * 0.72;
  const pt = ([x, y]: [number, number], side: number) => [ox + (1 - x) * len, oy + side * y * span] as const;
  ctx.beginPath();
  HALF.forEach((p, i) => (i ? ctx.lineTo(...pt(p, -1)) : ctx.moveTo(...pt(p, -1))));
  [...HALF].reverse().forEach((p) => ctx.lineTo(...pt(p, 1)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(230,240,255,.07)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox - 20, oy);
  ctx.lineTo(ox + len + 20, oy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dimension line under the jet.
  const dy = oy + span * 0.5 + 34;
  ctx.beginPath();
  ctx.moveTo(ox, dy);
  ctx.lineTo(ox + len, dy);
  ctx.moveTo(ox, dy - 8);
  ctx.lineTo(ox, dy + 8);
  ctx.moveTo(ox + len, dy - 8);
  ctx.lineTo(ox + len, dy + 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,240,255,.9)';
  ctx.font = `400 18px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('≈ 20 m', ox + len / 2, dy - 10);

  ctx.textAlign = 'left';
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillText('SU-57  FELON', 40, 64);
  ctx.font = `400 16px ${MONO}`;
  ctx.fillText('TOP VIEW · STYLISED · NOT TO SCALE', 40, 90);
  ctx.textAlign = 'right';
  ctx.fillText('SHEET 01/01   nhi@desk', W - 40, H - 38);
}

export function Poster() {
  const { texture } = useCanvasTexture(1024, 670, drawBlueprint);
  const paper = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (paper.current) paper.current.emissiveIntensity = 0.12 + 0.25 * hoverAmount('off-duty');
  });
  return (
    <group position={POSTER} {...linkTo('off-duty')}>
      <mesh position-z={-0.002}>
        <boxGeometry args={[PW + 0.03, PH + 0.03, 0.008]} />
        <meshStandardMaterial color="#14161c" roughness={0.5} />
      </mesh>
      <mesh position-z={0.003}>
        <planeGeometry args={[PW, PH]} />
        <meshStandardMaterial ref={paper} map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.12} roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ---------- Sticky notes on the monitor bezel ---------- */

const NOTES = [
  { text: ['ship it', '✓'], color: '#f5d76e', pos: [0.465, 1.19, -0.255], rot: -0.09 },
  { text: ['micro', 'frontends'], color: '#f49ac1', pos: [-0.165, 0.935, -0.2552], rot: 0.12 },
] as const;

function Note({ text, color, pos, rot }: (typeof NOTES)[number]) {
  const draw = useMemo(
    () => (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(0, 0, W, H * 0.16);
      ctx.fillStyle = '#2a2420';
      ctx.font = `700 30px ${DISPLAY}`;
      ctx.textAlign = 'center';
      text.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.48 + i * 34));
    },
    [text, color],
  );
  const { texture } = useCanvasTexture(160, 160, draw);
  useEffect(() => {
    texture.anisotropy = 8;
  }, [texture]);
  return (
    <mesh position={pos as unknown as [number, number, number]} rotation-z={rot}>
      <planeGeometry args={[0.06, 0.06]} />
      <meshStandardMaterial map={texture} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function StickyNotes() {
  return (
    <>
      {NOTES.map((n) => (
        <Note key={n.text.join()} {...n} />
      ))}
    </>
  );
}
