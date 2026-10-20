import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toolkit } from '../../content/profile';
import { LIGHTS } from '../config';
import { hoverAmount } from '../hover';
import { linkTo } from '../interaction';
import { drawSpine } from '../screens';
import { introElapsed, introPower, sceneState } from '../state';

const SHELF_X: [number, number] = [0.94, 1.62];
const LOWER_SHELF_TOP = 1.3925;

interface BookLayout {
  name: string;
  color: string;
  w: number;
  h: number;
  x: number;
}

/** Books are the toolkit items that have a `spine` colour in content/profile.ts. */
function useBooks(): BookLayout[] {
  return useMemo(() => {
    const out: BookLayout[] = [];
    let x = SHELF_X[0];
    for (const group of toolkit) {
      for (const tool of group.items) {
        if (!tool.spine) continue;
        const h = 0.2 + ((tool.name.length * 7) % 5) * 0.012;
        const w = 0.032 + (tool.name.length % 3) * 0.006;
        if (x + w > SHELF_X[1]) return out;
        out.push({ name: tool.name, color: tool.spine, w, h, x: x + w / 2 });
        x += w + 0.004;
      }
    }
    return out;
  }, []);
}

function Book({ book }: { book: BookLayout }) {
  const materials = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const paint = () => {
      drawSpine(canvas.getContext('2d')!, 64, 512, book.name, book.color);
      tex.needsUpdate = true;
    };
    paint();
    document.fonts?.ready.then(paint);
    const cover = new THREE.MeshStandardMaterial({ color: book.color, roughness: 0.8 });
    const pages = new THREE.MeshStandardMaterial({ color: '#e9e2d0', roughness: 0.9 });
    const spine = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: book.color, emissiveIntensity: 0 });
    // BoxGeometry face order: +x, -x, +y, -y, +z (spine, facing the room), -z
    return [cover, cover, pages, pages, spine, cover];
  }, [book.name, book.color]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  // The whole row glows when any book is hovered; the book under the pointer also slides out a little.
  const mesh = useRef<THREE.Mesh>(null);
  const mine = useRef(false);
  const out = useRef(0);
  const link = linkTo('toolkit');
  useFrame((_, delta) => {
    const k = sceneState.reducedMotion ? 1 : Math.min(1, delta * 12);
    out.current += ((mine.current ? 1 : 0) - out.current) * k;
    if (mesh.current) mesh.current.position.z = -0.38 + out.current * 0.035;
    (materials[4] as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 * hoverAmount('toolkit');
  });

  return (
    <mesh
      ref={mesh}
      position={[book.x, LOWER_SHELF_TOP + book.h / 2, -0.38]}
      material={materials}
      castShadow
      receiveShadow
      onClick={link.onClick}
      onPointerOver={(e) => {
        link.onPointerOver(e);
        mine.current = true;
      }}
      onPointerOut={() => {
        link.onPointerOut();
        mine.current = false;
      }}
    >
      <boxGeometry args={[book.w, book.h, 0.16]} />
    </mesh>
  );
}

export function Bookshelf() {
  const books = useBooks();
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (light.current) light.current.intensity = LIGHTS.shelf * introPower(introElapsed()).shelf;
  });

  return (
    <group>
      {[1.38, 1.74].map((y) => (
        <mesh key={y} position={[1.35, y, -0.39]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.025, 0.22]} />
          <meshStandardMaterial color="#4e3726" roughness={0.75} flatShading />
        </mesh>
      ))}
      {books.map((b) => (
        <Book key={b.name} book={b} />
      ))}
      <pointLight ref={light} position={[1.3, 1.65, -0.1]} color="#ffd7a8" intensity={0} distance={1.2} decay={2} />
    </group>
  );
}
