import * as THREE from 'three';
import { DESK_TOP } from './config';

/**
 * The Su-57's airshow, as data. The route is a smooth spline through waypoints, each with a target speed
 * (metres per second at desk scale). It is sampled once into tables of position, speed, time and bank, so
 * every frame is a lookup: speed changes continuously, the jet banks into turns in proportion to speed² ×
 * curvature, and manoeuvres are layered on top as attitude changes over stretches of the route.
 *
 * Route: from the parking spot at the right end of the desk, take-off roll along the front edge (heading -x),
 * straight climb-out, climbing left turn, a high-speed pass in front with a barrel roll, a rolling vertical climb
 * ("drill") with flare salvos and a wingover, a missile shot out of the window and a cobra, kulbit, falling leaf,
 * then a circuit to a straight final from the right, touchdown, roll-out, and a backtrack taxi to parking.
 */

const G = DESK_TOP; // wheels on the desk
const RUNWAY_Z = 0.33; // far enough in that the wingtips stay over the desk

type Waypoint = [x: number, y: number, z: number, speed: number];

/*
 * Flown like a display routine: straight climb-out before the first turn, manoeuvres entered at speed (cobra
 * and kulbit bleed it off themselves, see SPEED_DIPS), then a left-hand circuit (downwind along the front,
 * base turn on the open right side, a straight shallow final) onto the desk heading -x.
 */
// prettier-ignore
const WAYPOINTS: Waypoint[] = [
  [ 0.92, G,     RUNWAY_Z, 0.04],  // 0  parked at the right end, nose to -x
  [ 0.3,  G,     RUNWAY_Z, 0.75],  // 1  take-off roll
  [-0.2,  G,     RUNWAY_Z, 1.1 ],  // 2  rotate
  [-0.55, 0.86,  RUNWAY_Z, 1.2 ],  // 3  lift-off
  [-0.95, 1.05,  0.36,     1.3 ],  // 4  straight climb-out, gear up
  [-1.28, 1.25,  0.75,     1.35],  // 5  climbing left turn
  [-1.05, 1.42,  1.2,      1.45],  // 6
  [-0.3,  1.5,   1.35,     1.55],  // 7  fast pass along the front: barrel roll
  [ 0.65, 1.55,  1.35,     1.55],  // 8
  [ 1.1,  1.62,  1.32,     0.95],  // 9  pull up into the drill: steep climb, rolling, flares
  [ 1.25, 2.0,   1.3,      0.5 ],  // 10
  [ 1.33, 2.25,  1.22,     0.35],  // 11 top of the climb
  [ 1.42, 2.4,   0.95,     0.35],  // 12 wingover: nose falls through to the left
  [ 1.5,  2.25,  0.5,      0.9 ],  // 13 diving toward the back
  [ 1.35, 2.15,  0.0,      1.1 ],  // 14 left turn onto the back line
  [ 0.6,  2.15,  0.05,     1.25],  // 15 along the back toward the window: missile salvo, then cobra
  [ 0.0,  2.12,  0.08,     1.15],  // 16
  [-0.6,  2.08,  0.15,     1.1 ],  // 17
  [-1.15, 1.9,   0.5,      1.0 ],  // 18 defensive break turn, flares
  [-1.0,  1.8,   1.05,     1.0 ],  // 19
  [-0.3,  1.78,  1.3,      1.05],  // 20 along the front again: kulbit
  [ 0.4,  1.8,   1.32,     1.0 ],  // 21
  [ 1.3,  1.95,  1.05,     1.05],  // 22 climbing left turn
  [ 1.7,  2.05,  0.4,      0.9 ],  // 23
  [ 1.25, 2.1,  -0.05,     0.5 ],  // 24 slowing to the stall
  [ 0.6,  2.05,  0.0,      0.17],  // 25 falling leaf (sinks slowly to the next point)
  [ 0.15, 1.72,  0.05,     0.19],  // 26
  [-0.45, 1.55,  0.12,     0.85],  // 27 recover
  [-1.15, 1.42,  0.5,      1.0 ],  // 28 left turn onto downwind
  [-1.0,  1.32,  1.05,     1.0 ],  // 29
  [ 0.0,  1.25,  1.15,     0.95],  // 30 downwind, heading +x: gear down
  [ 1.4,  1.2,   1.1,      0.9 ],  // 31
  [ 2.2,  1.15,  0.85,     0.85],  // 32 base turn
  [ 2.45, 1.07,  0.45,     0.8 ],  // 33
  [ 2.15, 1.0,   RUNWAY_Z, 0.75],  // 34 final, heading -x
  [ 1.6,  0.88,  RUNWAY_Z, 0.7 ],  // 35
  [ 1.08, G,     RUNWAY_Z, 0.6 ],  // 36 touchdown
  [ 0.45, G,     RUNWAY_Z, 0.5 ],  // 37 roll-out
  [-0.2,  G,     RUNWAY_Z, 0.12],  // 38 stop, then backtrack to the parking spot (see groundOpsAt)
];

/** Stretches of the route, in fractional waypoint indices. */
export const MANOEUVRES = {
  rotate: [1.6, 3.0],
  barrelRoll: [6.7, 7.9],
  drill: [9.2, 11.5],
  cobra: [15.45, 16.5],
  kulbit: [20.05, 21.1],
  leaf: [24.7, 26.2],
  landingFlare: [35.55, 36.4],
} as const;
/** Cobra and kulbit trade speed for angle of attack: the jet slows to this fraction mid-manoeuvre. */
const SPEED_DIPS: [window: readonly [number, number], floor: number][] = [
  [MANOEUVRES.cobra, 0.22],
  [MANOEUVRES.kulbit, 0.3],
];
export const FLARE_SALVOS = [9.6, 10.2, 10.8]; // fired while climbing through the drill
/** Four-missile ripple salvo from the weapons bays, heading along the back toward the window. */
export const MISSILE_SALVO = [14.3, 14.6, 14.9, 15.2];
/** An inbound threat appears from the right as the cobra bleeds off speed… */
export const THREAT_AT = 15.55;
export const THREAT_FROM: [number, number, number] = [3.2, 2.0, 0.3];
/** …and the jet breaks left, dumping flares until the threat takes the bait. */
export const DEFENSIVE_FLARES = [17.6, 17.85, 18.1];
const GEAR_UP_AT = 4.3; // positive climb
const GEAR_DOWN_AT = 30.2; // abeam on downwind
const PULL_OUT: [number, number] = [0.15, 1.2]; // camera settles into the wide shot as the take-off roll starts…
const PULL_IN: [number, number] = [36.6, 37.8]; // …and hands back to the desk as the jet rolls out
/** After stopping: turn round, taxi back along the runway, turn into the parking spot. */
const GROUND_TURN = 1.4;
const GROUND_TAXI = 2.8;

const SAMPLES = 6000;
const GRAVITY = 1.6; // scaled g for bank angles: lower = steeper banks
const MAX_BANK = 1.2;

const curve = new THREE.CatmullRomCurve3(
  WAYPOINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  'centripetal',
);

const pos = new Float32Array((SAMPLES + 1) * 3);
const dist = new Float32Array(SAMPLES + 1);
const speed = new Float32Array(SAMPLES + 1);
const time = new Float32Array(SAMPLES + 1);
const bank = new Float32Array(SAMPLES + 1);

/** Over the desk the spline must never dip below the desk top (it can sag slightly between ground points). */
const onDesk = (x: number, z: number) => x > -0.82 && x < 1.12 && z > -0.43 && z < 0.43;

(() => {
  const p = new THREE.Vector3();
  for (let k = 0; k <= SAMPLES; k++) {
    curve.getPoint(k / SAMPLES, p);
    if (onDesk(p.x, p.z) && p.y < G) p.y = G;
    pos.set([p.x, p.y, p.z], k * 3);
    if (k > 0) {
      const dx = p.x - pos[k * 3 - 3];
      const dy = p.y - pos[k * 3 - 2];
      const dz = p.z - pos[k * 3 - 1];
      dist[k] = dist[k - 1] + Math.hypot(dx, dy, dz);
    }
  }
  // Waypoint i sits at curve parameter i / (n - 1); interpolate target speeds by distance between them.
  const n = WAYPOINTS.length;
  const wpK = WAYPOINTS.map((_, i) => Math.round((i / (n - 1)) * SAMPLES));
  for (let i = 0; i < n - 1; i++) {
    const [k0, k1] = [wpK[i], wpK[i + 1]];
    const span = dist[k1] - dist[k0] || 1;
    for (let k = k0; k <= k1; k++) {
      const f = (dist[k] - dist[k0]) / span;
      // Smoothstep between waypoint speeds, so acceleration has no kinks.
      const e = f * f * (3 - 2 * f);
      speed[k] = WAYPOINTS[i][3] + (WAYPOINTS[i + 1][3] - WAYPOINTS[i][3]) * e;
    }
  }
  // Manoeuvres that bleed energy: dip the speed through their window (smoothly, so the jet decelerates into it).
  for (const [[from, to], floor] of SPEED_DIPS) {
    for (let k = wpK[0]; k <= SAMPLES; k++) {
      const wp = (k / SAMPLES) * (n - 1);
      if (wp < from || wp > to) continue;
      const m = (wp - from) / (to - from);
      speed[k] *= 1 - (1 - floor) * Math.sin(m * Math.PI) ** 2;
    }
  }
  for (let k = 1; k <= SAMPLES; k++) {
    const v = Math.max(0.03, (speed[k] + speed[k - 1]) / 2);
    time[k] = time[k - 1] + (dist[k] - dist[k - 1]) / v;
  }
  // Coordinated-turn bank: tan(bank) = v² κ / g, with κ the signed horizontal curvature (+ = left turn).
  const raw = new Float32Array(SAMPLES + 1);
  for (let k = 1; k < SAMPLES; k++) {
    const ax = pos[k * 3] - pos[k * 3 - 3];
    const az = pos[k * 3 + 2] - pos[k * 3 - 1];
    const bx = pos[k * 3 + 3] - pos[k * 3];
    const bz = pos[k * 3 + 5] - pos[k * 3 + 2];
    const la = Math.hypot(ax, az);
    const lb = Math.hypot(bx, bz);
    if (la < 1e-6 || lb < 1e-6) continue;
    const cross = (az * bx - ax * bz) / (la * lb); // sin of heading change; + = turning left
    const kappa = cross / ((la + lb) / 2);
    const grounded = pos[k * 3 + 1] <= G + 0.005;
    raw[k] = grounded ? 0 : Math.atan((speed[k] * speed[k] * kappa) / GRAVITY);
  }
  // Roll rate is finite: smooth the bank over ~10 cm of route.
  const W = 60;
  for (let k = 0; k <= SAMPLES; k++) {
    let sum = 0;
    let cnt = 0;
    for (let j = Math.max(0, k - W); j <= Math.min(SAMPLES, k + W); j++) {
      sum += raw[j];
      cnt++;
    }
    bank[k] = THREE.MathUtils.clamp(sum / cnt, -MAX_BANK, MAX_BANK);
  }
})();

/** Seconds until the jet stops at the end of the roll-out. */
const ROUTE_LENGTH = time[SAMPLES];
/** Total length of the show, in seconds: the route plus taxiing back to the parking spot. */
export const SHOW_LENGTH = ROUTE_LENGTH + GROUND_TURN * 2 + GROUND_TAXI;

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Backtrack after the roll-out: turn 180° on the runway, taxi back to the right end, turn 180° into the
 * parking spot. Returns the jet's x and its yaw relative to the take-off heading, or null before it starts.
 */
export function groundOpsAt(seconds: number | null): { x: number; yaw: number; moving: number } | null {
  if (seconds === null || seconds <= ROUTE_LENGTH) return null;
  const t = seconds - ROUTE_LENGTH;
  const stopX = WAYPOINTS[WAYPOINTS.length - 1][0];
  const parkX = WAYPOINTS[0][0];
  if (t < GROUND_TURN) return { x: stopX, yaw: Math.PI * ease(t / GROUND_TURN), moving: 0.3 };
  if (t < GROUND_TURN + GROUND_TAXI) {
    const f = ease((t - GROUND_TURN) / GROUND_TAXI);
    return { x: stopX + (parkX - stopX) * f, yaw: Math.PI, moving: 0.5 };
  }
  const f = Math.min(1, (t - GROUND_TURN - GROUND_TAXI) / GROUND_TURN);
  return { x: parkX, yaw: Math.PI * (1 + ease(f)), moving: 0.3 * (1 - f) };
}

const kOf = (wp: number) => Math.round((wp / (WAYPOINTS.length - 1)) * SAMPLES);
/** Seconds into the show at which the jet reaches fractional waypoint `wp`. */
export const timeAt = (wp: number) => time[kOf(wp)];

export interface FlightSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  speed: number;
  accel: number;
  bank: number;
  /** Fractional waypoint index, for manoeuvre windows. */
  wp: number;
  grounded: boolean;
}

/** Interpolated state `seconds` into the show. */
export function sampleFlight(seconds: number, out: FlightSample): FlightSample {
  const t = THREE.MathUtils.clamp(seconds, 0, ROUTE_LENGTH);
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (time[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - time[lo]) / Math.max(1e-6, time[hi] - time[lo]);
  const lerp = (arr: Float32Array, stride: number, i: number) => arr[lo * stride + i] + (arr[hi * stride + i] - arr[lo * stride + i]) * f;
  out.position.set(lerp(pos, 3, 0), lerp(pos, 3, 1), lerp(pos, 3, 2));
  // Tangent over a short window either side, so it turns smoothly between samples.
  const a = Math.max(0, lo - 4);
  const b = Math.min(SAMPLES, hi + 4);
  out.tangent.set(pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]).normalize();
  out.speed = lerp(speed, 1, 0);
  out.accel = (speed[b] - speed[a]) / Math.max(1e-4, time[b] - time[a]);
  out.bank = lerp(bank, 1, 0);
  out.wp = ((lo + f) / SAMPLES) * (WAYPOINTS.length - 1);
  out.grounded = out.position.y <= G + 0.004;
  return out;
}

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/** Landing gear extension (1 = down) `seconds` into the show; null = parked. */
export function gearAt(seconds: number | null): number {
  if (seconds === null) return 1;
  const up = timeAt(GEAR_UP_AT);
  const down = timeAt(GEAR_DOWN_AT);
  if (seconds < up) return 1;
  if (seconds < up + 0.7) return 1 - smooth(up, up + 0.7, seconds);
  if (seconds < down) return 0;
  return easeOutBack(Math.min(1, (seconds - down) / 1.1));
}

/** How far the camera pulls back to the wide shot (0 … 1) `seconds` into the show. */
export function cameraPullAt(seconds: number | null): number {
  if (seconds === null) return 0;
  return smooth(timeAt(PULL_OUT[0]), timeAt(PULL_OUT[1]), seconds) * (1 - smooth(timeAt(PULL_IN[0]), timeAt(PULL_IN[1]), seconds));
}

/** 0 … 1 progress through a manoeuvre window, or -1 outside it. */
export function within([from, to]: readonly [number, number], wp: number): number {
  return wp >= from && wp <= to ? (wp - from) / (to - from) : -1;
}

/** When the camera is back near the desk for the landing: the text panels can return. */
export const PANELS_BACK_AT = () => timeAt(PULL_IN[0]);

export const PARKED = new THREE.Vector3(...(WAYPOINTS[0].slice(0, 3) as [number, number, number]));
