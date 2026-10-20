import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSoftDot } from '../useCanvasTexture';

/**
 * Airshow effects, driven imperatively by the jet: flares (burning dots that arc down trailing smoke),
 * a missile that drops, lights its motor and streaks out through the window, and the smoke for both.
 * Everything lives in fixed pools of points, so nothing is allocated mid-show.
 */

const FLARES = 64;
const SMOKE = 1200;
const GRAVITY = -0.9;
const WINDOW_TARGET = new THREE.Vector3(-1.05, 1.6, -0.5);

interface Pool {
  pos: Float32Array;
  vel: Float32Array;
  age: Float32Array;
  life: Float32Array;
  next: number;
}

function pool(n: number): Pool {
  return { pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), age: new Float32Array(n).fill(1e9), life: new Float32Array(n).fill(1), next: 0 };
}

function spawn(p: Pool, n: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
  const i = p.next;
  p.next = (i + 1) % n;
  p.pos.set([x, y, z], i * 3);
  p.vel.set([vx, vy, vz], i * 3);
  p.age[i] = 0;
  p.life[i] = life;
}

const flares = pool(FLARES);
const smoke = pool(SMOKE);

const missile = {
  active: false,
  age: 0,
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
};

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** One salvo: `count` flares thrown out to both sides and down from `at`, inheriting the jet's velocity. */
export function fireFlares(at: THREE.Vector3, jetVelocity: THREE.Vector3, right: THREE.Vector3, count = 6) {
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = 0.35 + Math.random() * 0.3;
    tmp.copy(jetVelocity).multiplyScalar(0.35).addScaledVector(right, side * spread);
    tmp.y += -0.05 + Math.random() * 0.25;
    spawn(flares, FLARES, at.x, at.y, at.z, tmp.x, tmp.y, tmp.z, 2.2 + Math.random() * 0.6);
  }
}

/** Releases the missile from the weapons bay at `at`; it falls clear, then lights up and heads for the window. */
export function fireMissile(at: THREE.Vector3, jetVelocity: THREE.Vector3) {
  missile.active = true;
  missile.age = 0;
  missile.pos.copy(at);
  missile.vel.copy(jetVelocity).multiplyScalar(0.9);
  missile.vel.y -= 0.15;
}

function Missile() {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Sprite>(null);
  const dot = useSoftDot();
  const smokeTimer = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    g.visible = missile.active;
    if (!missile.active) return;
    missile.age += dt;
    const lit = missile.age > 0.3;
    if (!lit) {
      missile.vel.y += GRAVITY * dt;
    } else {
      // Pure pursuit toward the window: turn the velocity toward the target, then accelerate.
      tmp.copy(WINDOW_TARGET).sub(missile.pos).normalize();
      const sp = Math.min(3.2, missile.vel.length() + 5 * dt);
      tmp2.copy(missile.vel).normalize().lerp(tmp, Math.min(1, dt * 3)).normalize();
      missile.vel.copy(tmp2).multiplyScalar(sp);
      smokeTimer.current += dt;
      while (smokeTimer.current > 0.012) {
        smokeTimer.current -= 0.012;
        spawn(smoke, SMOKE, missile.pos.x, missile.pos.y, missile.pos.z, (Math.random() - 0.5) * 0.03, 0.02, (Math.random() - 0.5) * 0.03, 1.6);
      }
    }
    missile.pos.addScaledVector(missile.vel, dt);
    g.position.copy(missile.pos);
    g.lookAt(tmp.copy(missile.pos).add(missile.vel));
    if (flame.current) {
      flame.current.visible = lit;
      const s = 0.03 + Math.random() * 0.015;
      flame.current.scale.set(s, s, 1);
    }
    // Out through the window: gone, with a brief glow on the glass.
    if (missile.pos.z < -0.47 || missile.age > 4) {
      missile.active = false;
      for (let i = 0; i < 10; i++) spawn(smoke, SMOKE, missile.pos.x, missile.pos.y, -0.46, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.05, 0.8);
    }
  });

  return (
    <group ref={group} visible={false}>
      {/* Body along +z (lookAt points +z along the velocity) */}
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.0032, 0.0032, 0.06, 8]} />
        <meshStandardMaterial color="#c9ccd2" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position-z={0.036} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.0032, 0.012, 8]} />
        <meshStandardMaterial color="#8a8f99" roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position-z={-0.026} rotation-z={(i * Math.PI) / 2}>
          <boxGeometry args={[0.012, 0.0008, 0.01]} />
          <meshStandardMaterial color="#8a8f99" />
        </mesh>
      ))}
      <sprite ref={flame} position-z={-0.036}>
        <spriteMaterial map={dot} color="#ffb46b" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

/** Points cloud for a pool; `paint` sets each particle's colour from its age (0 … 1 of its life). */
function usePoolPoints(p: Pool, n: number) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [p, n]);
}

const FLARE_HOT = new THREE.Color('#fff2c9');
const FLARE_COOL = new THREE.Color('#ff7a2e');

export function FlightFX() {
  const dot = useSoftDot();
  const flareGeo = usePoolPoints(flares, FLARES);
  const smokeGeo = usePoolPoints(smoke, SMOKE);
  useEffect(
    () => () => {
      flareGeo.dispose();
      smokeGeo.dispose();
    },
    [flareGeo, smokeGeo],
  );
  const c = useMemo(() => new THREE.Color(), []);
  const flareLight = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const fc = flareGeo.attributes.color as THREE.BufferAttribute;
    let lit = 0;
    let alive = 0;
    let lx = 0;
    let ly = 0;
    let lz = 0;
    for (let i = 0; i < FLARES; i++) {
      const life = flares.life[i];
      if (flares.age[i] > life) {
        fc.setXYZ(i, 0, 0, 0);
        continue;
      }
      flares.age[i] += dt;
      const k = i * 3;
      flares.vel[k + 1] += GRAVITY * 0.35 * dt;
      for (let a = 0; a < 3; a++) {
        flares.vel[k + a] *= 1 - 1.4 * dt; // drag
        flares.pos[k + a] += flares.vel[k + a] * dt;
      }
      const u = flares.age[i] / life;
      const b = (1 - u) * (0.75 + Math.random() * 0.5) * 2.2;
      c.copy(FLARE_HOT).lerp(FLARE_COOL, u).multiplyScalar(b);
      fc.setXYZ(i, c.r, c.g, c.b);
      if (Math.random() < dt * 40) spawn(smoke, SMOKE, flares.pos[k], flares.pos[k + 1], flares.pos[k + 2], 0, 0.03, 0, 1.4);
      lit += 1 - u;
      alive++;
      lx += flares.pos[k];
      ly += flares.pos[k + 1];
      lz += flares.pos[k + 2];
    }
    (flareGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    fc.needsUpdate = true;
    // The flares light the room while they burn.
    if (flareLight.current) {
      flareLight.current.intensity = Math.min(3, lit * 0.35);
      if (alive) flareLight.current.position.set(lx / alive, ly / alive, lz / alive);
    }

    const sc = smokeGeo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < SMOKE; i++) {
      const life = smoke.life[i];
      if (smoke.age[i] > life) {
        sc.setXYZ(i, 0, 0, 0);
        continue;
      }
      smoke.age[i] += dt;
      const k = i * 3;
      for (let a = 0; a < 3; a++) {
        smoke.vel[k + a] *= 1 - 0.8 * dt;
        smoke.pos[k + a] += smoke.vel[k + a] * dt;
      }
      const u = smoke.age[i] / life;
      const b = 0.16 * (1 - u) * Math.min(1, u * 8);
      sc.setXYZ(i, b, b * 0.97, b * 0.95);
    }
    (smokeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    sc.needsUpdate = true;
  });

  return (
    <group>
      <points geometry={smokeGeo} frustumCulled={false}>
        <pointsMaterial map={dot} size={0.045} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <points geometry={flareGeo} frustumCulled={false}>
        <pointsMaterial map={dot} size={0.04} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <pointLight ref={flareLight} color="#ff9a4a" intensity={0} distance={2.5} decay={2} />
      <Missile />
    </group>
  );
}
