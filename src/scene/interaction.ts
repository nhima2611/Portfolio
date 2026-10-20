import type { ThreeEvent } from '@react-three/fiber';
import { JET_STOP, SECTION_LABELS, type SectionId } from './config';
import { blip } from '../lib/sound';
import { FLIGHT_LEN, isLampOn, jetFlight, launchJet, sceneState, type HoverTarget } from './state';

export function scrollToSection(id: SectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: sceneState.reducedMotion ? 'auto' : 'smooth' });
}

/** True when the camera is parked at the jet, so a click should launch it rather than scroll. */
export function atJetStop(): boolean {
  return Math.abs(sceneState.progress - JET_STOP) < 0.5;
}

/** Sends the jet round the room (click at its stop, the Launch button, `jet` in the terminal). The text panels fade while it flies. */
export function launchJetWithSound(): boolean {
  const ok = launchJet();
  if (!ok) return false;
  blip('whoosh');
  const root = document.documentElement;
  root.classList.add('in-flight');
  window.setTimeout(() => root.classList.remove('in-flight'), FLIGHT_LEN * 1000 - 600);
  return true;
}

/** Text for the tag that follows the pointer. */
export function hoverLabel(target: HoverTarget): string {
  if (target === 'lamp') return isLampOn() ? 'Lights off' : 'Lights on';
  if (target === 'jet') {
    if (!atJetStop()) return `${SECTION_LABELS['off-duty']} →`;
    if (sceneState.reducedMotion) return 'Parked';
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
