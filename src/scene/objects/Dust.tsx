import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../config';
import { sceneState } from '../state';
import { useSoftDot } from '../useCanvasTexture';
import { BULB, LAMP_TARGET, lampPower } from './Lamp';

const COUNT = 140;
const MIN = new THREE.Vector3(-0.7, 0.8, -0.3);
const SIZE = new THREE.Vector3(0.85, 0.42, 0.6);
const COS_EDGE = Math.cos(0.75);
const COS_CORE = Math.cos(0.3);

/** Dust motes drifting through the lamp beam. Only motes inside the cone catch the light; switching the lamp off hides them. */
export function Dust() {
  const dot = useSoftDot();
  const { geometry, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const s = Float32Array.from({ length: COUNT * 4 }, Math.random);
    return { geometry: g, seeds: s };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const tmp = useMemo(() => {
    const bulb = new THREE.Vector3(...BULB);
    return { bulb, axis: new THREE.Vector3(...LAMP_TARGET).sub(bulb).normalize(), v: new THREE.Vector3(), lamp: new THREE.Color(COLORS.lamp) };
  }, []);
  const frozen = useRef(false);

  useFrame(({ clock }) => {
    const power = lampPower();
    const reduce = sceneState.reducedMotion;
    if (reduce && frozen.current && power === 1) return;
    frozen.current = true;
    const t = reduce ? 0 : clock.elapsedTime;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const col = geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const [a, b, c, d] = [seeds[i * 4], seeds[i * 4 + 1], seeds[i * 4 + 2], seeds[i * 4 + 3]];
      const x = MIN.x + a * SIZE.x + Math.sin(t * 0.21 + d * 40) * 0.025;
      const y = MIN.y + ((b + t * 0.006 * (0.5 + d)) % 1) * SIZE.y;
      const z = MIN.z + c * SIZE.z + Math.cos(t * 0.17 + a * 40) * 0.025;
      pos.setXYZ(i, x, y, z);

      tmp.v.set(x, y, z).sub(tmp.bulb);
      const dist = tmp.v.length();
      const cos = tmp.v.dot(tmp.axis) / dist;
      const inBeam = THREE.MathUtils.smoothstep(cos, COS_EDGE, COS_CORE);
      const twinkle = 0.6 + 0.4 * Math.sin(t * (0.8 + d) + a * 20);
      const k = (power * inBeam * twinkle * 0.9) / (1 + dist * 2.5);
      col.setXYZ(i, tmp.lamp.r * k, tmp.lamp.g * k, tmp.lamp.b * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial map={dot} size={0.008} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
