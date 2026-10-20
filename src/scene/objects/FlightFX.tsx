import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { blip } from '../../lib/sound';
import { sceneState } from '../state';
import { useSoftDot } from '../useCanvasTexture';

/**
 * Airshow effects, driven imperatively by the jet: flares (burning dots that arc down trailing smoke),
 * a four-missile salvo that drops from the weapons bay and streaks out through the window, an inbound threat
 * that homes on the jet until a flare salvo lures it away and it detonates, and the smoke and fireballs for all
 * of it. Everything lives in fixed pools, so nothing is allocated mid-show.
 */

const FLARES = 160; // flares, sparks and missile embers share this pool
const SMOKE = 1200;
const GRAVITY = -0.9;

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

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/* ---------- Missiles: four outbound shots through the window, and one inbound threat ---------- */

type MissileMode = 'outbound' | 'threat';
interface Missile {
  active: boolean;
  mode: MissileMode;
  age: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Outbound: the point outside the window it flies to. */
  aim: THREE.Vector3;
  /** Outbound: a point to pass through first (cruise missiles climb into the room before turning for the window). */
  via: THREE.Vector3 | null;
  /** Threat: index of the flare it has been decoyed onto, or -1 while it still tracks the jet. */
  decoy: number;
  /** Ground-launched: bigger motor flame and a trail of embers behind it. */
  bright: boolean;
  smokeTimer: number;
}

const MISSILES = 6;
const missiles: Missile[] = Array.from({ length: MISSILES }, () => ({
  active: false,
  mode: 'outbound',
  age: 0,
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  aim: new THREE.Vector3(),
  via: null,
  decoy: -1,
  bright: false,
  smokeTimer: 0,
}));

/** Four aim points beyond the window glass, so a salvo fans out instead of flying in one line. */
const WINDOW_TARGETS = [
  new THREE.Vector3(-1.3, 1.8, -0.6),
  new THREE.Vector3(-0.85, 1.75, -0.6),
  new THREE.Vector3(-1.2, 1.4, -0.6),
  new THREE.Vector3(-0.9, 1.35, -0.6),
];
let salvoIndex = 0;

/** Where the jet is right now: the threat homes on it. */
const jetPosition = sceneState.jet;

const blast = { intensity: 0, pos: new THREE.Vector3() };
/** Where an outbound missile leaves through the glass (kept apart from `tmp`, which explode() reuses). */
const exitPoint = new THREE.Vector3();

/** A fireball: hot sparks flung outward, a smoke puff, a flash of light and a thump. */
function explode(at: THREE.Vector3, size = 1) {
  for (let i = 0; i < 14 * size; i++) {
    tmp.set(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize().multiplyScalar(0.25 + Math.random() * 0.45 * size);
    spawn(flares, FLARES, at.x, at.y, at.z, tmp.x, tmp.y, tmp.z, 0.35 + Math.random() * 0.25);
  }
  for (let i = 0; i < 26 * size; i++) {
    spawn(smoke, SMOKE, at.x, at.y, at.z, (Math.random() - 0.5) * 0.25, (Math.random() - 0.3) * 0.2, (Math.random() - 0.5) * 0.25, 1.4 + Math.random());
  }
  blast.intensity = 5 * size;
  blast.pos.copy(at);
  blip('boom');
}

/** Launch at the tube mouth: a bright flash, sparks and a quick puff of smoke billowing out. */
function launchFlash(at: THREE.Vector3) {
  for (let i = 0; i < 10; i++) {
    tmp.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(0.15 + Math.random() * 0.25);
    spawn(flares, FLARES, at.x, at.y, at.z, tmp.x, tmp.y, tmp.z, 0.25 + Math.random() * 0.2);
  }
  for (let i = 0; i < 18; i++) {
    spawn(smoke, SMOKE, at.x, at.y, at.z, (Math.random() - 0.5) * 0.3, Math.random() * 0.12, (Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 0.8);
  }
  blast.intensity = Math.max(blast.intensity, 2.5);
  blast.pos.copy(at);
}

function freeMissile(): Missile | null {
  return missiles.find((m) => !m.active) ?? null;
}

/**
 * Fires one missile out of the window from `at`. From the jet it drops clear of the weapons bay first, then
 * lights its motor; from a ground launcher (`fromTube`) the booster lights in the tube and it leaves along `velocity`.
 */
export function fireMissile(at: THREE.Vector3, velocity: THREE.Vector3, fromTube = false, via: THREE.Vector3 | null = null) {
  const m = freeMissile();
  if (!m) return;
  Object.assign(m, { active: true, mode: 'outbound', age: fromTube ? 0.3 : 0, decoy: -1, smokeTimer: 0, bright: fromTube });
  if (fromTube) launchFlash(at);
  m.pos.copy(at);
  m.vel.copy(velocity).multiplyScalar(fromTube ? 1 : 0.9);
  if (!fromTube) m.vel.y -= 0.15;
  m.aim.copy(WINDOW_TARGETS[salvoIndex++ % WINDOW_TARGETS.length]);
  m.via = via;
}

/** An inbound missile from `from`, homing on the jet until flares lure it away. */
export function launchThreat(from: THREE.Vector3) {
  const m = freeMissile();
  if (!m) return;
  Object.assign(m, { active: true, mode: 'threat', age: 0.4, decoy: -1, smokeTimer: 0, bright: false });
  m.pos.copy(from);
  m.vel.set(jetPosition.x, jetPosition.y, jetPosition.z).sub(from).setLength(0.9);
  blip('warning');
}

/** One salvo: `count` flares thrown out to both sides and down from `at`. Any threat in the air takes the bait. */
export function fireFlares(at: THREE.Vector3, jetVelocity: THREE.Vector3, right: THREE.Vector3, count = 6) {
  const first = flares.next;
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = 0.35 + Math.random() * 0.3;
    tmp.copy(jetVelocity).multiplyScalar(0.35).addScaledVector(right, side * spread);
    tmp.y += -0.05 + Math.random() * 0.25;
    spawn(flares, FLARES, at.x, at.y, at.z, tmp.x, tmp.y, tmp.z, 2.2 + Math.random() * 0.6);
  }
  for (const m of missiles) if (m.active && m.mode === 'threat' && m.decoy < 0) m.decoy = first;
}

function stepMissile(m: Missile, dt: number) {
  m.age += dt;
  const lit = m.age > 0.3;
  if (!lit) {
    m.vel.y += GRAVITY * dt;
  } else {
    // Pursuit: turn the velocity toward the target at a limited rate, accelerating to top speed.
    if (m.mode === 'outbound' && m.via && m.pos.distanceTo(m.via) < 0.3) m.via = null;
    if (m.mode === 'outbound') tmp.copy(m.via ?? m.aim);
    else if (m.decoy >= 0) tmp.fromArray(flares.pos, m.decoy * 3);
    else tmp.set(jetPosition.x, jetPosition.y, jetPosition.z);
    const dist = tmp.distanceTo(m.pos);
    tmp.sub(m.pos).normalize();
    const turn = m.mode === 'outbound' ? 3 : m.decoy >= 0 ? 6 : 1.6;
    const top = m.mode === 'outbound' ? 3.2 : 1.9;
    const sp = Math.min(top, m.vel.length() + (m.mode === 'outbound' ? 5 : 1.4) * dt);
    tmp2.copy(m.vel).normalize().lerp(tmp, Math.min(1, dt * turn)).normalize();
    m.vel.copy(tmp2).multiplyScalar(sp);
    m.smokeTimer += dt;
    while (m.smokeTimer > 0.012) {
      m.smokeTimer -= 0.012;
      spawn(smoke, SMOKE, m.pos.x, m.pos.y, m.pos.z, (Math.random() - 0.5) * 0.03, 0.02, (Math.random() - 0.5) * 0.03, 1.6);
    }
    // Ground-launched rounds shed glowing embers: a bright streak of fire behind the motor.
    if (m.bright && Math.random() < dt * 70) {
      tmp2.copy(m.vel).multiplyScalar(-0.12);
      spawn(flares, FLARES, m.pos.x, m.pos.y, m.pos.z, tmp2.x + (Math.random() - 0.5) * 0.04, tmp2.y, tmp2.z + (Math.random() - 0.5) * 0.04, 0.22 + Math.random() * 0.12);
    }
    // The threat detonates on the flare it chased. Safety net: it never reaches the jet, and gives up after a while.
    if (m.mode === 'threat' && ((m.decoy >= 0 && dist < 0.06) || (m.decoy < 0 && dist < 0.3) || m.age > 7)) {
      m.active = false;
      explode(m.pos, 1);
      return;
    }
  }
  m.pos.addScaledVector(m.vel, dt);
  // Outbound: out through the window, then a distant fireball glimpsed through the glass.
  if (m.mode === 'outbound' && (m.pos.z < -0.47 || m.age > 4)) {
    m.active = false;
    explode(exitPoint.set(m.pos.x, m.pos.y, -0.46), 0.6);
  }
}

function MissileMesh({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Sprite>(null);
  const flameMat = useRef<THREE.SpriteMaterial>(null);
  const dot = useSoftDot();

  useFrame((_, delta) => {
    const g = group.current;
    const m = missiles[index];
    if (!g) return;
    if (m.active) stepMissile(m, Math.min(delta, 0.05));
    g.visible = m.active;
    if (!m.active) return;
    g.position.copy(m.pos);
    g.lookAt(tmp.copy(m.pos).add(m.vel));
    if (flame.current) {
      flame.current.visible = m.age > 0.3;
      const s = (m.bright ? 0.05 : 0.03) + Math.random() * 0.015;
      flame.current.scale.set(s, s, 1);
    }
    flameMat.current?.color.set(m.mode === 'threat' ? '#ff5a3a' : '#ffb46b');
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
        <spriteMaterial ref={flameMat} map={dot} color="#ffb46b" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
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
  const blastLight = useRef<THREE.PointLight>(null);

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

    // Explosion flash: bright for an instant, gone in a quarter of a second.
    blast.intensity *= Math.exp(-dt * 12);
    if (blastLight.current) {
      blastLight.current.intensity = blast.intensity;
      blastLight.current.position.copy(blast.pos);
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
      <pointLight ref={blastLight} color="#ffb070" intensity={0} distance={3} decay={2} />
      {missiles.map((_, i) => (
        <MissileMesh key={i} index={i} />
      ))}
    </group>
  );
}
