import { useFrame } from '@react-three/fiber';
import { isIntroDone, sceneState, type HoverTarget } from './state';

/**
 * Smoothed 0 … 1 highlight per interactive target. Objects read `hoverAmount()` in their own useFrame.
 * On touch screens (no hover), each object pulses once after the intro so visitors learn they can tap it.
 */
const level: Partial<Record<HoverTarget, number>> = {};

const HINT_ORDER: HoverTarget[] = ['about', 'experience', 'contact', 'toolkit', 'jet', 'lamp'];
const HINT_STEP = 0.35;
const HINT_LEN = 0.7;
const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

export function hoverAmount(target: HoverTarget): number {
  return level[target] ?? 0;
}

function hint(target: HoverTarget, since: number): number {
  const i = HINT_ORDER.indexOf(target);
  const t = (since - i * HINT_STEP) / HINT_LEN;
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) * 0.8 : 0;
}

let introEndedAt: number | null = null;
const TARGETS: HoverTarget[] = ['about', 'experience', 'toolkit', 'contact', 'lamp', 'jet'];

/** Mount once in the scene: advances every highlight level each frame. */
export function HoverDriver() {
  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime;
    if (introEndedAt === null && isIntroDone()) introEndedAt = now + 0.4;
    const since = introEndedAt === null ? -1 : now - introEndedAt;
    const hinting = touch && !sceneState.reducedMotion && since > 0 && since < HINT_ORDER.length * HINT_STEP + HINT_LEN;
    const k = sceneState.reducedMotion ? 1 : Math.min(1, delta * 12);
    for (const t of TARGETS) {
      const goal = sceneState.hover === t ? 1 : hinting ? hint(t, since) : 0;
      const cur = level[t] ?? 0;
      level[t] = cur + (goal - cur) * k;
    }
  });
  return null;
}
