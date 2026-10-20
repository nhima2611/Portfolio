import type { SectionId } from './config';
import { SHOW_LENGTH } from './flight';

/** Anything on the desk that reacts to the pointer: a section link, or one of the toys. */
export type HoverTarget = SectionId | 'lamp' | 'jet' | 'headphones' | 'duck' | 'launcher';

/**
 * Mutable, non-React state read inside useFrame.
 * Values change every scroll/pointer event, so keeping them out of React state avoids re-renders.
 */
export const sceneState = {
  /** 0 … (stops.length - 1); fractional between stops */
  progress: 0,
  /** Normalised pointer, -0.5 … 0.5 */
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
  /** Object under the pointer, or null */
  hover: null as HoverTarget | null,
  /** Where the model jet is right now (the airshow camera follows it). */
  jet: { x: 0, y: 0, z: 0 },
};

export const INTRO_LEN = 3.4;
let introStart = performance.now();
let introDone = false;

export function startIntro(skip: boolean): void {
  introStart = performance.now();
  introDone = skip;
}

/** Restarts the intro clock once the canvas is ready, so slow devices don't miss the lamp flicker. */
export function restartIntroClock(): void {
  if (!introDone) introStart = performance.now();
}

export function skipIntro(): void {
  introDone = true;
}

export function isIntroDone(): boolean {
  return introDone;
}

/** Seconds since the intro started, capped at INTRO_LEN. */
export function introElapsed(now = performance.now()): number {
  if (introDone) return INTRO_LEN;
  const e = (now - introStart) / 1000;
  if (e >= INTRO_LEN) introDone = true;
  return Math.min(e, INTRO_LEN);
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const FLICKER = [1, 0, 1, 0.15, 0.9, 0, 1];
const SWITCH_ON = [1, 0.2, 1, 0.6, 1];

/* Desk lamp switch (click the lamp, or `lamp` in the terminal). Multiplies the intro lamp value. */
let lampOn = true;
let lampChangedAt = -Infinity;

export function toggleLamp(): boolean {
  lampOn = !lampOn;
  lampChangedAt = performance.now();
  return lampOn;
}

export function isLampOn(): boolean {
  return lampOn;
}

/** 0 … 1: a quick fade when switched off, a short stutter when switched back on. */
export function lampSwitch(now = performance.now()): number {
  const e = (now - lampChangedAt) / 1000;
  if (!lampOn) return sceneState.reducedMotion ? 0 : clamp01(1 - e / 0.12);
  if (sceneState.reducedMotion || e > 0.35) return 1;
  return SWITCH_ON[Math.min(SWITCH_ON.length - 1, Math.floor(e / 0.07))];
}

/* Model jet airshow (click the jet at its stop, the Launch button, or `jet` in the terminal). */
export const FLIGHT_LEN = SHOW_LENGTH;
let jetLaunchedAt = -Infinity;

/** Starts a flight unless one is already running or motion is reduced. Returns whether it launched. */
export function launchJet(startAt = 0): boolean {
  if (sceneState.reducedMotion || jetFlight() !== null) return false;
  jetLaunchedAt = performance.now() - startAt * 1000;
  return true;
}

/** 0 … 1 through the current flight, or null when the jet is parked. */
export function jetFlight(now = performance.now()): number | null {
  const t = (now - jetLaunchedAt) / 1000 / FLIGHT_LEN;
  return t >= 0 && t < 1 ? t : null;
}

/** Intro timeline. Each value is 0 (off) … 1 (fully on). */
export function introPower(e: number) {
  const lamp = e < 0.7 ? 0 : e < 1.3 ? FLICKER[Math.min(FLICKER.length - 1, Math.floor((e - 0.7) / 0.085))] : 1;
  return {
    lamp,
    shelf: clamp01((e - 1.3) / 0.6),
    laptop: clamp01((e - 1.0) / 0.6),
    monitor: clamp01((e - 1.2) / 0.7),
    phone: clamp01((e - 2.1) / 0.35),
    camera: clamp01(e / (INTRO_LEN - 0.2)),
  };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
