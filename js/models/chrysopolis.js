import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  box, colonnade, crenellationGeometry, cylinder, cypress, dome, faceToward, flag, gableRoof, groundPlane, hipRoof,
  landGeometry, mesh, pyramid, roundTree, windowRow,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * Chrysopolis (Üsküdar), "the city of gold", on the Asian shore facing the
 * Acropolis of Constantinople. Shown in Byzantine times: the quay where the
 * ferries from the capital put in, the walled toll post on the shore (heir
 * to the one Alcibiades set up in 410 BC), the road setting out into
 * Anatolia, a hilltop church, a palace in its gardens on the slope and,
 * offshore, the islet of Damalis with its tower. The sea lies to the west
 * (-x).
 */

const GROUND = 3;
const COAST = [
  [-40, -110], [130, -110], [130, 110], [-30, 110], [-58, 84], [-84, 62], [-84, 20], [-68, 4],
  [-66, -30], [-68, -62], [-58, -92],
];
const ROAD_Z = -12;

export function createChrysopolis({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const town = new THREE.Group();
  const rnd = createRandom(324);

  if (detail) {
    town.add(mesh(landGeometry(COAST, GROUND, 6), M.grass));
    town.add(groundPlane(380, 300, M.water, -20, 0.6, 0));
  } else {
    town.position.y = -GROUND; // stand directly on the map's land
  }

  addQuay(town);
  addTollPost(town, detail);
  addChurch(town, detail);
  addPalace(town, detail);

  // The road from the ferry landing into Anatolia, with a milestone.
  town.add(groundPlane(186, 7, M.paving, 37, GROUND + 0.03, ROAD_Z));
  town.add(cylinder(0.7, 0.8, 2.4, M.marble, 104, GROUND, ROAD_Z + 5.5, 10));

  scatterHouses(town, rnd, {
    count: detail ? 36 : 20,
    area: [-50, -100, 120, 100],
    groundAt: () => GROUND,
    avoid: [[-62, 40, 26], [40, -55, 26], [72, 42, 44], ...[-40, 0, 40, 80, 120].map((x) => [x, ROAD_Z, 7])],
  });
  for (let i = 0; i < 18; i++) {
    const tree = rnd.chance(0.55) ? cypress(rnd.range(9, 13)) : roundTree(rnd.range(7, 10));
    tree.position.set(rnd.range(-30, 125), GROUND, rnd.range(60, 105) * (i % 2 ? 1 : -1));
    town.add(tree);
  }

  finalizeModel(town);
  const banner = flag('byzantine', { width: 3.4, height: 2.2, pole: 7 });
  banner.position.set(-62, GROUND + 12, 40);
  town.add(banner);
  if (detail) {
    addDamalis(town);
    addFerries(town);
  }
  return town;
}

/** The ferry quay along the harbour shore, and a mole sheltering it from the current. */
function addQuay(town) {
  town.add(box(9, GROUND + 1, 60, M.stone, -61, -1, -30));
  const mole = box(6, GROUND + 0.6, 36, M.stone, -78, -1, -64);
  mole.rotation.y = 0.55;
  town.add(mole);
  for (const z of [-50, -30, -10]) town.add(cylinder(0.5, 0.5, 1.2, M.stoneDark, -64.5, GROUND + 0.5, z, 8));
}

/** The walled toll post on the shore, where ships out of the Black Sea paid their tithe. */
function addTollPost(town, detail) {
  const [x, z] = [-62, 40];
  const [w, d, height] = [34, 30, 7];
  for (const side of [-1, 1]) {
    town.add(box(w, height, 2.2, M.stone, x, GROUND, z + side * d / 2));
    town.add(box(2.2, height, d, M.stone, x + side * w / 2, GROUND, z));
    for (const end of [-1, 1]) town.add(box(6.5, height + 3.5, 6.5, M.stone, x + side * w / 2, GROUND, z + end * d / 2));
  }
  if (detail) {
    for (const side of [-1, 1]) {
      town.add(mesh(crenellationGeometry(w - 6), M.stone, x, GROUND + height, z + side * d / 2));
      const parapet = mesh(crenellationGeometry(d - 6), M.stone, x + side * w / 2, GROUND + height, z);
      parapet.rotation.y = Math.PI / 2;
      town.add(parapet);
    }
  }
  // The gate towards the town, and the customs house within.
  town.add(box(5, 4.5, 2.6, M.opening, x + w / 2, GROUND, z));
  town.add(box(16, 6, 10, M.plaster, x - 3, GROUND, z));
  town.add(hipRoof(16, 10, 3, M.roof, x - 3, GROUND + 6, z, 0.5));
}

/** A cross-in-square church on the hill, its apse to the east. */
function addChurch(town, detail) {
  const [x, z] = [40, -55];
  town.add(box(22, 8, 18, M.brick, x, GROUND, z));
  town.add(box(23, 11, 7, M.brick, x, GROUND, z));
  town.add(box(7, 11, 19, M.brick, x, GROUND, z));
  town.add(gableRoof(23, 7, 2.4, M.roof, x, GROUND + 11, z));
  const transept = gableRoof(19, 7, 2.4, M.roof, x, GROUND + 11, z);
  transept.rotation.y = Math.PI / 2;
  town.add(transept);
  town.add(faceToward(cylinder(3.5, 3.5, 7, M.brick, x + 11, GROUND, z, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  town.add(faceToward(dome(3.5, M.lead, x + 11, GROUND + 7, z, { phiLength: Math.PI, heightScale: 0.8 }), 1, 0));
  town.add(cylinder(3.2, 3.2, 4, M.brick, x, GROUND + 13.4, z, 12));
  town.add(dome(3.2, M.lead, x, GROUND + 17.4, z, { heightScale: 0.7 }));
  if (detail) {
    const windows = windowRow({ count: 4, spacing: 3.2, width: 0.9, height: 1.8, y: GROUND + 14.4 });
    windows.position.set(x, 0, z + 3.25);
    town.add(windows);
  }
  for (const dz of [-14, 14]) town.add(cypress(11, x - 8, GROUND, z + dz));
}

/** A palace on a terrace above the town, its loggia looking across the water to the capital. */
function addPalace(town, detail) {
  const [x, z] = [72, 42];
  const terrace = 4;
  town.add(box(70, terrace, 54, M.banded, x, GROUND - 0.5, z));
  town.add(groundPlane(70, 54, M.paving, x, GROUND + terrace - 0.47, z));
  const floor = GROUND + terrace - 0.5;

  // The hall, with a colonnaded loggia on its seaward side, and a wing behind it.
  town.add(box(16, 13, 40, M.plasterOchre, x + 8, floor, z));
  town.add(hipRoof(16, 40, 4, M.roof, x + 8, floor + 13, z, 0.6));
  const loggia = colonnade({ length: 38, count: 10, height: 6, radius: 0.45 });
  loggia.rotation.y = Math.PI / 2;
  loggia.position.set(x - 3, floor, z);
  town.add(loggia);
  town.add(box(6, 0.6, 40, M.marble, x - 3, floor + 6, z));
  town.add(box(22, 9, 12, M.plasterOchre, x + 25, floor, z - 18));
  town.add(hipRoof(22, 12, 3, M.roof, x + 25, floor + 9, z - 18, 0.5));
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 7, spacing: 5.4, width: 1.2, height: 2.4, y: floor + 8 });
      windows.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      windows.position.set(x + 8 + side * 8.05, 0, z);
      town.add(windows);
    }
  }

  // The garden: a fountain between cypresses and fruit trees.
  town.add(cylinder(3, 3.2, 0.8, M.marble, x - 20, floor, z, 16));
  town.add(cylinder(0.5, 0.6, 2.2, M.marble, x - 20, floor, z, 8));
  for (const [dx, dz] of [[-28, -18], [-28, 18], [-14, -20], [-14, 20]]) town.add(cypress(10, x + dx, floor, z + dz));
  for (const [dx, dz] of [[-24, -8], [-24, 8], [-16, -6], [-16, 8]]) town.add(roundTree(6, x + dx, floor, z + dz));
}

/** Damalis, the islet offshore, with the tower that became the Maiden's Tower. */
function addDamalis(town) {
  const [x, z] = [-128, 82];
  town.add(cylinder(11, 13, 3.4, M.stoneDark, x, -1, z, 16));
  town.add(cylinder(10.5, 10.5, 1.4, M.stone, x, 2.4, z, 16));
  town.add(cylinder(3.6, 3.8, 15, M.stone, x, 2.4, z, 12));
  town.add(cylinder(4.2, 4.2, 1, M.stone, x, 17.4, z, 12));
  town.add(pyramid(5.6, 5.6, 5, M.lead, x, 18.4, z));
  town.add(box(1.4, 2.4, 0.4, M.opening, x + 3.65, 3.8, z));
}

/** Ferries from the capital, moored at the quay and crossing the strait. */
function addFerries(town) {
  const { geometry, deck } = createHull({ length: 10, beam: 2.8, depth: 1.1, bowRise: 0.6, sternRise: 0.7, segments: 16, ribs: 8 });
  for (const [x, z, rotation, crossing] of [[-70, -40, 1.5, false], [-71, -18, 1.7, false], [-118, -30, 0.4, true]]) {
    const boat = new THREE.Group();
    boat.add(mesh(geometry, M.hull, 0, 0.6, 0), mesh(deck, M.wood, 0, 0.4, 0));
    boat.add(cylinder(0.08, 0.1, 6, M.wood, 0.8, 0.4, 0, 6));
    boat.position.set(x, 0, z);
    boat.rotation.y = rotation;
    const phase = x + z;
    boat.userData.animate = (time) => {
      boat.position.y = 0.4 + Math.sin(time * 1.3 + phase) * 0.12;
      // The third plies slowly to and fro across the strait.
      if (crossing) boat.position.z = z + Math.sin(time * 0.15) * 22;
    };
    town.add(boat);
  }
}
