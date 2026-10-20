import { useEffect } from 'react';
import { sceneState, skipIntro } from '../scene/state';

/** Tracks the pointer for parallax and lets any user input skip the intro. */
export function useGlobalInput() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      sceneState.pointer.x = e.clientX / window.innerWidth - 0.5;
      sceneState.pointer.y = e.clientY / window.innerHeight - 0.5;
    };
    const skip = () => skipIntro();
    const skipEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

    window.addEventListener('pointermove', move, { passive: true });
    skipEvents.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
    return () => {
      window.removeEventListener('pointermove', move);
      skipEvents.forEach((ev) => window.removeEventListener(ev, skip));
    };
  }, []);
}
