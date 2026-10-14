import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, colonnade, cypress, domeGeometry, judasTree, mesh } from './lib/primitives.js';
import { apse, doorOn, drum, leadDome, materials as K, windowsOn } from './lib/churchKit.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt } from './lib/parts.js';

/**
 * St Irene (Hagia Eirene), the church of Holy Peace just north of Hagia
 * Sophia, as rebuilt after the earthquake of 740: a domed basilica of brick
 * laced with bands of stone, its galleried naos under lead, the main dome on
 * a tall drum of twenty windows between pilasters over the eastern bay, a
 * low elliptical dome over the western one, buttresses along the flanks, a
 * three-sided apse, the narthex and the colonnaded atrium to the west.
 * Apse to the east (+x), south is +z; origin = middle of the naos at ground
 * level. Proportions follow the surviving church (about 100 m from the
 * atrium's west wall to the apse); the atrium's colonnades are simplified.
 */
export function createStIrene({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const { brick, lead } = K;

  // The naos with its aisles and galleries: a stone plinth, a cornice, and a low lead roof.
  church.add(box(42, 18, 32, brick, 0, 0, 0));
  church.add(box(42.8, 1.6, 32.8, M.stone, 0, 0, 0));
  church.add(box(42.8, 0.8, 32.8, M.stone, 0, 17.6, 0));
  church.add(box(42.6, 0.6, 32.6, lead, 0, 18.4, 0));

  // Buttresses carry the vaults' thrust down the flanks, between the windows.
  for (const x of [-12, 0, 12]) {
    for (const side of [-1, 1]) church.add(box(2.6, 17.2, 2.2, brick, x, 0, side * 17.05));
  }
  for (const side of [-1, 1]) {
    const face = side > 0 ? '+z' : '-z';
    windowsOn(church, face, side * 16, 0, { count: 6, spacing: 6, width: 1.8, height: 3.2, y: 3 });
    windowsOn(church, face, side * 16, 0, { count: 6, spacing: 6, width: 2.6, height: 5, y: 10 });
    windowsOn(church, '+x', 21, side * 12, { count: 1, spacing: 0, width: 2.2, height: 4.4, y: 11 });
  }

  // The eastern bay: the walls of the great arches rising over the roof, the drum and the dome.
  church.add(box(19, 5, 19, brick, 7, 18.8, 0));
  church.add(box(19.8, 0.7, 19.8, M.stone, 7, 23.5, 0));
  const top = drum(church, {
    x: 7, y: 24, radius: 8.3, height: 5.6, sides: 20, material: brick, window: [1.5, 3.2],
    pilasters: { width: 1.1, depth: 0.9, material: brick }, cornice: K.plaster,
  });
  leadDome(church, { x: 7, y: top, radius: 8.7, heightScale: 0.3, segments: detail ? 40 : 24 });

  // The western bay, vaulted after 740 with a low elliptical dome, longer north to south.
  church.add(box(16, 3, 19, brick, -11, 18.8, 0));
  church.add(box(16.8, 0.6, 19.8, M.stone, -11, 21.5, 0));
  const vault = mesh(domeGeometry(7.6, { heightScale: 0.32, segments: detail ? 32 : 20 }), lead, -11, 22.1, 0);
  vault.scale.set(1, 1, 1.2);
  church.add(vault);

  // The apse: three-sided outside, lit by a window in each face.
  apse(church, { x: 21, radius: 8, height: 15, sides: 3, material: brick, windows: [2.2, 5, 4], roof: 0.5 });

  // The narthex across the west front, its doors opening to the atrium.
  church.add(box(7.1, 15, 30, brick, -24.45, 0, 0));
  church.add(box(7.9, 0.7, 30.8, M.stone, -24.45, 14.6, 0));
  church.add(box(7.7, 0.6, 30.6, lead, -24.45, 15.3, 0));
  for (const z of [-7, 0, 7]) doorOn(church, '-x', -28, z, { width: 2.6, height: 5 });
  windowsOn(church, '-x', -28, 0, { count: 5, spacing: 5.5, width: 1.8, height: 3.2, y: 8.5 });

  addAtrium(church, detail);
  labelAt(church, 'ireneAtrium', -44, 9, 0);

  if (detail) {
    church.add(box(124, 1, 66, M.paving, -18, -1, 0));
    for (const [x, z] of [[30, 26], [14, 27], [-4, 27], [32, -25], [10, -27], [-22, -27], [-64, 26], [-66, -24], [38, 6]]) church.add(cypress(13, x, 0, z));
    church.add(judasTree(9, 24, 0, -24, { seed: 7 })); // one erguvan in flower: each costs some 25,000 triangles
  } else {
    church.add(box(93, 0.4, 36, M.paving, -15.5, -0.4, 0));
  }
  return finalizeModel(church);
}

/**
 * The atrium before the narthex: brick walls round a court with lead-roofed
 * porticoes on three sides. The west portico's roof lies a shade lower than
 * the side ones it runs under, the side walls stop short of the narthex, and
 * no two walls share a face.
 */
function addAtrium(church, detail) {
  const [west, east] = [-60, -28.5];
  const length = east - west;
  const middle = (west + east) / 2;
  church.add(box(1.5, 7, 34.2, K.brick, west + 0.75, 0, 0));
  for (const side of [-1, 1]) {
    // The side walls and their roofs start inside the west wall and stand a little lower than it.
    church.add(box(length - 0.2, 6.9, 1.5, K.brick, middle + 0.1, 0, side * 16.25));
    church.add(box(length - 0.2, 0.5, 6, K.lead, middle + 0.1, 6.8, side * 13));
    const columns = colonnade({ length: length - 6, count: detail ? 9 : 6, height: 6.8, radius: 0.4 });
    columns.position.set(middle + 1.5, 0, side * 10.4);
    church.add(columns);
  }
  church.add(box(6, 0.5, 21, K.lead, west + 4.5, 6.6, 0));
  const westColumns = colonnade({ length: 18, count: detail ? 6 : 4, height: 6.6, radius: 0.4 });
  westColumns.rotation.y = Math.PI / 2;
  westColumns.position.x = west + 7.4;
  church.add(westColumns);
}
