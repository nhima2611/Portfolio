import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
 * Su-57 Felon by bohmerang (Sketchfab), CC BY-NC-SA 4.0, optimised with gltf-transform (meshopt, WebP 1024px).
 * Credited in the page footer. The low-poly jet below stands in while it loads.
 */
const MODEL_URL = '/models/su57.glb';
const extendLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};
useLoader.preload(GLTFLoader, MODEL_URL, extendLoader);

/** Nose-to-tail length on the shelf, in metres. */
const LENGTH = 0.27;
/** Extra yaw that turns the GLB's nose to -z (the direction the flight code treats as forward). */
const NOSE_YAW = 0;

/** Highlights a model's materials while the jet is hovered. */
function useHoverGlow(materials: THREE.MeshStandardMaterial[], strength: number) {
  useFrame(() => {
    const h = strength * hoverAmount('jet');
    for (const m of materials) m.emissiveIntensity = h;
  });
}

function Su57() {
  const gltf = useLoader(GLTFLoader, MODEL_URL, extendLoader);
  const { model, materials, gearDown, gearUp } = useMemo(() => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    // Lay the fuselage along z, scale it to shelf size, then point the nose to -z.
    const along = new THREE.Group();
    along.add(root);
    if (size.x > size.z) along.rotation.y = Math.PI / 2;
    const model = new THREE.Group();
    model.add(along);
    model.scale.setScalar(LENGTH / Math.max(size.x, size.z));
    model.rotation.y = NOSE_YAW;

    const materials = new Set<THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.isMeshStandardMaterial && !m.emissiveMap) {
        m.emissive.set(COLORS.lamp);
        m.emissiveIntensity = 0;
        materials.add(m);
      }
    });
    // The model ships both gear states: down (with lights) for the shelf, up (closed doors) for flight.
    const gearDown: THREE.Object3D[] = [];
    const gearUp: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o.name.startsWith('SU57-landingOff')) gearUp.push(o);
      else if (o.name.startsWith('SU57-landingOn')) gearDown.push(o);
    });
    return { model, materials: [...materials], gearDown, gearUp };
  }, [gltf]);

  useHoverGlow(materials, 0.12);
  useFrame(() => {
    const t = jetFlight();
    const up = t !== null && t > 0.06 && t < 0.92;
    for (const o of gearUp) o.visible = up;
    for (const o of gearDown) o.visible = !up;
  });
  return <primitive object={model} />;
}

/** Original low-poly twin-engine jet: the fallback while the GLB loads (≈ 6 units long, so scaled down here). */
function LowPolyJet() {
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

  useHoverGlow(useMemo(() => [skin], [skin]), 0.18);
  return <primitive object={jet} scale={LENGTH / 6} />;
}

/** Display model on the top shelf; it also flies a lap of the room on request. */
export function ModelJet() {
  const pivot = useRef<THREE.Group>(null);
  const tmp = useMemo(
    () => ({ rest: new THREE.Quaternion(), fly: new THREE.Quaternion(), look: new THREE.Object3D(), a: new THREE.Vector3(), b: new THREE.Vector3(), euler: new THREE.Euler() }),
    [],
  );

  useFrame(({ clock }) => {
    const p = pivot.current;
    if (!p) return;
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
      <group ref={pivot} position={POS} rotation={REST}>
        <Suspense fallback={<LowPolyJet />}>
          <Su57 />
        </Suspense>
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
