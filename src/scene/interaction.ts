import type { ThreeEvent } from '@react-three/fiber';
import type { SectionId } from './config';
import { sceneState } from './state';

export function scrollToSection(id: SectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: sceneState.reducedMotion ? 'auto' : 'smooth' });
}

/** Pointer props that make a mesh jump to its section on click. */
export function linkTo(id: SectionId) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      scrollToSection(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}
