import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, box, colonnade, crenellationGeometry, cylinder, cypress, dome, faceToward, gableRoof,
  groundPlane, hipRoof, mesh, placeOnCircle, archGeometry, regularOpenings, roundTree, stairs, windowRow,
} from './lib/primitives.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Great Palace: not one building but a walled complex of halls,
 * churches, courts and gardens on terraces descending from the Hippodrome
 * to the Sea of Marmara. The sea (and the Boukoleon harbour) lies at +z.
 */

const UPPER = 20; // terrace levels above the sea
const MIDDLE = 11;
const LOWER = 5;
const SEA_WALL_Z = 88;

export function createGreatPalace({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const palace = new THREE.Group();

  terrace(palace, 260, 92, UPPER, -56);
  terrace(palace, 260, 60, MIDDLE, 20);
  terrace(palace, 260, 38, LOWER, 69);
  // Marble stairs climbing from each terrace to the one behind it (towards -z).
  for (const [x, edge, lower, upper] of [[-110, -10, MIDDLE, UPPER], [60, 50, LOWER, MIDDLE]]) {
    const flight = stairs(10, 10, (upper - lower) / 10, 1.2, M.marble);
    flight.position.set(x, lower, edge + 12);
    flight.rotation.y = Math.PI;
    palace.add(flight);
  }

  addChalke(palace, detail);
  addDaphne(palace, detail);
  addMagnaura(palace, detail);
  addChrysotriklinos(palace, detail);
  addPeristyle(palace, detail);
  addPharos(palace);
  addBoukoleon(palace, detail);

  const trees = detail
    ? [[-110, UPPER, -30], [-100, UPPER, -24], [100, UPPER, -20], [110, UPPER, -36], [-15, MIDDLE, 40], [0, MIDDLE, 44], [15, MIDDLE, 40], [-120, MIDDLE, 40], [120, LOWER, 64], [110, LOWER, 60], [85, LOWER, 64]]
    : [[-110, UPPER, -30], [100, UPPER, -20], [0, MIDDLE, 44], [110, LOWER, 60]];
  for (const [x, y, z] of trees) palace.add(Math.abs(x) > 100 ? roundTree(9, x, y, z) : cypress(12, x, y, z));

  finalizeModel(palace);
  if (detail) addImperialBarge(palace);
  return palace;
}

/** A terrace: banded retaining wall with a paved top. */
function terrace(palace, width, depth, top, z) {
  palace.add(box(width, top + 2, depth, M.banded, 0, -2, z));
  palace.add(groundPlane(width, depth, M.paving, 0, top + 0.03, z));
}

/** The Chalke, the bronze-roofed ceremonial vestibule facing the Augustaion. */
function addChalke(palace, detail) {
  const [x, z] = [-70, -86];
  palace.add(box(28, 14, 18, M.marble, x, UPPER, z));
  palace.add(cylinder(7.5, 7.5, 3, M.marble, x, UPPER + 14, z, 20));
  palace.add(dome(7.5, M.gildedBronze, x, UPPER + 17, z, { heightScale: 0.75 }));
  palace.add(box(5, 8, 0.4, M.bronze, x, UPPER, z - 9.1));
  if (detail) {
    const porch = colonnade({ length: 22, count: 6, height: 10, radius: 0.5 });
    porch.position.set(x, UPPER, z - 12);
    palace.add(porch);
    palace.add(box(26, 0.8, 5, M.marble, x, UPPER + 10, z - 11.5));
  }
}

/** The Daphne palace, the oldest residential wing, with a southern portico. */
function addDaphne(palace, detail) {
  const [x, z] = [-10, -62];
  palace.add(box(70, 13, 18, M.stone, x, UPPER, z));
  palace.add(hipRoof(70, 18, 5, M.roof, x, UPPER + 13, z));
  if (detail) {
    const portico = colonnade({ length: 66, count: 14, height: 8, radius: 0.4 });
    portico.position.set(x, UPPER, z + 13);
    palace.add(portico);
    palace.add(box(70, 0.5, 5, M.roof, x, UPPER + 8, z + 11.5));
    const windows = windowRow({ count: 14, spacing: 4.8, width: 1.6, height: 2.8, y: 9.2 });
    windows.position.set(x, UPPER, z + 9.05);
    palace.add(windows);
  }
}

/** The Magnaura, a basilica-shaped hall where foreign envoys were received. */
function addMagnaura(palace, detail) {
  const [x, z] = [70, -72];
  palace.add(box(46, 11, 28, M.stone, x, UPPER, z));
  palace.add(box(46, 18, 14, M.stone, x, UPPER, z));
  palace.add(gableRoof(46, 14, 4, M.roof, x, UPPER + 18, z));
  palace.add(box(46.6, 0.5, 28.6, M.lead, x, UPPER + 11, z));
  palace.add(faceToward(cylinder(6.5, 6.5, 15, M.stone, x + 23, UPPER, z, 16, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  palace.add(faceToward(dome(6.5, M.lead, x + 23, UPPER + 15, z, { phiLength: Math.PI, heightScale: 0.8 }), 1, 0));
  if (detail) {
    for (const side of [-1, 1]) {
      const clerestory = windowRow({ count: 8, spacing: 5, width: 1.8, height: 3.2, y: 13 });
      clerestory.position.set(x, UPPER, z + side * 7.05);
      clerestory.rotation.y = side > 0 ? 0 : Math.PI;
      palace.add(clerestory);
    }
  }
}

/** The Chrysotriklinos, the octagonal golden throne hall of the 6th century. */
function addChrysotriklinos(palace, detail) {
  const [x, z] = [22, -28];
  palace.add(cylinder(14, 14, 15, M.stone, x, UPPER, z, 8));
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const apse = cylinder(5, 5, 10, M.stone, 0, 0, 0, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI });
    palace.add(placeOnCircle(apse, angle, 12.6, UPPER, x, z));
    const cap = dome(5, M.lead, 0, 0, 0, { phiLength: Math.PI, heightScale: 0.7, segments: 12 });
    palace.add(placeOnCircle(cap, angle, 12.6, UPPER + 10, x, z));
  }
  palace.add(cylinder(12.5, 12.5, 3.5, M.stone, x, UPPER + 15, z, 24));
  palace.add(dome(12.5, M.gold, x, UPPER + 18.5, z, { heightScale: 0.55, segments: 32 }));
  if (detail) {
    const window = archGeometry(1.4, 2.6);
    for (let i = 0; i < 16; i++) palace.add(placeOnCircle(mesh(window, M.opening), (i / 16) * Math.PI * 2, 12.55, UPPER + 15.4, x, z));
  }
}

/** The great peristyle court, whose mosaic floor still survives. */
function addPeristyle(palace, detail) {
  const [x, z] = [-62, 18];
  const [w, d] = [58, 44];
  palace.add(groundPlane(w - 10, d - 10, M.mosaic, x, MIDDLE + 0.06, z));
  for (const side of [-1, 1]) {
    palace.add(box(w, 8, 1.2, M.stone, x, MIDDLE, z + side * (d / 2)));
    palace.add(box(w, 0.5, 6, M.roof, x, MIDDLE + 8, z + side * (d / 2 - 2.5)));
    palace.add(box(1.2, 8, d, M.stone, x + side * (w / 2), MIDDLE, z));
    palace.add(box(6, 0.5, d, M.roof, x + side * (w / 2 - 2.5), MIDDLE + 8, z));
    if (detail) {
      const front = colonnade({ length: w - 8, count: 12, height: 8, radius: 0.35 });
      front.position.set(x, MIDDLE, z + side * (d / 2 - 5));
      palace.add(front);
      const flank = colonnade({ length: d - 8, count: 9, height: 8, radius: 0.35 });
      flank.rotation.y = Math.PI / 2;
      flank.position.set(x + side * (w / 2 - 5), MIDDLE, z);
      palace.add(flank);
    }
  }
}

/** The Pharos lighthouse and the palace church of the Virgin of the Pharos. */
function addPharos(palace) {
  // Church: a small cross-in-square with five domes, keeper of the Passion relics.
  const [cx, cz] = [36, 16];
  palace.add(box(16, 9, 16, M.brick, cx, MIDDLE, cz));
  palace.add(box(20, 12, 6.5, M.brick, cx, MIDDLE, cz));
  palace.add(box(6.5, 12, 20, M.brick, cx, MIDDLE, cz));
  palace.add(cylinder(3.2, 3.2, 3.5, M.brick, cx, MIDDLE + 12, cz, 16));
  palace.add(dome(3.2, M.lead, cx, MIDDLE + 15.5, cz));
  for (const [dx, dz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) {
    palace.add(cylinder(1.8, 1.8, 1.8, M.brick, cx + dx, MIDDLE + 9, cz + dz, 12));
    palace.add(dome(1.8, M.lead, cx + dx, MIDDLE + 10.8, cz + dz));
  }
  palace.add(faceToward(cylinder(3, 3, 8, M.brick, cx + 10, MIDDLE, cz, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));

  // Lighthouse tower with its signal fire.
  const [lx, lz] = [104, 34];
  palace.add(box(9, 26, 9, M.banded, lx, MIDDLE, lz));
  palace.add(box(10.5, 1, 10.5, M.stone, lx, MIDDLE + 26, lz));
  palace.add(mesh(crenellationGeometry(10), M.stone, lx, MIDDLE + 27, lz + 4.9));
  palace.add(mesh(crenellationGeometry(10), M.stone, lx, MIDDLE + 27, lz - 4.9));
  palace.add(cylinder(2.4, 2.4, 3, M.fire, lx, MIDDLE + 27, lz, 12));
  palace.add(cylinder(0.3, 0.3, 3, M.stone, lx + 2.2, MIDDLE + 27, lz + 2.2, 6));
  palace.add(cylinder(0.3, 0.3, 3, M.stone, lx - 2.2, MIDDLE + 27, lz - 2.2, 6));
  palace.add(dome(3.4, M.lead, lx, MIDDLE + 30, lz, { heightScale: 1.2 }));
}

/** The Boukoleon: palace rooms built into the sea wall above a private harbour. */
function addBoukoleon(palace, detail) {
  const [x, length] = [-40, 70];
  palace.add(box(length, 14, 20, M.stone, x, LOWER, 74));
  palace.add(hipRoof(length, 20, 5, M.roof, x, LOWER + 14, 74));

  // Tall sea-wall façade with great marble-framed windows and a water gate.
  const facade = detail
    ? mesh(archedWallGeometry({
      length,
      height: LOWER + 15,
      thickness: 4,
      openings: [
        ...regularOpenings(length, 5, { width: 4.5, bottom: LOWER + 6, spring: LOWER + 10.5 }),
        { x: 0, width: 5, bottom: 0, spring: 4 },
      ],
    }), M.marble)
    : box(length, LOWER + 15, 4, M.marble);
  facade.position.set(x, 0, SEA_WALL_Z);
  palace.add(facade);
  palace.add(box(length, 0.6, 4, M.marble, x, LOWER + 15, SEA_WALL_Z));

  // The rest of the sea wall with towers.
  for (const [start, end] of [[-130, x - length / 2], [x + length / 2, 130]]) {
    const span = end - start;
    palace.add(box(span, LOWER + 6, 4, M.banded, start + span / 2, 0, SEA_WALL_Z));
    palace.add(mesh(crenellationGeometry(span), M.banded, start + span / 2, LOWER + 6, SEA_WALL_Z + 1.6));
  }
  for (const towerX of [-120, -80, 10, 50, 90, 125]) palace.add(box(9, LOWER + 11, 9, M.banded, towerX, 0, SEA_WALL_Z + 1));

  if (detail) {
    // Harbour: quay, moles, water and the lion-and-bull statue that named the place.
    palace.add(groundPlane(320, 90, M.water, 0, 0, SEA_WALL_Z + 47));
    palace.add(box(100, 1.3, 9, M.stone, x, -0.3, SEA_WALL_Z + 6.5));
    for (const moleX of [x - 52, x + 52]) palace.add(box(5, 1.5, 40, M.stone, moleX, -0.3, SEA_WALL_Z + 21));
    palace.add(box(4, 3, 4, M.marble, x + 18, 1, SEA_WALL_Z + 7));
    const beasts = [box(3, 1.4, 1, M.marble, x + 17.2, 4, SEA_WALL_Z + 7), box(2.4, 1.8, 1.1, M.marble, x + 19, 4, SEA_WALL_Z + 7)];
    beasts[1].rotation.z = 0.5;
    palace.add(...beasts);
  }
}

/** A small gilded barge moored in the Boukoleon harbour. */
function addImperialBarge(palace) {
  const barge = new THREE.Group();
  const { geometry, deck } = createHull({ length: 16, beam: 4, depth: 1.4, bowRise: 1.2, sternRise: 1.6, segments: 24, ribs: 8 });
  barge.add(mesh(geometry, M.hull, 0, 0.9, 0));
  barge.add(mesh(deck, M.wood, 0, 0.7, 0));
  barge.add(box(5, 2, 3, cloth(0x5c1f63), -3, 0.7, 0));
  barge.add(gableRoof(5, 3, 1, M.gold, -3, 2.7, 0, 0.2));
  barge.position.set(-40, 0, SEA_WALL_Z + 24);
  barge.rotation.y = 0.2;
  barge.userData.animate = (time) => {
    barge.position.y = Math.sin(time * 1.1) * 0.12;
    barge.rotation.z = Math.sin(time * 0.8) * 0.02;
  };
  palace.add(barge);
}
