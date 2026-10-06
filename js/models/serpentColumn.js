import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Serpent Column: three intertwined bronze serpents cast in 479 BC from
 * the arms of the Persians defeated at Plataea, dedicated at Delphi and
 * brought to the Hippodrome by Constantine. The heads were still in place
 * in Byzantine times (they were broken off around 1700).
 */
export function createSerpentColumn({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const monument = new THREE.Group();
  monument.add(box(3.2, 0.5, 3.2, M.marble, 0, 0, 0));
  monument.add(box(2.4, 1.3, 2.4, M.marble, 0, 0.5, 0));

  const height = 5.6;
  const turns = 6.5;
  const base = 1.8;
  for (let s = 0; s < 3; s++) {
    const phase = (s / 3) * Math.PI * 2;
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const angle = phase + t * turns * Math.PI * 2;
      const radius = 0.32 * (1 - t * 0.25);
      points.push(new THREE.Vector3(Math.cos(angle) * radius, base + t * height, Math.sin(angle) * radius));
    }
    // The neck sweeps outwards and up to the head.
    const top = points.at(-1);
    const outward = new THREE.Vector3(Math.cos(phase), 0, Math.sin(phase));
    const neck = [
      top,
      top.clone().addScaledVector(outward, 0.35).add(new THREE.Vector3(0, 0.5, 0)),
      top.clone().addScaledVector(outward, 0.9).add(new THREE.Vector3(0, 0.95, 0)),
      top.clone().addScaledVector(outward, 1.35).add(new THREE.Vector3(0, 1.0, 0)),
    ];
    const curve = new THREE.CatmullRomCurve3([...points, ...neck.slice(1)]);
    monument.add(mesh(new THREE.TubeGeometry(curve, detail ? 260 : 90, 0.2, detail ? 10 : 6), M.bronze));

    const head = mesh(new THREE.SphereGeometry(1, 12, 8), M.bronze);
    head.position.copy(neck.at(-1)).addScaledVector(outward, 0.25);
    head.scale.set(0.3, 0.2, 0.48);
    head.lookAt(head.position.clone().add(outward).add(new THREE.Vector3(0, -0.2, 0)));
    monument.add(head);
  }
  return finalizeModel(monument);
}
