import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hcmClock } from '../../lib/date';
import { sceneState } from '../state';

const CENTER: [number, number, number] = [-1.05, 1.55, -0.497];
const W = 0.8;
const H = 0.85;
const FRAME = '#2a2e38';

/** 0 = deep night … 1 = full day, from the real time in Ho Chi Minh City. */
function daylight(hours: number): number {
  if (hours < 5 || hours >= 19.5) return 0;
  if (hours < 6.5) return (hours - 5) / 1.5;
  if (hours < 17.5) return 1;
  return 1 - (hours - 17.5) / 2;
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Out-of-focus skyline: sky gradient, tower silhouettes, lit windows. Seeded so it never reshuffles. */
function drawCity(ctx: CanvasRenderingContext2D, size: number, day: number) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, rgb(mix([10, 14, 30], [96, 140, 196], day)));
  sky.addColorStop(0.7, rgb(mix([38, 32, 58], [196, 186, 172], day)));
  sky.addColorStop(1, rgb(mix([70, 44, 52], [214, 196, 170], day)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  ctx.filter = 'blur(3px)';
  for (const layer of [0, 1]) {
    const base = size * (layer ? 0.98 : 0.86);
    const tone = mix(layer ? [16, 18, 30] : [28, 30, 48], layer ? [72, 80, 96] : [118, 124, 138], day);
    let x = -10;
    while (x < size) {
      const w = 30 + rand() * 60;
      const h = size * (0.25 + rand() * (layer ? 0.45 : 0.35));
      ctx.fillStyle = rgb(tone);
      ctx.fillRect(x, base - h, w, h + 40);
      // Lit windows: most at night, a few during the day.
      const lit = 0.55 - day * 0.45;
      for (let wy = base - h + 8; wy < base - 6; wy += 11) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          if (rand() > lit) continue;
          ctx.fillStyle = rand() > 0.3 ? `rgba(255,${190 + rand() * 40},${120 + rand() * 60},${0.85 - day * 0.5})` : `rgba(170,210,255,${0.7 - day * 0.4})`;
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
      x += w + rand() * 8;
    }
  }

  // Bokeh from street lights, strongest at night.
  ctx.filter = 'blur(6px)';
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,170,90,${0.5 * (1 - day)})` : `rgba(255,90,90,${0.35 * (1 - day)})`;
    ctx.beginPath();
    ctx.arc(rand() * size, size * (0.82 + rand() * 0.18), 6 + rand() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Rain on glass: drops slide down in columns, refracting the city behind; trails leave a faint streak. */
const fragmentShader = /* glsl */ `
  uniform sampler2D city;
  uniform float time;
  uniform float brightness;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 drops(vec2 uv, float t, vec2 grid, float speed) {
    vec2 st = uv * grid;
    float col = floor(st.x);
    float n = hash(vec2(col, grid.x));
    st.y += t * speed * (0.6 + n) + n * 10.0;
    vec2 id = floor(st);
    vec2 f = fract(st) - 0.5;
    float m = hash(id + grid);
    if (m < 0.45) return vec3(0.0);
    vec2 p = f - vec2((m - 0.5) * 0.5, 0.0);
    float drop = smoothstep(0.22, 0.12, length(p * vec2(1.0, 0.7)));
    float trail = smoothstep(0.05, 0.0, abs(p.x)) * smoothstep(0.0, 0.5, p.y) * 0.35;
    return vec3(p * drop, max(drop, trail));
  }

  void main() {
    vec3 a = drops(vUv, time, vec2(18.0, 7.0), 0.55);
    vec3 b = drops(vUv + 0.37, time, vec2(30.0, 12.0), 0.8);
    vec2 offset = (a.xy + b.xy * 0.6) * 0.06;
    vec3 base = texture2D(city, vUv + offset).rgb;
    float wet = max(a.z, b.z * 0.7);
    vec3 color = base * (0.8 + wet * 0.45);
    // Condensation haze toward the bottom of the pane.
    color = mix(color, vec3(0.35, 0.4, 0.5) * dot(base, vec3(0.33)), (1.0 - vUv.y) * 0.25);
    gl_FragColor = vec4(color * brightness, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Window on the back wall: rainy Ho Chi Minh City outside, following the real time of day. */
export function CityWindow() {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const uniforms = useMemo(() => ({ city: { value: texture }, time: { value: 0 }, brightness: { value: 0.8 } }), [texture]);
  const light = useRef<THREE.PointLight>(null);
  const day = useRef(-1);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    // Redraw the skyline only when the light outside changes noticeably.
    const d = Math.round(daylight(hcmClock().hours) * 20) / 20;
    if (d !== day.current) {
      day.current = d;
      drawCity(canvas.getContext('2d')!, 512, d);
      texture.needsUpdate = true;
      uniforms.brightness.value = 0.7 + d * 0.35;
    }
    if (!sceneState.reducedMotion) uniforms.time.value = clock.elapsedTime;
    if (light.current) light.current.intensity = 0.25 + d * 0.9;
  });

  const bar = (x: number, y: number, w: number, h: number, key: string) => (
    <mesh key={key} position={[CENTER[0] + x, CENTER[1] + y, CENTER[2] + 0.012]} castShadow>
      <boxGeometry args={[w, h, 0.03]} />
      <meshStandardMaterial color={FRAME} roughness={0.6} metalness={0.3} />
    </mesh>
  );

  return (
    <group>
      <mesh position={CENTER}>
        <planeGeometry args={[W, H]} />
        <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} toneMapped={false} />
      </mesh>
      {bar(0, H / 2, W + 0.05, 0.035, 'top')}
      {bar(0, -H / 2, W + 0.05, 0.035, 'bottom')}
      {bar(-W / 2, 0, 0.035, H, 'left')}
      {bar(W / 2, 0, 0.035, H, 'right')}
      {bar(0, 0, 0.02, H, 'mullion')}
      {bar(0, 0.08, W, 0.02, 'transom')}
      {/* Sill */}
      <mesh position={[CENTER[0], CENTER[1] - H / 2 - 0.02, CENTER[2] + 0.04]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.12, 0.025, 0.09]} />
        <meshStandardMaterial color="#3a3f4c" roughness={0.7} />
      </mesh>
      <pointLight ref={light} position={[CENTER[0], CENTER[1], CENTER[2] + 0.35]} color="#8fb0e8" intensity={0.25} distance={1.6} decay={2} />
    </group>
  );
}
