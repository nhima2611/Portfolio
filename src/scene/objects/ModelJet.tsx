import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../config';
import { createJet } from '../geometry';
import { hoverAmount } from '../hover';
import { atJetStop, interactive, launchJetWithSound, scrollToSection } from '../interaction';
import { jetFlight, sceneState } from '../state';

const POS: [number, number, number] = [1.35, 1.86, -0.38];
const REST = new THREE.Euler(0.12, -0.9, 0.18);

/** A lap above the desk: lift off the shelf, circle the room's right half (clear of the text panel), settle back on the stand. Stays off the back wall (z > -0.5). */
const FLIGHT_PATH = new THREE.CatmullRomCurve3(
  [
    POS,
    [1.3, 1.95, -0.22],
    [1.0, 2.04, 0.35],
    [0.45, 2.08, 0.72],
    [-0.15, 2.02, 0.5],
    [-0.3, 1.98, 0.0],
    [0.2, 2.03, -0.3],
    [0.9, 1.98, -0.34],
    [1.3, 1.9, -0.39],
    POS,
  ].map((p) => new THREE.Vector3(...p)),
  false,
  'centripetal',
);

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/**
 * Display model on the top shelf.
 * To use a licensed GLB instead: add @react-three/drei, then
 *   const { scene } = useGLTF('/models/jet.glb'); <primitive object={scene} />
 */
export function ModelJet() {
  const { jet, skin } = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: '#7a8494', roughness: 0.5, metalness: 0.4, flatShading: true, side: THREE.DoubleSide, emissive: COLORS.lamp, emissiveIntensity: 0 });
    const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3f', roughness: 0.15, metalness: 0.9 });
    const g = createJet(skin, glass);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return { jet: g, skin };
  }, []);

  useEffect(
    () => () =>
      jet.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      }),
    [jet],
  );

  const pivot = useRef<THREE.Group>(null);
  const tmp = useMemo(
    () => ({ rest: new THREE.Quaternion(), fly: new THREE.Quaternion(), look: new THREE.Object3D(), a: new THREE.Vector3(), b: new THREE.Vector3(), euler: new THREE.Euler() }),
    [],
  );

  useFrame(({ clock }) => {
    const p = pivot.current;
    if (!p) return;
    skin.emissiveIntensity = 0.18 * hoverAmount('jet');
    const sway = sceneState.reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.3) * 0.05;
    tmp.euler.set(REST.x, REST.y + sway, REST.z);
    tmp.rest.setFromEuler(tmp.euler);

    const t = jetFlight();
    if (t === null) {
      p.position.set(...POS);
      p.quaternion.copy(tmp.rest);
      return;
    }

    // Position along the lap, nose along the tangent, banked into the turn.
    const u = easeInOutSine(t);
    FLIGHT_PATH.getPointAt(u, p.position);
    FLIGHT_PATH.getTangentAt(u, tmp.a);
    FLIGHT_PATH.getTangentAt(Math.min(1, u + 0.02), tmp.b);
    const turn = tmp.a.x * tmp.b.z - tmp.a.z * tmp.b.x;
    tmp.look.position.copy(p.position);
    tmp.look.lookAt(tmp.b.copy(p.position).sub(tmp.a)); // +z faces away from travel, so the nose (-z) leads
    tmp.look.rotateZ(THREE.MathUtils.clamp(turn * 18, -0.75, 0.75));
    tmp.fly.copy(tmp.look.quaternion);

    // Blend from and back to the display pose at either end.
    const blend = smoothstep(0, 0.08, t) * (1 - smoothstep(0.9, 1, t));
    p.quaternion.copy(tmp.rest).slerp(tmp.fly, blend);
  });

  return (
    <group>
      <group ref={pivot} position={POS} rotation={REST} scale={0.045}>
        <primitive object={jet} />
      </group>
      {/* Stand */}
      <mesh position={[POS[0], 1.797, POS[2]]}>
        <boxGeometry args={[0.004, 0.09, 0.004]} />
        <meshStandardMaterial color="#2a2e38" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[POS[0], 1.755, POS[2]]} castShadow>
        <boxGeometry args={[0.07, 0.006, 0.05]} />
        <meshStandardMaterial color="#2a2e38" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Generous invisible hit area so the small model is easy to click */}
      <mesh position={POS} {...interactive('jet', () => (atJetStop() ? launchJetWithSound() : scrollToSection('off-duty')))}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
