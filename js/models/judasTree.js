import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cylinder, cylinderGeometry, judasTree, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Judas tree, erguvan (Cercis siliquastrum), in flower in a corner of
 * the palace gardens: an old tree of several stems over a carpet of fallen
 * petals, two young ones beside it, a marble bench and a capital left lying
 * in the grass. On the map it is the tree alone, standing in the gardens of
 * the Great Palace. Sizes in metres; a grown tree is some 7–8 m tall and as
 * broad.
 */

const GROUND = 0.5; // the lawn's height above the base of the plot
const RADIUS = 10;

export function createJudasTree({ lod = 'detail' } = {}) {
  const garden = new THREE.Group();
  if (lod !== 'detail') {
    garden.add(judasTree(7.5, 0, 0, 0, { detail: false, seed: 1 }));
    return finalizeModel(garden);
  }

  // A round plot: a stone kerb, a paved walk round its edge, and the lawn.
  garden.add(cylinder(RADIUS + 0.4, RADIUS + 0.6, GROUND - 0.1, M.stone, 0, 0, 0, 64));
  garden.add(mesh(new THREE.RingGeometry(RADIUS - 1.4, RADIUS + 0.4, 64).rotateX(-Math.PI / 2), M.paving, 0, GROUND - 0.08, 0));
  garden.add(mesh(new THREE.CircleGeometry(RADIUS - 1.4, 64).rotateX(-Math.PI / 2), M.grass, 0, GROUND - 0.06, 0));

  garden.add(judasTree(8, -0.8, GROUND, 0.4, { seed: 1 }));
  garden.add(judasTree(4.2, 5.2, GROUND, -4.4, { seed: 5 }));
  garden.add(judasTree(3.6, -5.8, GROUND, -3.6, { seed: 9 }));

  // A marble bench on the walk, facing the old tree.
  const bench = new THREE.Group();
  bench.add(box(2.6, 0.12, 0.7, M.marble, 0, 0.42, 0));
  for (const x of [-1, 1]) bench.add(box(0.22, 0.42, 0.6, M.marble, x, 0, 0));
  bench.position.set(3.6, GROUND - 0.08, 6.4);
  bench.rotation.y = Math.atan2(-0.8 - 3.6, 0.4 - 6.4); // its front (+z) towards the trunk
  garden.add(bench);

  // An old Corinthian capital, fallen on its side in the grass.
  const capital = mesh(cylinderGeometry(0.42, 0.3, 0.7, 10).translate(0, -0.35, 0), M.marble); // centred, to lie on its side
  capital.position.set(-5.4, GROUND + 0.36, 4.2);
  capital.rotation.set(0, 0.6, Math.PI / 2, 'YXZ');
  garden.add(capital);

  return finalizeModel(garden);
}
