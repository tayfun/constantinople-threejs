import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Obelisk of Theodosius: a granite obelisk of Thutmose III (c. 1450 BC)
 * from Karnak, re-erected in 390 AD on a marble base carved with the emperor
 * watching the races, raised on four bronze blocks. About 25 m tall.
 */
export function createObeliskOfTheodosius({ lod = 'detail' } = {}) {
  const monument = new THREE.Group();

  // Stepped plinth and the sculpted marble pedestal.
  monument.add(box(6.4, 0.6, 6.4, M.marble, 0, 0, 0));
  monument.add(box(5.6, 0.6, 5.6, M.marble, 0, 0.6, 0));
  monument.add(box(4.6, 3, 4.6, M.marble, 0, 1.2, 0));
  if (lod === 'detail') {
    // Relief panels: the emperor's court in the kathisma above kneeling envoys.
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const panel = box(3.6, 2.2, 0.16, M.stoneDark, Math.sin(angle) * 2.36, 1.6, Math.cos(angle) * 2.36);
      panel.rotation.y = angle;
      monument.add(panel);
    }
  }
  monument.add(box(4.9, 0.4, 4.9, M.marble, 0, 4.2, 0));

  // The four bronze cubes on which the shaft rests.
  for (const [x, z] of [[1.2, 1.2], [1.2, -1.2], [-1.2, 1.2], [-1.2, -1.2]]) monument.add(box(0.7, 0.6, 0.7, M.bronze, x, 4.6, z));

  // Tapering square shaft carved with hieroglyphs, and its pyramidion.
  const shaftHeight = 18.6;
  const shaft = new THREE.CylinderGeometry(1.5 / Math.SQRT2, 2.2 / Math.SQRT2, shaftHeight, 4, 1)
    .rotateY(Math.PI / 4)
    .translate(0, shaftHeight / 2, 0);
  monument.add(mesh(shaft, M.hieroglyphs, 0, 5.2, 0));
  const pyramidion = new THREE.ConeGeometry(1.5 / Math.SQRT2, 1.6, 4).rotateY(Math.PI / 4).translate(0, 0.8, 0);
  monument.add(mesh(pyramidion, M.granite, 0, 5.2 + shaftHeight, 0));

  return finalizeModel(monument);
}
