import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { blip } from '../../lib/sound';
import { COLORS } from '../config';
import { hoverAmount } from '../hover';
import { interactive } from '../interaction';
import { sceneState } from '../state';
import { say } from '../terminal';
import { fireMissile } from './FlightFX';

/**
 * Top-shelf display: a scale model of the S-400 Triumf launcher (by 42manako on Sketchfab, CC BY-NC 4.0,
 * credited in the footer) and a missile on a display cradle. Click the launcher: it raises its tube pod to the
 * vertical, ripples two missiles off (they climb into the room, then turn for the window) and lowers it again.
 * A simple procedural launcher stands in while the model loads.
 */

const SHELF_TOP = 1.7525;
const OLIVE = { color: '#4d5a3c', roughness: 0.75 } as const;
const DARK = { color: '#22252b', roughness: 0.6, metalness: 0.3 } as const;

const ERECT_TIME = 1.3;
const HOLD_TIME = 2.6;
const FIRE_AT = [1.45, 1.85]; // seconds after the click
/** Cruise missiles pop up into the middle of the room before turning for the window. */
const CRUISE_VIA = new THREE.Vector3(0.1, 2.35, 0.7);

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

function useHoverMaterial(params: THREE.MeshStandardMaterialParameters) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ ...params, emissive: COLORS.lamp, emissiveIntensity: 0 }), [params]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    mat.emissiveIntensity = 0.2 * hoverAmount('launcher');
  });
  return mat;
}

/**
 * Click-to-fire sequence shared by both launchers: swing the pod from `restAngle` to `erectAngle` about its hinge
 * (the trucks face -x), fire one missile per FIRE_AT along `launchAxis` (pod-local) from the first muzzles, hold,
 * then lower it again.
 */
function useLaunchSequence(restAngle: number, erectAngle: number, launchAxis: THREE.Vector3, fireAt: readonly number[] = FIRE_AT) {
  const firedAt = useRef(-Infinity);
  const shots = useRef(0);
  const tmp = useMemo(() => ({ at: new THREE.Vector3(), dir: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  const onClick = () => {
    if (sceneState.reducedMotion) return;
    const busy = (performance.now() - firedAt.current) / 1000 < ERECT_TIME * 2 + HOLD_TIME;
    if (busy) return;
    firedAt.current = performance.now();
    shots.current = 0;
    blip('switch');
  };

  const step = (pod: THREE.Object3D | null, muzzles: (THREE.Object3D | null)[]) => {
    const t = (performance.now() - firedAt.current) / 1000;
    const up = smooth(t / ERECT_TIME) * (1 - smooth((t - ERECT_TIME - HOLD_TIME) / ERECT_TIME));
    if (pod) pod.rotation.z = restAngle + (erectAngle - restAngle) * up;

    while (shots.current < fireAt.length && t >= fireAt[shots.current]) {
      const muzzle = muzzles[shots.current];
      shots.current++;
      if (!muzzle) continue;
      muzzle.getWorldPosition(tmp.at);
      muzzle.getWorldQuaternion(tmp.q);
      tmp.dir.copy(launchAxis).applyQuaternion(tmp.q).multiplyScalar(0.9);
      fireMissile(tmp.at, tmp.dir, true, CRUISE_VIA);
      blip('whoosh');
      if (shots.current === fireAt.length) say([['#ffb46b', '↑ two missiles away'], ['#9aa0ad', 'both through the window']]);
    }
  };

  return { onClick, step };
}

const SIMPLE_AXIS = new THREE.Vector3(-1, 0, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Procedural stand-in launcher, shown while the S-400 model loads. */
function SimpleLauncher() {
  const body = useHoverMaterial(OLIVE);
  const pod = useRef<THREE.Group>(null);
  const muzzles = useRef<(THREE.Object3D | null)[]>([]);
  const { onClick, step } = useLaunchSequence(0, -0.9, SIMPLE_AXIS);
  useFrame(() => step(pod.current, muzzles.current));

  const wheelXs = [-0.095, -0.06, 0.05, 0.085];
  return (
    <group position={[1.28, SHELF_TOP, -0.39]} rotation-y={0.12}>
      {/* Chassis and cab (front of the truck toward -x, facing the window) */}
      <mesh position={[0, 0.03, 0]} material={body} castShadow>
        <boxGeometry args={[0.25, 0.012, 0.064]} />
      </mesh>
      <mesh position={[-0.1, 0.058, 0]} material={body} castShadow>
        <boxGeometry args={[0.05, 0.046, 0.064]} />
      </mesh>
      <mesh position={[-0.1255, 0.066, 0]}>
        <boxGeometry args={[0.002, 0.018, 0.054]} />
        <meshStandardMaterial color="#1a2433" roughness={0.15} metalness={0.6} />
      </mesh>
      {wheelXs.flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh key={`${x}${side}`} position={[x, 0.016, side * 0.034]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 0.012, 14]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
        )),
      )}

      {/* Launch pod on a pivot at the rear, four tubes in a 2 × 2 block */}
      <group ref={pod} position={[0.115, 0.04, 0]}>
        <mesh position={[-0.09, 0.022, 0]} material={body} castShadow>
          <boxGeometry args={[0.185, 0.044, 0.056]} />
        </mesh>
        {[-1, 1].flatMap((row) =>
          [-1, 1].map((col) => {
            const i = (row + 1) + (col + 1) / 2;
            return (
              <group key={`${row}${col}`} position={[-0.183, 0.022 + row * 0.011, col * 0.014]}>
                <mesh rotation-y={-Math.PI / 2}>
                  <circleGeometry args={[0.0085, 16]} />
                  <meshStandardMaterial {...DARK} side={THREE.DoubleSide} />
                </mesh>
                <object3D ref={(el) => (muzzles.current[i] = el)} position-x={-0.01} />
              </group>
            );
          }),
        )}
      </group>
      <mesh position={[0.115, 0.042, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.006, 0.006, 0.06, 10]} />
        <meshStandardMaterial {...DARK} />
      </mesh>

      {/* Hit area */}
      <mesh position={[0, 0.05, 0]} {...interactive('launcher', onClick)}>
        <boxGeometry args={[0.3, 0.12, 0.12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

const S400_URL = '/models/s400.glb';
const extendLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};
useLoader.preload(GLTFLoader, S400_URL, extendLoader);

/** Nose-to-tail length of the truck on the shelf, in metres. */
const S400_LENGTH = 0.32;
/** Already erect, so it fires almost at once. */
const S400_FIRE_AT = [0.35, 0.8];
/**
 * The S-400 model is a tractor ("Truck") and a semi-trailer ("Rockets": chassis, wheels and the four-tube pod,
 * modelled erect) parked at an angle to each other. The pod cannot be lowered on its own, so the launcher stands in
 * its launch-ready pose and fires straight up out of the tubes, the way the real system launches.
 *
 * Normalised on load: the trailer's long axis (found by PCA of its vertices) along x, tubes at the back (+x),
 * tractor toward the window, wheels on the shelf. Muzzle markers sit on top of the four tubes.
 */
function S400() {
  const gltf = useLoader(GLTFLoader, S400_URL, extendLoader);
  const { display, muzzles, materials } = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);
    let trailer: THREE.Object3D | undefined;
    root.traverse((o) => {
      if (!trailer && /Rockets/.test(o.name)) trailer = o;
    });

    // Sample the trailer's vertices (root space) once.
    const verts: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    trailer?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const pos = mesh.geometry.getAttribute('position');
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step) verts.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone());
    });

    // Principal horizontal axis of the trailer.
    let mx = 0;
    let mz = 0;
    for (const p of verts) {
      mx += p.x;
      mz += p.z;
    }
    mx /= verts.length || 1;
    mz /= verts.length || 1;
    let cxx = 0;
    let czz = 0;
    let cxz = 0;
    for (const p of verts) {
      cxx += (p.x - mx) ** 2;
      czz += (p.z - mz) ** 2;
      cxz += (p.x - mx) * (p.z - mz);
    }
    let yaw = 0.5 * Math.atan2(2 * cxz, cxx - czz);
    // Put the tubes (the highest vertices) at +x.
    const maxY = verts.reduce((m, p) => Math.max(m, p.y), -Infinity);
    const minY = verts.reduce((m, p) => Math.min(m, p.y), Infinity);
    const tall = verts.filter((p) => p.y > minY + (maxY - minY) * 0.6);
    const along = (p: THREE.Vector3) => (p.x - mx) * Math.cos(yaw) + (p.z - mz) * Math.sin(yaw);
    if (tall.reduce((sum, p) => sum + along(p), 0) < 0) yaw += Math.PI;

    const turned = new THREE.Group();
    turned.add(root);
    turned.rotation.y = yaw; // maps the trailer axis (cos yaw, sin yaw) onto +x
    const model = new THREE.Group();
    model.add(turned);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = S400_LENGTH / size.x;
    model.scale.setScalar(scale);
    model.position.set(-box.getCenter(v).x * scale, -box.min.y * scale, -box.getCenter(v).z * scale);
    const display = new THREE.Group();
    display.add(model);
    display.updateMatrixWorld(true);

    const materials = new Set<THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.isMeshStandardMaterial) {
        m.emissive.set(COLORS.lamp);
        m.emissiveIntensity = 0;
        materials.add(m);
      }
    });

    // Tube tops: the box around the tall vertices, in display space; muzzles on a 2 × 2 grid across its top.
    const tubes = new THREE.Box3();
    for (const p of tall) tubes.expandByPoint(p.clone().applyMatrix4(root.matrixWorld));
    const muzzles: THREE.Object3D[] = [];
    for (const [fx, fz] of [[0.3, 0.3], [0.7, 0.7], [0.3, 0.7], [0.7, 0.3]]) {
      const m = new THREE.Object3D();
      m.position.set(
        THREE.MathUtils.lerp(tubes.min.x, tubes.max.x, fx),
        tubes.max.y + 0.004,
        THREE.MathUtils.lerp(tubes.min.z, tubes.max.z, fz),
      );
      display.add(m);
      muzzles.push(m);
    }
    return { display, muzzles, materials: [...materials] };
  }, [gltf]);

  const { onClick, step } = useLaunchSequence(0, 0, UP_AXIS, S400_FIRE_AT);
  useFrame(() => {
    const h = 0.18 * hoverAmount('launcher');
    for (const m of materials) m.emissiveIntensity = h;
    step(null, muzzles);
  });

  return (
    <group position={[1.25, SHELF_TOP, -0.39]} rotation-y={0.12}>
      <primitive object={display} />
      <mesh position={[0, 0.07, 0]} {...interactive('launcher', onClick)}>
        <boxGeometry args={[S400_LENGTH + 0.02, 0.16, 0.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/** A cruise missile on a display cradle: body, ogive nose, pop-out wings and a cruciform tail. */
function MissileOnCradle() {
  const skin = { color: '#b9bec6', roughness: 0.45, metalness: 0.4 } as const;
  return (
    <group position={[1.62, SHELF_TOP, -0.39]} rotation-y={-0.35}>
      <mesh position-y={0.003} receiveShadow>
        <boxGeometry args={[0.13, 0.006, 0.05]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {[-0.035, 0.035].map((x) => (
        <mesh key={x} position={[x, 0.016, 0]}>
          <boxGeometry args={[0.006, 0.022, 0.03]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      ))}
      <group position-y={0.034}>
        <mesh rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.0075, 0.0075, 0.11, 16]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        <mesh position-x={-0.066} rotation-z={Math.PI / 2}>
          <coneGeometry args={[0.0075, 0.022, 16]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        <mesh position-x={0.004}>
          <boxGeometry args={[0.018, 0.0015, 0.07]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position-x={0.05} rotation-x={(i * Math.PI) / 2 + Math.PI / 4}>
            <boxGeometry args={[0.012, 0.022, 0.0012]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        ))}
        <mesh position-x={0.0555} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.005, 0.0065, 0.004, 14]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      </group>
    </group>
  );
}

export function ShelfDisplay() {
  return (
    <>
      <Suspense fallback={<SimpleLauncher />}>
        <S400 />
      </Suspense>
      <MissileOnCradle />
    </>
  );
}
