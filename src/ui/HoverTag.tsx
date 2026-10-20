import { useEffect, useRef } from 'react';
import { hoverLabel } from '../scene/interaction';
import { sceneState } from '../scene/state';

/** Small label that follows the pointer while it is over something clickable on the desk. Mouse only. */
export function HoverTag() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;
    let x = 0;
    let y = 0;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const t = sceneState.hover;
      const label = t ? hoverLabel(t) : '';
      if (el.textContent !== label) el.textContent = label;
      el.classList.toggle('on', t !== null);
      el.style.transform = `translate3d(${x + 16}px, ${y + 18}px, 0)`;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      queue();
    };
    // Labels like "Lights off" change on click, and the scene stops reporting hover once the camera scrolls away.
    const refresh = () => queue();
    const hide = () => {
      sceneState.hover = null;
      document.body.style.cursor = '';
      queue();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('click', refresh);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('click', refresh);
      window.removeEventListener('scroll', hide);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="hover-tag" aria-hidden="true" />;
}
