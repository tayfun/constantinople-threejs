import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archedWallGeometry, box, colonnade, crenellationGeometry, cylinder, flag, gableRoof, groundPlane, hipRoof,
  mesh, pyramid, windowRow, faceToward, dome,
} from './lib/primitives.js';
import { mapStone, wallAlongGeometry } from './lib/mapWalls.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { createMerchantShip } from './merchantShip.js';
import { GALATA_SHORE, GALATA_WALLS, LAND_HEIGHT, METERS_TO_MAP, squeeze } from '../data/geography.js';

/**
 * Galata, the walled Genoese colony across the Golden Horn (1267–1453):
 * the Podestà's palace, the Dominican church of San Paolo e Domenico with
 * its bell tower, the merchants' loggia, tall Ligurian houses and a quay
 * full of cogs. The Golden Horn lies to the south (+z).
 *
 * Detail: a slice of the colony. Map: the wall circuit in map units with
 * the main buildings at their places (absolute).
 */
export function createGenoeseQuarter({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createColony() : createMapColony();
}

function createColony() {
  const colony = new THREE.Group();
  colony.add(box(210, 3, 125, M.paving, 0, -3, -12));

  // Sea wall with the harbour gate, and the uphill land wall.
  colony.add(mesh(archedWallGeometry({ length: 200, height: 9, thickness: 3, openings: [{ x: 10, width: 6, bottom: 0, spring: 5 }] }), M.stone, 0, 0, 40));
  colony.add(mesh(crenellationGeometry(200), M.stone, 0, 9, 41.2));
  colony.add(box(200, 12, 3.5, M.stone, 0, 0, -68));
  colony.add(mesh(crenellationGeometry(200), M.stone, 0, 12, -69.4));
  for (const x of [-85, -35, 55, 92]) colony.add(box(8, 13, 8, M.stone, x, 0, 40));
  for (const x of [-60, 0, 60]) colony.add(box(9, 17, 9, M.stone, x, 0, -68));

  // Quay, harbour water and cargo.
  colony.add(box(210, 1.8, 13, M.stone, 0, -1.2, 47.5));
  colony.add(groundPlane(280, 70, M.water, 0, 0, 89));
  const rnd = createRandom(1267);
  for (let i = 0; i < 18; i++) {
    const x = rnd.range(-90, 90);
    const z = rnd.range(43, 52);
    colony.add(rnd.chance(0.5) ? cylinder(0.6, 0.6, 1.3, M.wood, x, 0.6, z, 10) : box(1.4, 1.2, 1.4, M.wood, x, 0.6, z));
  }

  addPodestaPalace(colony, { x: -35, z: -6, detail: true });
  addDominicanChurch(colony, { x: 42, z: -22, detail: true });

  // The merchants' loggia near the harbour gate.
  for (const z of [17, 29]) {
    const columns = colonnade({ length: 24, count: 6, height: 7, radius: 0.45 });
    columns.position.set(10, 0, z);
    colony.add(columns);
  }
  colony.add(hipRoof(27, 15, 3.5, M.roof, 10, 7, 23));

  scatterHouses(colony, rnd, {
    count: 34,
    area: [-95, -60, 95, 32],
    avoid: [[-35, -6, 30], [42, -22, 30], [10, 23, 18], [10, 36, 8]],
    style: { roof: 'gable' },
  });

  finalizeModel(colony);
  colony.add(placed(flag('genoa', { width: 4, height: 2.6, pole: 7 }), -35, 28, -14));
  colony.add(placed(flag('genoa', { width: 3, height: 2, pole: 6 }), 10, 9, 40));
  colony.add(placed(createMerchantShip({ banner: 'genoa' }), 30, 0, 68, -0.15));
  colony.add(placed(createMerchantShip({ banner: 'genoa', sail: false }), -55, 0, 72, Math.PI + 0.1));
  return colony;
}

function placed(object, x, y, z, rotation = 0) {
  object.position.set(x, y, z);
  object.rotation.y = rotation;
  return object;
}

/** Palazzo del Comune (1316), seat of the Podestà, modelled on Genoa's civic palaces. */
function addPodestaPalace(group, { x, z, detail }) {
  group.add(box(36, 16, 20, M.stone, x, 0, z));
  group.add(box(36.6, 0.5, 20.6, M.stone, x, 16, z));
  for (const side of [-1, 1]) {
    group.add(mesh(crenellationGeometry(36, { merlon: 1, gap: 0.9 }), M.stone, x, 16.5, z + side * 9.9));
  }
  group.add(box(7, 28, 7, M.stone, x, 0, z - 8));
  group.add(mesh(crenellationGeometry(7), M.stone, x, 28, z - 4.8));
  group.add(mesh(crenellationGeometry(7), M.stone, x, 28, z - 11.2));
  if (detail) {
    for (const y of [3.5, 10]) {
      const row = windowRow({ count: 7, spacing: 4.6, width: 1.7, height: 3.6, y });
      row.position.set(x, 0, z + 10.05);
      group.add(row);
    }
  }
}

/** San Paolo e Domenico: a Gothic friars' church whose square bell tower still stands. */
function addDominicanChurch(group, { x, z, detail }) {
  group.add(box(14, 15, 38, M.stone, x, 0, z));
  const roof = gableRoof(38, 14, 5, M.roof, x, 15, z);
  roof.rotation.y = Math.PI / 2;
  group.add(roof);
  group.add(faceToward(cylinder(7, 7, 12, M.stone, x, 0, z - 19, 8, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  group.add(faceToward(dome(7, M.roof, x, 12, z - 19, { phiLength: Math.PI, heightScale: 0.6, segments: 8 }), 0, -1));
  const [tx, tz] = [x + 11, z + 14];
  group.add(box(6.5, 28, 6.5, M.stone, tx, 0, tz));
  group.add(pyramid(7.4, 7.4, 6, M.roof, tx, 28, tz));
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const belfry = windowRow({ count: 2, spacing: 2.4, width: 1.3, height: 3, y: 22 });
      const angle = (i * Math.PI) / 2;
      belfry.rotation.y = angle;
      belfry.position.set(tx + Math.sin(angle) * 3.28, 0, tz + Math.cos(angle) * 3.28);
      group.add(belfry);
    }
    const rose = mesh(new THREE.CircleGeometry(2.2, 20), M.opening, x, 10, z + 19.05);
    group.add(rose);
  }
}

// ---------- map version ----------

function createMapColony() {
  const colony = new THREE.Group();
  colony.add(mesh(wallAlongGeometry(GALATA_WALLS, { height: 0.55, thickness: 0.2, y: LAND_HEIGHT, towerSpacing: 1.7, towerWidth: 0.42, towerHeight: 0.85 }), mapStone));
  colony.add(mesh(wallAlongGeometry(GALATA_SHORE, { height: 0.35, thickness: 0.14, y: LAND_HEIGHT, offset: -0.35 }), mapStone));

  const buildings = new THREE.Group();
  addPodestaPalace(buildings, { x: 0, z: 0, detail: false });
  addDominicanChurch(buildings, { x: -95, z: -40, detail: false });
  const [east, north] = squeeze([-2.6, 18.8]);
  buildings.scale.setScalar(5 * METERS_TO_MAP);
  buildings.position.set(east, LAND_HEIGHT, -north);
  colony.add(buildings);
  // Keep the map's scattered houses clear of the palace and the church.
  colony.userData.keepOut = [[east, north, 1.4], [east - 4.75, north + 2, 1.5]];
  return finalizeModel(colony);
}
