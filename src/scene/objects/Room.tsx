import { DESK_TOP } from '../config';

const LEGS: [number, number][] = [[-0.75, -0.36], [1.05, -0.36], [-0.75, 0.36], [1.05, 0.36]];

/** Floor, walls, desk, desk mat and plant: the static set. */
export function Room() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1a1d26" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.5, -0.5]} receiveShadow>
        <planeGeometry args={[12, 5]} />
        <meshStandardMaterial color="#232838" roughness={0.9} />
      </mesh>
      <mesh position={[-1.6, 2.5, 1.5]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[6, 5]} />
        <meshStandardMaterial color="#1e2232" roughness={0.9} />
      </mesh>

      {/* Desk */}
      <mesh position={[0.15, DESK_TOP - 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.05, 0.85]} />
        <meshStandardMaterial color="#6b4a33" roughness={0.7} flatShading />
      </mesh>
      {LEGS.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.365, z]} castShadow>
          <boxGeometry args={[0.05, 0.73, 0.05]} />
          <meshStandardMaterial color="#2a2e38" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0.1, DESK_TOP + 0.002, 0.18]} receiveShadow>
        <boxGeometry args={[0.9, 0.004, 0.36]} />
        <meshStandardMaterial color="#2f3446" roughness={0.95} />
      </mesh>

      <Plant />
    </group>
  );
}

function Plant() {
  const leaves = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2);
  return (
    <group position={[0.98, DESK_TOP, -0.22]}>
      <mesh position-y={0.05} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.045, 0.1, 10]} />
        <meshStandardMaterial color="#8a5a44" roughness={0.9} flatShading />
      </mesh>
      {leaves.map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * 0.03, 0.165, Math.sin(a) * 0.03]}
          rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}
          castShadow
        >
          <coneGeometry args={[0.025, 0.2, 5]} />
          <meshStandardMaterial color="#3f6b4a" roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}
