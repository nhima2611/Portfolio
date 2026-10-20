import { useMemo } from 'react';
import { createSlab } from '../geometry';

const FABRIC = { color: '#262a35', roughness: 0.95 } as const;
const FRAME = { color: '#1a1d24', roughness: 0.4, metalness: 0.6 } as const;

/** Office chair pushed back to the front-right corner, clear of the desk runway's approach path. */
export function Chair() {
  const seat = useMemo(() => createSlab(0.46, 0.44, 0.07, 0.06), []);
  const back = useMemo(() => {
    const g = createSlab(0.44, 0.5, 0.05, 0.08);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  return (
    <group position={[1.45, 0, 1.0]} rotation-y={-0.8}>
      {/* Five-star base with casters */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[0.15, 0.06, 0]} rotation-z={0.08} castShadow>
              <boxGeometry args={[0.3, 0.025, 0.04]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[0.29, 0.025, 0]} castShadow>
              <sphereGeometry args={[0.025, 10, 8]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
          </group>
        );
      })}
      <mesh position-y={0.24} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.34, 12]} />
        <meshStandardMaterial {...FRAME} />
      </mesh>

      <mesh geometry={seat} position-y={0.42} castShadow receiveShadow>
        <meshStandardMaterial {...FABRIC} />
      </mesh>

      {/* Backrest on a curved spine */}
      <mesh position={[0, 0.5, 0.23]} rotation-x={-0.2} castShadow>
        <boxGeometry args={[0.05, 0.2, 0.025]} />
        <meshStandardMaterial {...FRAME} />
      </mesh>
      <mesh geometry={back} position={[0, 0.79, 0.27]} rotation-x={-0.12} castShadow receiveShadow>
        <meshStandardMaterial {...FABRIC} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position-x={side * 0.25}>
          <mesh position={[0, 0.54, 0.02]} castShadow>
            <boxGeometry args={[0.025, 0.14, 0.025]} />
            <meshStandardMaterial {...FRAME} />
          </mesh>
          <mesh position={[0, 0.615, 0.0]} castShadow>
            <boxGeometry args={[0.06, 0.02, 0.24]} />
            <meshStandardMaterial {...FRAME} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
