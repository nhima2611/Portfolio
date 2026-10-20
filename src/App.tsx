import { Suspense, useCallback, useRef } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { useGlobalInput } from './hooks/useGlobalInput';
import { useScrollStops } from './hooks/useScrollStops';
import { DeskScene } from './scene/DeskScene';
import { sceneState } from './scene/state';
import { Nav } from './ui/Nav';
import { Sections } from './ui/Sections';

export default function App() {
  const reduce = sceneState.reducedMotion;
  // With reduced motion the canvas renders on demand, so nudge it on scroll.
  const root = useRef<RootState | null>(null);
  const invalidate = useCallback(() => {
    if (reduce) root.current?.invalidate();
  }, [reduce]);

  const active = useScrollStops(invalidate);
  useGlobalInput();

  return (
    <>
      <div className="scene" aria-label="A night-time desk with a monitor, laptop, bookshelf, a model jet and a phone. Click an object to jump to its section.">
        <Canvas
          shadows
          flat
          dpr={[1, 1.75]}
          frameloop={reduce ? 'demand' : 'always'}
          camera={{ fov: 40, near: 0.02, far: 30, position: [3.3, 2.35, 3.9] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={(state) => (root.current = state)}
        >
          <Suspense fallback={null}>
            <DeskScene />
          </Suspense>
        </Canvas>
      </div>
      <Nav active={active} />
      <main className="page">
        <Sections />
      </main>
    </>
  );
}
