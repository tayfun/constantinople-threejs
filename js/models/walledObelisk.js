import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Walled Obelisk: a 32 m obelisk of rough-cut stone at the south end of
 * the spina. Constantine VII Porphyrogennetos restored it in the 10th
 * century and sheathed it in gilded bronze plates, which the Fourth
 * Crusaders stripped and melted down in 1204.
 */
export function createWalledObelisk() {
  const monument = new THREE.Group();
  monument.add(box(7.2, 0.6, 7.2, M.marble, 0, 0, 0));
  monument.add(box(6, 3.2, 6, M.marble, 0, 0.6, 0));
  monument.add(box(6.4, 0.4, 6.4, M.marble, 0, 3.8, 0));

  const height = 27;
  const toRadius = (side) => side / Math.SQRT2;
  const shaft = new THREE.CylinderGeometry(toRadius(2.6), toRadius(4.4), height, 4, 1).rotateY(Math.PI / 4).translate(0, height / 2, 0);
  // Metre-based UVs around the four faces so the bronze plates keep their size.
  const uv = shaft.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * height);
  monument.add(mesh(shaft, M.gildedBronze, 0, 4.2, 0));

  const tip = new THREE.ConeGeometry(toRadius(2.6), 2.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0);
  monument.add(mesh(tip, M.gold, 0, 4.2 + height, 0));
  return finalizeModel(monument);
}
