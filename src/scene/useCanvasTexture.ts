import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * A CanvasTexture drawn by `draw`. Redraws once web fonts are ready.
 * Call `redraw()` whenever the content changes (e.g. a blinking cursor).
 */
export function useCanvasTexture(width: number, height: number, draw: DrawFn) {
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [width, height]);

  const redraw = useCallback(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawRef.current(ctx, width, height);
    texture.needsUpdate = true;
  }, [texture, width, height]);

  useEffect(() => {
    redraw();
    let alive = true;
    document.fonts?.ready.then(() => alive && redraw());
    return () => {
      alive = false;
      texture.dispose();
    };
  }, [redraw, texture]);

  return { texture, redraw };
}

/** Toggles a cursor flag every `ms` and calls `onTick`. Disabled under reduced motion. */
export function useBlink(ms: number, onTick: () => void, enabled: boolean) {
  const on = useRef(true);
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      on.current = !on.current;
      tick.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
  return on;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A soft white radial dot, for steam puffs and dust motes. */
export function useSoftDot() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}
