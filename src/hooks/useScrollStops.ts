import { useEffect, useState } from 'react';
import { sceneState } from '../scene/state';

/**
 * Maps scroll position to a fractional stop index (written to sceneState for the camera)
 * and returns the nearest whole stop for the nav. React only re-renders when the nearest stop changes.
 */
export function useScrollStops(onChange?: () => void): number {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let centres: number[] = [];
    const measure = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stop]'));
      centres = sections.map((s) => s.offsetTop + s.offsetHeight / 2 - window.innerHeight / 2);
    };
    const read = () => {
      const y = window.scrollY;
      let p = centres.length - 1;
      if (y <= centres[0]) p = 0;
      else {
        for (let i = 0; i < centres.length - 1; i++) {
          if (y < centres[i + 1]) {
            p = i + (y - centres[i]) / (centres[i + 1] - centres[i]);
            break;
          }
        }
      }
      sceneState.progress = p;
      setActive(Math.round(p));
      onChange?.();
    };
    const onResize = () => {
      measure();
      read();
    };

    measure();
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', onResize);
    };
  }, [onChange]);

  return active;
}
