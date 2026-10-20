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
};

export const INTRO_LEN = 3.4;
let introStart = performance.now();
let introDone = false;

export function startIntro(skip: boolean): void {
  introStart = performance.now();
  introDone = skip;
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
