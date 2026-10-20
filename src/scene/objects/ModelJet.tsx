import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { blip } from '../../lib/sound';
import { COLORS } from '../config';
import { FLARE_SALVOS, MANOEUVRES, MISSILE_AT, PARKED, gearAt, sampleFlight, timeAt, within, type FlightSample } from '../flight';
import { createJet } from '../geometry';
import { hoverAmount } from '../hover';
import { atJetStop, interactive, launchJetWithSound, scrollToSection } from '../interaction';
import { FLIGHT_LEN, jetFlight, sceneState } from '../state';
import { fireFlares, fireMissile } from './FlightFX';

/** Parked at the right end of the desk runway, nose to -x, standing on its own gear (the pivot is at wheel level). */
const REST = new THREE.Euler(0, Math.PI / 2, 0);

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Up then back down over a window: 0 at the ends, 1 through the middle. */
const hump = (m: number, rise = 0.3, fall = 0.7) => smoothstep(0, rise, m) * (1 - smoothstep(fall, 1, m));

/** Seconds into the airshow, or null when parked. */
const showSeconds = () => {
  const t = jetFlight();
  return t === null ? null : t * FLIGHT_LEN;
};

/** Attitude and position changes the manoeuvres add on top of the flight path. */
interface Overlay {
  pitch: number;
  yaw: number;
  roll: number;
  up: number;
  left: number;
  forward: number;
}

function manoeuvres(s: FlightSample, o: Overlay): Overlay {
  o.pitch = o.yaw = o.roll = o.up = o.left = o.forward = 0;
  let m: number;
  // Angle of attack: the nose rides higher the slower the jet flies.
  if (!s.grounded) o.pitch += 0.2 * THREE.MathUtils.clamp(1 - s.speed / 1.4, 0, 1);
  // Take-off rotation and landing flare: nose up on the main wheels.
  if ((m = within(MANOEUVRES.rotate, s.wp)) >= 0) o.pitch += 0.16 * hump(m, 0.45, 0.65);
  if ((m = within(MANOEUVRES.landingFlare, s.wp)) >= 0) o.pitch += 0.13 * hump(m, 0.4, 0.75);
  // Barrel roll: a full roll while the jet traces a helix around its path.
  if ((m = within(MANOEUVRES.barrelRoll, s.wp)) >= 0) {
    const phi = Math.PI * 2 * easeInOutSine(m);
    o.roll += phi;
    o.up += 0.08 * Math.sin(phi);
    o.left += 0.08 * (1 - Math.cos(phi));
  }
  // Pugachev's cobra: pitch past vertical and back with almost no change of path.
  if ((m = within(MANOEUVRES.cobra, s.wp)) >= 0) {
    const h = hump(m, 0.35, 0.62);
    o.pitch += 1.8 * h;
    o.up += 0.03 * h;
  }
  // Kulbit: a full somersault in little more than the jet's own length.
  if ((m = within(MANOEUVRES.kulbit, s.wp)) >= 0) {
    const phi = Math.PI * 2 * easeInOutSine(m);
    o.pitch += phi;
    o.up += 0.07 * (1 - Math.cos(phi));
    o.forward -= 0.03 * Math.sin(phi);
  }
  // Falling leaf: nose high and stalled, yawing side to side while the path sinks.
  if ((m = within(MANOEUVRES.leaf, s.wp)) >= 0) {
    const swing = smoothstep(0.1, 0.25, m) * (1 - smoothstep(0.75, 0.9, m));
    const phase = m * Math.PI * 2 * 1.5;
    o.pitch += 1.0 * hump(m, 0.15, 0.82);
    o.yaw += 0.85 * swing * Math.sin(phase);
    o.roll += -0.35 * swing * Math.sin(phase + 0.6);
  }
  return o;
}

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
  const { model, materials, gearUp, rig } = useMemo(() => {
    // Work on a clone: the cached gltf.scene must stay untouched, or a remount (HMR, StrictMode) would re-centre and re-scale it again.
    const root = gltf.scene.clone(true);
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
    // The model ships both gear states as static meshes: extended legs (with lights) and closed bay doors.
    // To animate between them, the extended gear hangs from a rig at the top of the gear bay and is scaled
    // vertically: 0 tucks it into the bay, 1 is fully down.
    const gearDown: THREE.Object3D[] = [];
    const gearUp: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o.name.startsWith('SU57-landingOff')) gearUp.push(o);
      else if (o.name.startsWith('SU57-landingOn')) gearDown.push(o);
    });
    const bay = new THREE.Box3();
    gearDown.forEach((o) => bay.expandByObject(o));
    // `bay` is in the model's own space (measured before root moved), which is also root's local space.
    const rig = new THREE.Group();
    rig.position.set((bay.min.x + bay.max.x) / 2, bay.max.y, (bay.min.z + bay.max.z) / 2);
    root.add(rig);
    root.updateMatrixWorld(true);
    gearDown.forEach((o) => rig.attach(o));

    // Stand on the wheels: shift the model up so the lowest point (the tyres) sits on the pivot.
    model.position.y = (center.y - box.min.y) * model.scale.y;

    return { model, materials: [...materials], gearUp, rig };
  }, [gltf]);

  useHoverGlow(materials, 0.12);
  useFrame(() => {
    const e = gearAt(showSeconds());
    rig.scale.y = Math.max(0.001, e);
    rig.visible = e > 0.01;
    for (const o of gearUp) o.visible = e <= 0.01;
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
  return <primitive object={jet} scale={LENGTH / 6} position-y={0.025} />;
}

/** Afterburner glow at the two nozzles, in the jet's own frame (nose -z). */
const NOZZLES: [number, number, number][] = [
  [-0.017, 0.036, 0.128],
  [0.017, 0.036, 0.128],
];

/** The Su-57 parked on the desk; Launch sends it through a short airshow and back to the same spot. */
export function ModelJet() {
  const pivot = useRef<THREE.Group>(null);
  const burners = useRef<(THREE.Sprite | null)[]>([]);
  const prev = useRef<number | null>(null);
  const state = useMemo(
    () => ({
      sample: { position: new THREE.Vector3(), tangent: new THREE.Vector3(), speed: 0, accel: 0, bank: 0, wp: 0, grounded: true } as FlightSample,
      overlay: {} as Overlay,
      rest: new THREE.Quaternion().setFromEuler(REST),
      look: new THREE.Object3D(),
      target: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      a: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
    }),
    [],
  );
  const flareTimes = useMemo(() => FLARE_SALVOS.map(timeAt), []);
  const missileTime = useMemo(() => timeAt(MISSILE_AT), []);

  useFrame((_, delta) => {
    const p = pivot.current;
    if (!p) return;
    const sec = showSeconds();
    if (sec === null) {
      p.position.copy(PARKED);
      p.quaternion.copy(state.rest);
      prev.current = null;
      burners.current.forEach((b) => b && (b.visible = false));
      return;
    }

    const s = sampleFlight(sec, state.sample);
    const o = manoeuvres(s, state.overlay);

    // Heading and climb from the path, banked into turns, then the manoeuvre attitude on top.
    const L = state.look;
    L.position.copy(s.position);
    L.lookAt(state.a.copy(s.position).sub(s.tangent)); // +z away from travel, so the nose (-z) leads
    state.right.set(1, 0, 0).applyQuaternion(L.quaternion);
    state.up.set(0, 1, 0).applyQuaternion(L.quaternion);
    L.rotateZ(s.bank);
    L.rotateY(o.yaw);
    L.rotateX(o.pitch);
    L.rotateZ(o.roll);

    p.position.copy(s.position).addScaledVector(state.up, o.up).addScaledVector(state.right, -o.left).addScaledVector(s.tangent, o.forward);
    // On the ground the nose comes up around the main wheels, not the pivot: lift the pivot to match.
    if (s.position.y < PARKED.y + 0.05 && o.pitch > 0) p.position.y += Math.sin(o.pitch) * 0.07;
    // Ease toward the target attitude; fast enough for a kulbit, smooth enough to hide sampling steps.
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 16);
    p.quaternion.slerp(L.quaternion, prev.current === null ? 1 : k);

    // Afterburner: brightest while accelerating hard (take-off roll, pulling out of the cobra and kulbit).
    const throttle = THREE.MathUtils.clamp(0.15 + s.accel * 0.9, 0, 1) * Math.min(1, s.speed * 4);
    burners.current.forEach((b) => {
      if (!b) return;
      b.visible = throttle > 0.05;
      const size = 0.01 + 0.018 * throttle * (0.85 + Math.random() * 0.3);
      b.scale.set(size, size, 1);
      (b.material as THREE.SpriteMaterial).opacity = throttle;
    });

    // Timed events: flare salvos and the missile shot, fired once as the show passes them.
    const last = prev.current ?? -1;
    state.v.copy(s.tangent).multiplyScalar(s.speed);
    for (const ft of flareTimes) {
      if (last < ft && sec >= ft) {
        fireFlares(state.a.copy(p.position).addScaledVector(s.tangent, -0.09).addScaledVector(state.up, 0.02), state.v, state.right);
        blip('switch');
      }
    }
    if (last < missileTime && sec >= missileTime) {
      fireMissile(state.a.copy(p.position).addScaledVector(state.up, 0.005), state.v);
      blip('whoosh');
    }
    prev.current = sec;
    sceneState.jet.x = p.position.x;
    sceneState.jet.y = p.position.y;
    sceneState.jet.z = p.position.z;
  });

  return (
    <group>
      <group ref={pivot} position={PARKED} rotation={REST}>
        <Suspense fallback={<LowPolyJet />}>
          <Su57 />
        </Suspense>
        {NOZZLES.map((n, i) => (
          <sprite key={i} ref={(el) => (burners.current[i] = el)} position={n} visible={false}>
            <spriteMaterial map={burnerTexture()} color="#ff7a2e" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} transparent />
          </sprite>
        ))}
      </group>
      {/* Generous invisible hit area so the jet is easy to click */}
      <mesh position={[PARKED.x, PARKED.y + 0.03, PARKED.z]} {...interactive('jet', () => (atJetStop() ? launchJetWithSound() : scrollToSection('off-duty')))}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

let burnerTex: THREE.Texture | null = null;
/** Shared soft glow for the afterburners (created once, never disposed: it lives as long as the page). */
function burnerTexture() {
  if (!burnerTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,230,190,1)');
    grd.addColorStop(0.3, 'rgba(255,170,90,.55)');
    grd.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    burnerTex = new THREE.CanvasTexture(c);
  }
  return burnerTex;
}
