import * as THREE from 'three';

/** Rounded slab: width (x) by depth (z), total height h along +y starting at y = 0. */
export function createSlab(w: number, d: number, h: number, r: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);

  const bevel = h * 0.18;
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: Math.min(r * 0.25, h * 0.3),
    bevelSegments: 3,
    curveSegments: 8,
  });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  return g;
}

function flatPart(points: [number, number][], depth: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([px, py]) => s.lineTo(px, py));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * Original low-poly twin-engine jet (≈ 6 units long, nose towards -z).
 * Swap for a licensed GLB later via useGLTF without touching the rest of the scene.
 */
export function createJet(skin: THREE.Material, glass: THREE.Material): THREE.Group {
  const jet = new THREE.Group();

  const profile = [[0, 0], [0.06, 0.15], [0.2, 0.6], [0.3, 1.1], [0.38, 1.7], [0.46, 2.4], [0.5, 3.4], [0.5, 4.6], [0.44, 5.6], [0.38, 6]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const fuselage = new THREE.LatheGeometry(profile, 10);
  fuselage.rotateX(Math.PI / 2);
  fuselage.translate(0, 0, -3);
  fuselage.scale(1.25, 0.72, 1);
  jet.add(new THREE.Mesh(fuselage, skin));

  const mirrored = (g: THREE.BufferGeometry) => {
    jet.add(new THREE.Mesh(g, skin));
    const left = g.clone();
    left.scale(-1, 1, 1);
    jet.add(new THREE.Mesh(left, skin));
  };
  mirrored(flatPart([[0.3, -2.0], [0.62, -0.3], [3.1, 1.75], [3.15, 2.2], [0.5, 2.45]], 0.06)); // wing
  mirrored(flatPart([[0.45, 2.5], [1.75, 3.15], [1.8, 3.55], [0.5, 3.45]], 0.05)); // tailplane

  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.25, 0);
    s.lineTo(1.55, 1.35);
    s.lineTo(1.05, 1.4);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    const fin = new THREE.Mesh(g, skin);
    fin.position.set(side * 0.5, 0.2, 1.75);
    fin.rotation.z = -side * 0.22;
    jet.add(fin);
  }

  const canopy = new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  canopy.scale(0.9, 0.85, 2.6);
  canopy.translate(0, 0.2, -1.55);
  jet.add(new THREE.Mesh(canopy, glass));

  return jet;
}
