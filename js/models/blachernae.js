import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archedWallGeometry, box, crenelRingGeometry, crenellationGeometry, cylinder, cypress, dome, faceToward,
  gableRoof, groundPlane, hipRoof, mesh, regularOpenings, roundTree, windowRow,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * Blachernae, the north-west corner of the city where the Komnenian and
 * Palaiologan emperors lived from the late 11th century: a palace on a
 * terrace behind Manuel I's towered wall, the Palace of the Porphyrogenitus
 * (Tekfur Sarayı), and the shrine church of St Mary of Blachernae near the
 * shore. The Golden Horn lies to the north (-z), the land walls to the west.
 */

const TERRACE = 16;

export function createBlachernae({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const quarter = new THREE.Group();

  quarter.add(box(250, 3, 190, M.grass, 5, -3, 5));
  quarter.add(box(140, TERRACE, 110, M.banded, -50, 0, 35));
  quarter.add(groundPlane(140, 110, M.grass, -50, TERRACE + 0.03, 35));

  addWalls(quarter, detail);
  addPalace(quarter, detail);
  addTekfurSaray(quarter, detail);
  addChurch(quarter, detail);

  for (const [x, z] of [[-100, 80], [-20, 70], [0, 82], [-112, 30], [8, 10]]) quarter.add(cypress(12, x, TERRACE, z));
  for (const [x, z] of [[40, 20], [60, 30], [90, -10], [20, 50]]) quarter.add(roundTree(9, x, 0, z));

  if (detail) quarter.add(groundPlane(320, 70, M.water, 5, -0.4, -125));
  return finalizeModel(quarter);
}

/** Manuel I's single heavy wall with polygonal towers, and the Golden Horn sea wall. */
function addWalls(quarter, detail) {
  const wallX = -122;
  quarter.add(box(5, 22, 190, M.banded, wallX, 0, 5));
  if (detail) {
    for (const side of [-1, 1]) {
      const merlons = mesh(crenellationGeometry(190), M.banded, wallX + side * 2, 22, 5);
      merlons.rotation.y = Math.PI / 2;
      quarter.add(merlons);
    }
  }
  for (const z of [-78, -40, -2, 36, 74]) {
    quarter.add(cylinder(8, 8, 30, M.banded, wallX - 3, 0, z, 8));
    quarter.add(mesh(crenelRingGeometry(7.6, { count: 12 }), M.banded, wallX - 3, 30, z));
  }
  // The twin Anemas towers, used as the imperial prison.
  for (const z of [10, 24]) {
    quarter.add(box(12, 34, 12, M.banded, wallX + 10, 0, z));
    quarter.add(mesh(crenellationGeometry(12), M.banded, wallX + 10, 34, z + 5.6));
  }

  // Sea wall along the Golden Horn.
  quarter.add(box(250, 10, 4, M.banded, 5, 0, -88));
  quarter.add(mesh(crenellationGeometry(250), M.banded, 5, 10, -89.5));
  for (const x of [-80, -30, 20, 70, 115]) quarter.add(box(9, 15, 9, M.banded, x, 0, -88));
}

/** The Komnenian palace: main hall, keep and wing, with a loggia over the Horn. */
function addPalace(quarter, detail) {
  const y = TERRACE;
  quarter.add(box(50, 18, 30, M.stone, -45, y, 22));
  quarter.add(hipRoof(50, 30, 7, M.roof, -45, y + 18, 22));
  quarter.add(box(13, 32, 13, M.banded, -78, y, 4));
  quarter.add(keepBattlements(13, -78, y + 32, 4));
  quarter.add(box(34, 13, 20, M.stone, -6, y, 54));
  quarter.add(hipRoof(34, 20, 5, M.roof, -6, y + 13, 54));

  // Loggia facing the Horn.
  const loggia = detail
    ? mesh(archedWallGeometry({ length: 50, height: 11, thickness: 1.2, openings: regularOpenings(50, 7, { width: 4.4, bottom: 0, spring: 6.5 }) }), M.marble)
    : box(50, 11, 1.2, M.marble);
  loggia.position.set(-45, y, 2.5);
  quarter.add(loggia);
  quarter.add(box(50, 0.6, 6, M.lead, -45, y + 11, 4.5));
  if (detail) {
    const windows = windowRow({ count: 8, spacing: 5.5, width: 2, height: 3.4, y: 12 });
    windows.position.set(-45, y, 37.05);
    quarter.add(windows);
  }
}

function keepBattlements(size, x, y, z) {
  const cap = new THREE.Group();
  cap.add(mesh(crenellationGeometry(size), M.banded, x, y, z - size / 2 + 0.35));
  cap.add(mesh(crenellationGeometry(size), M.banded, x, y, z + size / 2 - 0.35));
  return cap;
}

/** Tekfur Sarayı: three storeys of patterned brick and marble, late 13th century. */
function addTekfurSaray(quarter, detail) {
  const [x, z] = [-96, 66];
  const y = TERRACE;
  quarter.add(box(22, 24, 14, M.banded, x, y, z));
  quarter.add(hipRoof(22, 14, 4, M.roof, x, y + 24, z));
  const facade = detail
    ? mesh(archedWallGeometry({
      length: 22,
      height: 24,
      thickness: 1,
      openings: [
        ...regularOpenings(22, 4, { width: 3.2, bottom: 0, spring: 5 }),
        ...regularOpenings(22, 5, { width: 2, bottom: 9, spring: 12.5 }),
        ...regularOpenings(22, 5, { width: 2.2, bottom: 16.5, spring: 20.5 }),
      ],
    }), M.banded)
    : box(22, 24, 1, M.banded);
  facade.position.set(x, y, z - 7.5);
  quarter.add(facade);
}

/** St Mary of Blachernae, guardian of the Virgin's robe, with the round Holy Soros chapel. */
function addChurch(quarter, detail) {
  const [x, z] = [52, -46];
  quarter.add(box(40, 10, 26, M.brick, x, 0, z));
  quarter.add(box(40, 16, 13, M.brick, x, 0, z));
  quarter.add(gableRoof(40, 13, 4, M.roof, x, 16, z));
  quarter.add(box(40.6, 0.5, 26.6, M.lead, x, 10, z));
  quarter.add(cylinder(4.5, 4.5, 3.5, M.brick, x, 18.5, z, 16));
  quarter.add(dome(4.5, M.lead, x, 22, z, { heightScale: 0.7 }));
  quarter.add(faceToward(cylinder(6, 6, 13, M.brick, x + 20, 0, z, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  quarter.add(faceToward(dome(6, M.lead, x + 20, 13, z, { phiLength: Math.PI, heightScale: 0.8 }), 1, 0));

  quarter.add(cylinder(7.5, 7.5, 11, M.brick, x - 28, 0, z + 4, 16));
  quarter.add(dome(7.5, M.lead, x - 28, 11, z + 4, { heightScale: 0.65 }));

  // The holy spring (hagiasma).
  quarter.add(box(7, 4, 7, M.marble, x + 8, 0, z + 24));
  quarter.add(dome(3.4, M.lead, x + 8, 4, z + 24));
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 7, spacing: 5, width: 1.5, height: 2.8, y: 11.5 });
      windows.position.set(x, 0, z + side * 6.55);
      windows.rotation.y = side > 0 ? 0 : Math.PI;
      quarter.add(windows);
    }
  }
}
