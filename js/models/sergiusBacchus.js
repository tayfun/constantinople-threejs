import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cypress, hipRoof, judasTree, placeOnCircle, pyramid } from './lib/primitives.js';
import { apse, doorOn, drum, leadDome, materials as K, windowsOn } from './lib/churchKit.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Church of Sts Sergius and Bacchus (527–536), "Little Hagia Sophia",
 * built by Justinian and Theodora beside the palace of Hormisdas, south-west
 * of the Hippodrome: an octagon of piers and columns inside a nearly square
 * brick shell, under a low lead roof; over the octagon a drum and a
 * sixteen-sided "umbrella" dome, its ribs alternating flat and curved
 * inside, with buttresses standing at the drum's corners; a narthex across
 * the west and a three-sided apse to the east. The shell is in truth a
 * little skewed, and the Ottoman portico and minaret are left out. Apse to
 * the east (+x), south is +z; origin = middle of the octagon at ground level.
 */
export function createSergiusBacchus({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const { brick, lead } = K;

  // The shell: brick walls laced with stone, a plinth and cornice of stone, a low hipped roof of lead.
  church.add(box(31, 13, 33, brick, 0, 0, 0));
  church.add(box(31.8, 1.4, 33.8, M.stone, 0, 0, 0));
  church.add(box(31.8, 0.8, 33.8, M.stone, 0, 12.6, 0));
  church.add(hipRoof(31.6, 33.6, 2.6, lead, 0, 13.4, 0, 0.3));
  for (const side of [-1, 1]) {
    const face = side > 0 ? '+z' : '-z';
    windowsOn(church, face, side * 16.5, 0, { count: 4, spacing: 7, width: 1.8, height: 3.2, y: 3 });
    windowsOn(church, face, side * 16.5, 0, { count: 4, spacing: 7, width: 2.1, height: 3.6, y: 8 });
    windowsOn(church, '+x', 15.5, side * 11.5, { count: 1, spacing: 0, width: 2, height: 3.6, y: 7.5 });
  }

  // The drum over the octagon, a window in each face and a buttress at each corner under a lead cap.
  const top = drum(church, { y: 14.6, radius: 10.2, height: 4.4, sides: 8, material: brick, window: [2.2, 2.8], cornice: M.stone });
  for (let k = 0; k < 8; k++) {
    // The drum's corners lie at half steps between the faces, which centre on the axes.
    const angle = Math.PI / 2 - ((k + 0.5) / 8) * Math.PI * 2;
    const buttress = placeOnCircle(box(2.2, 4.2, 2.6, brick), angle, 10.4, 14.6);
    church.add(buttress);
    const cap = placeOnCircle(pyramid(2.6, 3, 1, lead), angle, 10.4, 18.8);
    church.add(cap);
  }
  leadDome(church, { y: top, radius: 9.7, heightScale: 0.34, segments: detail ? 32 : 16, ribs: 16, ribSegments: detail ? 8 : 4 });

  // The narthex across the west front, a little narrower than the shell so their flanks never share a
  // plane, and the apse.
  church.add(box(6.55, 11, 32.6, brick, -18.7, 0, 0));
  church.add(box(7.3, 0.7, 33.4, M.stone, -18.7, 10.6, 0));
  church.add(box(7.1, 0.5, 33.2, lead, -18.7, 11.3, 0));
  for (const z of [-7, 0, 7]) doorOn(church, '-x', -21.975, z, { width: 2.4, height: 4.6 });
  windowsOn(church, '-x', -21.975, 0, { count: 4, spacing: 7, width: 1.6, height: 2.8, y: 6.6 });
  apse(church, { x: 15.5, radius: 5.6, height: 11, sides: 3, material: brick, windows: [1.6, 3.6, 4], roof: 0.55 });

  if (detail) {
    church.add(box(66, 1, 52, M.paving, -2, -1, 0));
    for (const [x, z] of [[24, 20], [-26, 22], [28, -18], [-28, -22], [6, 23], [-12, -23]]) church.add(cypress(12, x, 0, z));
    church.add(judasTree(8, 22, 0, 6, { seed: 5 }));
  } else {
    church.add(box(50, 0.4, 40, M.paving, -2, -0.4, 0));
  }
  return finalizeModel(church);
}
