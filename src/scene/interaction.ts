import type { ThreeEvent } from '@react-three/fiber';
import { JET_STOP, SECTION_LABELS, type SectionId } from './config';
import { blip, isSoundOn } from '../lib/sound';
import { PANELS_BACK_AT } from './flight';
import { isLampOn, jetFlight, launchJet, sceneState, type HoverTarget } from './state';

/**
 * Jumps straight to a section. The page moves instantly and the camera eases directly to the new stop;
 * a smooth scroll would drag the camera through every stop in between.
 */
export function scrollToSection(id: SectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'auto' });
}

/** True when the camera is parked at the jet, so a click should launch it rather than scroll. */
export function atJetStop(): boolean {
  return Math.abs(sceneState.progress - JET_STOP) < 0.5;
}

/** Sends the jet round the room (click at its stop, the Launch button, `jet` in the terminal). The text panels fade while it flies. */
export function launchJetWithSound(startAt = 0): boolean {
  const ok = launchJet(startAt);
  if (!ok) return false;
  blip('whoosh');
  const root = document.documentElement;
  root.classList.add('in-flight');
  window.setTimeout(() => root.classList.remove('in-flight'), (PANELS_BACK_AT() - startAt) * 1000);
  return true;
}

/** Text for the tag that follows the pointer. */
export function hoverLabel(target: HoverTarget): string {
  if (target === 'lamp') return isLampOn() ? 'Lights off' : 'Lights on';
  if (target === 'headphones') return isSoundOn() ? 'Sound off' : 'Sound on';
  if (target === 'duck') return 'Quack';
  if (target === 'launcher') return 'Launch S-400';
  if (target === 'jet') {
    if (sceneState.reducedMotion) return atJetStop() ? 'Parked' : `${SECTION_LABELS['off-duty']} →`;
    return jetFlight() === null ? 'Launch ✈' : 'In flight';
  }
  return `${SECTION_LABELS[target]} →`;
}

/** Pointer props that mark a mesh as `target` and run `onClick` when it is clicked. */
export function interactive(target: HoverTarget, onClick: () => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      sceneState.hover = target;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      if (sceneState.hover === target) sceneState.hover = null;
      document.body.style.cursor = '';
    },
  };
}

/** Pointer props that make a mesh jump to its section on click. */
export function linkTo(id: SectionId) {
  return interactive(id, () => scrollToSection(id));
}
