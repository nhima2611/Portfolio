import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { INTRO_CAMERA, STOPS } from './config';
import { easeInOutCubic, introElapsed, introPower, isIntroDone, sceneState } from './state';

const MOBILE_BREAKPOINT = 860;

function sampleStops(progress: number) {
  const i = Math.min(STOPS.length - 2, Math.floor(progress));
  const t = easeInOutCubic(Math.min(1, Math.max(0, progress - i)));
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const mix = (x: number[], y: number[]) => x.map((v, k) => v + (y[k] - v) * t) as [number, number, number];
  return { position: mix(a.position, b.position), target: mix(a.target, b.target), shift: a.shift + (b.shift - a.shift) * t };
}

/**
 * Drives the camera from scroll progress (sceneState.progress).
 * During the intro it dollies in from INTRO_CAMERA; afterwards it eases toward the current stop
 * with a little pointer parallax. A horizontal view offset keeps objects clear of the text panels.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const wide = size.width > MOBILE_BREAKPOINT;

  const state = useMemo(
    () => ({
      pos: new THREE.Vector3(...INTRO_CAMERA),
      target: new THREE.Vector3(...STOPS[0].target),
      shift: STOPS[0].shift,
      tmp: new THREE.Vector3(),
      smooth: { x: 0, y: 0 },
    }),
    [],
  );

  useEffect(() => {
    camera.fov = wide ? 40 : 52;
    camera.updateProjectionMatrix();
  }, [camera, wide]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const stop = sampleStops(sceneState.progress);
    const reduce = sceneState.reducedMotion;
    const follow = reduce ? 1 : Math.min(1, dt * 4);

    const p = sceneState.pointer;
    state.smooth.x += (p.x - state.smooth.x) * (reduce ? 1 : 0.05);
    state.smooth.y += (p.y - state.smooth.y) * (reduce ? 1 : 0.05);
    const parallax = reduce ? 0 : 1;

    if (!isIntroDone()) {
      const b = easeInOutCubic(introPower(introElapsed()).camera);
      state.pos.set(...INTRO_CAMERA).lerp(state.tmp.set(...stop.position), b);
      state.target.set(...stop.target);
    } else {
      state.tmp.set(
        stop.position[0] + state.smooth.x * 0.08 * parallax,
        stop.position[1] - state.smooth.y * 0.05 * parallax,
        stop.position[2],
      );
      state.pos.lerp(state.tmp, follow);
      state.target.lerp(state.tmp.set(...stop.target), follow);
    }
    state.shift += ((wide ? stop.shift : 0) - state.shift) * follow;

    camera.position.copy(state.pos);
    camera.lookAt(state.target);

    const { width, height } = size;
    if (Math.abs(state.shift) > 0.001) camera.setViewOffset(width, height, state.shift * width, 0, width, height);
    else if (camera.view) camera.clearViewOffset();
  });

  return null;
}
