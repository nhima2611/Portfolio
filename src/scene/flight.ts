import * as THREE from 'three';
import { DESK_TOP } from './config';

/**
 * The Su-57's airshow, as data. The route is a smooth spline through waypoints, each with a target speed
 * (metres per second at desk scale). It is sampled once into tables of position, speed, time and bank, so
 * every frame is a lookup: speed changes continuously, the jet banks into turns in proportion to speed² ×
 * curvature, and manoeuvres are layered on top as attitude changes over stretches of the route.
 *
 * Route: from the parking spot at the right end of the desk, take-off roll along the front edge (heading -x),
 * climbing left turn, a high-speed pass in front with a barrel roll, a climbing turn with flare salvos, a missile
 * shot out of the window, cobra, kulbit, falling leaf, then a descending left turn round the lamp end onto final
 * (heading +x), touchdown, roll-out to the right end and a 180° turn on the spot, ready for the next show.
 */

const G = DESK_TOP; // wheels on the desk
const RUNWAY_Z = 0.33; // far enough in that the wingtips stay over the desk

type Waypoint = [x: number, y: number, z: number, speed: number];

// prettier-ignore
const WAYPOINTS: Waypoint[] = [
  [ 0.92, G,     RUNWAY_Z, 0.04],  // 0  parked at the right end, nose to -x
  [ 0.3,  G,     RUNWAY_Z, 0.7 ],  // 1  take-off roll
  [-0.25, G,     RUNWAY_Z, 1.05],  // 2  rotate
  [-0.6,  0.84,  0.36,     1.19],  // 3  lift-off
  [-0.98, 1.02,  0.46,     1.33],  // 4  climb out, gear up
  [-1.28, 1.22,  0.86,     1.4 ],  // 5  climbing left turn
  [-0.95, 1.4,   1.36,     1.47],  // 6
  [-0.2,  1.5,   1.56,     1.54 ],  // 7  fast pass in front: barrel roll
  [ 0.7,  1.55,  1.56,     1.54 ],  // 8
  [ 1.45, 1.65,  1.2,      1.4 ],  // 9  climbing left turn: flares
  [ 1.75, 1.9,   0.5,      1.26],  // 10
  [ 1.35, 2.1,  -0.02,     1.19],  // 11
  [ 0.6,  2.15,  0.05,     1.26 ],  // 12 heading for the window: missile
  [-0.4,  2.05,  0.15,     1.19],  // 13
  [-1.15, 1.9,   0.5,      0.98 ],  // 14 descending left turn, slowing
  [-1.0,  1.8,   1.05,     0.63],  // 15
  [-0.45, 1.8,   1.3,      0.31],  // 16 cobra
  [ 0.2,  1.82,  1.36,     0.84 ],  // 17
  [ 0.75, 1.85,  1.3,      0.56 ],  // 18 kulbit
  [ 1.5,  1.95,  0.95,     1.19],  // 19
  [ 1.72, 2.05,  0.3,      1.12 ],  // 20
  [ 1.2,  2.1,  -0.08,     0.77],  // 21
  [ 0.6,  2.05,  0.0,      0.31],  // 22 falling leaf (sinks to the next point)
  [ 0.2,  1.72,  0.05,     0.35],  // 23
  [-0.45, 1.55,  0.12,     0.98],  // 24
  [-1.12, 1.4,   0.5,      1.0 ],  // 25 descending left turn round the lamp end
  [-1.25, 1.26,  0.98,     0.95],  // 26 gear down
  [-0.98, 1.1,   0.8,      0.85],  // 27 still turning left, lining up with the runway
  [-0.62, 0.93,  0.42,     0.74],  // 28 final, heading +x
  [-0.3,  G,     RUNWAY_Z, 0.62],  // 29 touchdown
  [ 0.15, G,     RUNWAY_Z, 0.55],  // 30 roll-out
  [ 0.62, G,     RUNWAY_Z, 0.32],  // 31
  [ 0.92, G,     RUNWAY_Z, 0.02],  // 32 stop at the right end (then turn around on the spot)
];

/** Stretches of the route, in fractional waypoint indices. */
export const MANOEUVRES = {
  rotate: [1.6, 3.0],
  barrelRoll: [6.6, 7.9],
  cobra: [15.55, 16.55],
  kulbit: [17.55, 18.6],
  leaf: [21.7, 23.2],
  landingFlare: [28.4, 29.3],
} as const;
export const FLARE_SALVOS = [10.0, 10.3, 10.6];
export const MISSILE_AT = 12.25;
const GEAR_UP_AT = 3.6;
const GEAR_DOWN_AT = 25.7;
const PULL_OUT: [number, number] = [0.15, 1.2]; // camera settles into the wide shot as the take-off roll starts…
const PULL_IN: [number, number] = [30.7, 31.95]; // …and hands back to the desk stop as it rolls to a halt
/** Seconds spent turning 180° on the spot after the roll-out. */
const TURN_AROUND = 2.2;

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
/** Total length of the show, in seconds: the route plus the turn-around on the spot. */
export const SHOW_LENGTH = ROUTE_LENGTH + TURN_AROUND;

/** 0 … 1 through the final 180° turn on the spot (0 until the jet has stopped). */
export function turnAroundAt(seconds: number | null): number {
  if (seconds === null || seconds <= ROUTE_LENGTH) return 0;
  const t = Math.min(1, (seconds - ROUTE_LENGTH) / TURN_AROUND);
  return t * t * (3 - 2 * t);
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
