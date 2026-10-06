import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  box, colonnade, cylinder, cypress, dome, faceToward, gableRoof, groundPlane, landGeometry, mesh, roundTree,
  windowRow,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { createHull } from './lib/hull.js';
import { createEagle } from './lib/figures.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * Chalcedon (Kadıköy), the Megarian colony on the Asian shore — the "city of
 * the blind". Shown in Byzantine times: the great church of St Euphemia
 * where the Council of 451 met, the ruined temple of Apollo on the point,
 * the stumps of the walls Valens tore down in 366, and a pair of eagles —
 * the birds that, legend says, carried Constantine's builders' cords across
 * the water to Byzantium. The sea lies to the west (-x) and south (+z).
 */

const GROUND = 3;
const COAST = [
  [-40, -110], [130, -110], [130, 110], [40, 110], [10, 80], [-30, 62], [-70, 56],
  [-96, 30], [-92, 0], [-72, -22], [-62, -60], [-52, -92],
];

export function createChalcedon({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const city = new THREE.Group();
  const rnd = createRandom(685);

  if (detail) {
    city.add(mesh(landGeometry(COAST, GROUND, 6), M.grass));
    // Sea only beyond the shore: the plane's landward edges meet the land's bounds (x 130, z ±110).
    city.add(groundPlane(300, 220, M.water, -20, 0.6, 0));
    city.add(groundPlane(120, 110, M.dirt, 30, GROUND + 0.02, -35));
  } else {
    city.position.y = -GROUND; // stand directly on the map's land
  }

  addBasilica(city, detail);
  addTemple(city, rnd);
  addRuinedWalls(city, rnd);

  // The agora with its stoa.
  city.add(groundPlane(46, 30, M.paving, 50, GROUND + 0.04, 28));
  const stoa = colonnade({ length: 44, count: 12, height: 6.5, radius: 0.38 });
  stoa.position.set(50, GROUND, 18);
  city.add(stoa);
  city.add(box(46, 6.5, 1, M.stone, 50, GROUND, 13));
  city.add(box(47, 0.5, 6.5, M.roof, 50, GROUND + 6.5, 16));

  scatterHouses(city, rnd, {
    count: detail ? 40 : 22,
    area: [-40, -95, 105, 45],
    groundAt: () => GROUND,
    avoid: [[30, -22, 34], [-62, 28, 26], [50, 28, 28], [-18, -24, 14]],
  });
  for (let i = 0; i < 16; i++) {
    const tree = rnd.chance(0.6) ? cypress(rnd.range(9, 13)) : roundTree(rnd.range(7, 10));
    tree.position.set(rnd.range(-50, 110), GROUND, rnd.range(50, 100) * (i % 2 ? 1 : -0.9));
    city.add(tree);
  }

  finalizeModel(city);
  if (detail) {
    addHarbour(city);
    addEagles(city);
  }
  return city;
}

/** St Euphemia: a large basilica with the round martyrium of the saint. */
function addBasilica(city, detail) {
  const [x, z] = [32, -22];
  city.add(box(44, 9, 26, M.brick, x, GROUND, z));
  city.add(box(44, 15, 13, M.brick, x, GROUND, z));
  city.add(gableRoof(44, 13, 4, M.roof, x, GROUND + 15, z));
  city.add(box(44.6, 0.5, 26.6, M.lead, x, GROUND + 9, z));
  city.add(faceToward(cylinder(6, 6, 12, M.brick, x + 22, GROUND, z, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  city.add(faceToward(dome(6, M.lead, x + 22, GROUND + 12, z, { phiLength: Math.PI, heightScale: 0.8 }), 1, 0));
  city.add(cylinder(10, 10, 13, M.brick, x - 30, GROUND, z, 20));
  city.add(cylinder(8, 8, 3, M.brick, x - 30, GROUND + 13, z, 20));
  city.add(dome(8, M.lead, x - 30, GROUND + 16, z, { heightScale: 0.7 }));
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 8, spacing: 5, width: 1.5, height: 2.8, y: GROUND + 10.5 });
      windows.position.set(x, 0, z + side * 6.55);
      windows.rotation.y = side > 0 ? 0 : Math.PI;
      city.add(windows);
    }
  }
}

/** The temple of Apollo on the headland, roofless and half-fallen by Byzantine times. */
function addTemple(city, rnd) {
  const [x, z] = [-62, 28];
  for (let step = 0; step < 3; step++) city.add(box(22 - step * 1.2, 0.6, 38 - step * 1.2, M.marble, x, GROUND + step * 0.6, z));
  const floor = GROUND + 1.8;
  city.add(box(9, 4.5, 20, M.marble, x, floor, z));
  const marble = tinted('marble', 0xe8dfcf);
  const columns = [];
  for (let i = 0; i < 6; i++) columns.push([x - 8.5 + i * 3.4, z - 16.2], [x - 8.5 + i * 3.4, z + 16.2]);
  for (let j = 1; j < 11; j++) columns.push([x - 8.5, z - 16.2 + j * 2.95], [x + 8.5, z - 16.2 + j * 2.95]);
  for (const [cx, cz] of columns) {
    if (rnd.chance(0.18)) continue;
    const standing = rnd.chance(0.7);
    city.add(cylinder(0.7, 0.8, standing ? 8.5 : rnd.range(1.5, 4.5), marble, cx, floor, cz, 12));
  }
  // A surviving stretch of entablature over the east front, and fallen drums.
  city.add(box(17.5, 1.4, 1.8, marble, x, floor + 8.5, z - 16.2));
  for (let i = 0; i < 6; i++) {
    const drum = cylinder(0.75, 0.75, 1.6, marble, x + rnd.range(-16, 16), GROUND + 0.75, z + rnd.range(-24, 24), 12);
    drum.rotation.set(Math.PI / 2, rnd.range(0, Math.PI), 0);
    city.add(drum);
  }
}

/** Stumps of the walls Valens demolished in 366, their stones shipped across to Constantinople. */
function addRuinedWalls(city, rnd) {
  for (let z = -100; z < 100; z += 8) {
    if (rnd.chance(0.3)) continue;
    city.add(box(8.2, rnd.range(1, 5.5), 3.2, M.stone, 112 + rnd.range(-0.5, 0.5), GROUND, z).rotateY(Math.PI / 2));
  }
  for (const z of [-80, -20, 40]) city.add(box(8, rnd.range(4, 7), 8, M.stone, 114, GROUND, z));
}

/** Harbour mole on the western shore with two fishing boats. */
function addHarbour(city) {
  city.add(box(5, GROUND + 1, 40, M.stone, -78, -1, -45).rotateY(-0.6));
  const { geometry, deck } = createHull({ length: 9, beam: 2.6, depth: 1, bowRise: 0.6, sternRise: 0.6, segments: 16, ribs: 8 });
  for (const [x, z, rotation] of [[-96, -38, 0.6], [-102, -18, -0.4]]) {
    const boat = new THREE.Group();
    boat.add(mesh(geometry, M.hull, 0, 0.6, 0), mesh(deck, M.wood, 0, 0.4, 0));
    boat.add(cylinder(0.08, 0.1, 6, M.wood, 0.8, 0.4, 0, 6));
    boat.position.set(x, 0, z);
    boat.rotation.y = rotation;
    const phase = x;
    boat.userData.animate = (time) => { boat.position.y = 0.4 + Math.sin(time * 1.3 + phase) * 0.12; };
    city.add(boat);
  }
}

/** Two eagles wheeling above the town. */
function addEagles(city) {
  const feathers = tinted('wood', 0x7a5636);
  for (const [radius, height, speed, phase] of [[42, 38, 0.32, 0], [30, 48, 0.4, 2.4]]) {
    const eagle = createEagle(feathers, M.gold, tinted('marble', 0xffffff));
    eagle.scale.setScalar(4.5);
    const flap = eagle.userData.animate;
    eagle.userData.animate = (time) => {
      flap(time);
      const angle = time * speed + phase;
      eagle.position.set(Math.cos(angle) * radius, height + Math.sin(time * 0.7 + phase) * 3, Math.sin(angle) * radius);
      eagle.rotation.set(0.25, -angle - Math.PI / 2, 0, 'YXZ');
    };
    city.add(eagle);
  }
}
